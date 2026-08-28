import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session-persistence'
import z from '@deepseek-ai/schemastery'
import { BalanceQueryError, queryDeepSeekBalance } from './balance.ts'
import { aggregateBilling, assertTimeZone, normalizeUsdToCny, USAGE_ROUTE } from './billing.ts'
import { ModelQueryError, queryDeepSeekModels } from './models.ts'
import { BALANCE_ROUTE, MODELS_ROUTE } from './types.ts'
import type {
  BalanceApiResponse,
  BalanceSuccess,
  ModelsApiResponse,
  ModelsSuccess,
} from './types.ts'
import type {
  UsageAllSuccess,
  UsageApiResponse,
  UsageFailure,
  UsageQuery,
  UsageSessionSuccess,
} from './billing.ts'

export const name = 'dsh-balance'
export const inject = ['webServer', 'credentials', 'sessionPersistence']

export interface Config {
  apiKeyRef: string
  baseUrl: string
  timeoutMs: number
  cacheMs: number
  allowRemote: boolean
  usdToCny?: number
}

export const Config: z<Config> = z.object({
  apiKeyRef: z.string().role('credential-ref').default('DEEPSEEK_API_KEY'),
  baseUrl: z.string().default('https://api.deepseek.com'),
  timeoutMs: z.number().step(1).min(1).max(60_000).default(10_000),
  cacheMs: z.number().step(1).min(0).max(300_000).default(30_000),
  allowRemote: z.boolean().default(false),
  usdToCny: z.number().min(0.000001).max(1_000_000).required(false),
})

function validateBaseUrl(value: string): void {
  const url = new URL(value)
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('dsh-balance: baseUrl must use HTTPS (HTTP is accepted only for a loopback test server)')
  }
}

function isLoopbackRequest(req: IncomingMessage): boolean {
  const host = req.headers.host
  if (host === undefined) return false
  try {
    const hostname = new URL(`http://${host}`).hostname
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]'
  } catch {
    return false
  }
}

function sendJson(res: ServerResponse, status: number, body: BalanceApiResponse | ModelsApiResponse | UsageApiResponse): void {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}

function usageFailure(code: UsageFailure['code'], message: string): UsageFailure {
  return { ok: false, code, message }
}

function parseUsageQuery(requestUrl: URL): UsageQuery | UsageFailure {
  const scope = requestUrl.searchParams.get('scope') ?? 'all'
  if (scope !== 'all' && scope !== 'session') return usageFailure('INVALID_REQUEST', 'scope 只能是 all 或 session')

  const sessionId = requestUrl.searchParams.get('sessionId') ?? undefined
  if (scope === 'session' && (sessionId === undefined || sessionId.trim().length === 0)) {
    return usageFailure('INVALID_REQUEST', 'session scope 需要 sessionId')
  }

  const timeZone = requestUrl.searchParams.get('timeZone') ?? 'UTC'
  try {
    assertTimeZone(timeZone)
  } catch {
    return usageFailure('INVALID_REQUEST', 'timeZone 不是有效的 IANA 时区')
  }

  const from = requestUrl.searchParams.get('from') ?? undefined
  const to = requestUrl.searchParams.get('to') ?? undefined
  const datePattern = /^\d{4}-\d{2}-\d{2}$/
  if ((from !== undefined && !datePattern.test(from)) || (to !== undefined && !datePattern.test(to))) {
    return usageFailure('INVALID_REQUEST', 'from 和 to 必须是 YYYY-MM-DD')
  }
  if (from !== undefined && to !== undefined && from > to) return usageFailure('INVALID_REQUEST', 'from 不能晚于 to')

  return {
    scope,
    ...(sessionId === undefined ? {} : { sessionId }),
    timeZone,
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    refresh: requestUrl.searchParams.get('refresh') === '1',
  }
}

function sessionTitle(events: readonly { type: string; data: unknown }[], fallback: string): string {
  let title = fallback
  for (const event of events) {
    if (event.type !== 'session/title' || typeof event.data !== 'object' || event.data === null || Array.isArray(event.data)) continue
    const value = (event.data as Record<string, unknown>).title
    if (typeof value === 'string' && value.trim().length > 0) title = value
  }
  return title
}

async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const result: R[] = []
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      const item = items[index]
      if (item !== undefined) result[index] = await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, worker))
  return result
}

/** Register the Host route that keeps credentials and upstream access out of the browser. */
export function apply(ctx: Context, config: Config): void {
  validateBaseUrl(config.baseUrl)
  const ref = credentialRef(config.apiKeyRef)
  let cached: { expiresAt: number; value: BalanceSuccess } | undefined
  let cachedModels: { expiresAt: number; value: ModelsSuccess } | undefined
  let cachedUsage: { key: string; expiresAt: number; value: UsageAllSuccess | UsageSessionSuccess } | undefined

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') {
      res.setHeader('allow', 'GET')
      sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: '仅支持 GET 请求' })
      return
    }
    if (!config.allowRemote && !isLoopbackRequest(req)) {
      sendJson(res, 403, { ok: false, code: 'FORBIDDEN', message: '余额查询仅允许从本机访问' })
      return
    }

    const requestUrl = new URL(req.url ?? BALANCE_ROUTE, 'http://localhost')
    const forceRefresh = requestUrl.searchParams.get('refresh') === '1'
    if (!forceRefresh && cached !== undefined && cached.expiresAt > Date.now()) {
      sendJson(res, 200, { ...cached.value, source: 'cache' })
      return
    }

    const credential = await ctx.credentials.resolve(ref)
    if (credential === undefined) {
      sendJson(res, 401, {
        ok: false,
        code: 'MISSING_API_KEY',
        message: `未配置 ${config.apiKeyRef}，请先在“模型”设置中保存 DeepSeek API 密钥`,
      })
      return
    }

    try {
      const result = await queryDeepSeekBalance({
        apiKey: credential.value,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
      })
      const value: BalanceSuccess = {
        ok: true,
        isAvailable: result.isAvailable,
        balanceInfos: result.balanceInfos,
        fetchedAt: new Date().toISOString(),
        source: 'live',
      }
      cached = { expiresAt: Date.now() + config.cacheMs, value }
      sendJson(res, 200, value)
    } catch (error) {
      const failure = error instanceof BalanceQueryError
        ? error
        : new BalanceQueryError('UPSTREAM_ERROR', '查询余额时发生未知错误', 502, { cause: error })
      ctx.logger.warn(failure)
      sendJson(res, failure.httpStatus, { ok: false, code: failure.code, message: failure.message })
    }
  }

  const modelsHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') {
      res.setHeader('allow', 'GET')
      sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', message: '仅支持 GET 请求' })
      return
    }
    if (!config.allowRemote && !isLoopbackRequest(req)) {
      sendJson(res, 403, { ok: false, code: 'FORBIDDEN', message: '模型查询仅允许从本机访问' })
      return
    }

    const requestUrl = new URL(req.url ?? MODELS_ROUTE, 'http://localhost')
    const forceRefresh = requestUrl.searchParams.get('refresh') === '1'
    if (!forceRefresh && cachedModels !== undefined && cachedModels.expiresAt > Date.now()) {
      sendJson(res, 200, { ...cachedModels.value, source: 'cache' })
      return
    }

    const credential = await ctx.credentials.resolve(ref)
    if (credential === undefined) {
      sendJson(res, 401, {
        ok: false,
        code: 'MISSING_API_KEY',
        message: `未配置 ${config.apiKeyRef}，请先在“模型”设置中保存 DeepSeek API 密钥`,
      })
      return
    }

    try {
      const result = await queryDeepSeekModels({
        apiKey: credential.value,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
      })
      const value: ModelsSuccess = {
        ok: true,
        models: result.models,
        fetchedAt: new Date().toISOString(),
        source: 'live',
      }
      cachedModels = { expiresAt: Date.now() + config.cacheMs, value }
      sendJson(res, 200, value)
    } catch (error) {
      const failure = error instanceof ModelQueryError
        ? error
        : new ModelQueryError('UPSTREAM_ERROR', '查询模型时发生未知错误', 502, { cause: error })
      ctx.logger.warn(failure)
      sendJson(res, failure.httpStatus, { ok: false, code: failure.code, message: failure.message })
    }
  }

  const usageHandler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') {
      res.setHeader('allow', 'GET')
      sendJson(res, 405, usageFailure('METHOD_NOT_ALLOWED', '仅支持 GET 请求'))
      return
    }
    if (!config.allowRemote && !isLoopbackRequest(req)) {
      sendJson(res, 403, usageFailure('FORBIDDEN', '消费统计仅允许从本机访问'))
      return
    }

    const requestUrl = new URL(req.url ?? USAGE_ROUTE, 'http://localhost')
    const parsedQuery = parseUsageQuery(requestUrl)
    if ('code' in parsedQuery) {
      sendJson(res, 400, parsedQuery)
      return
    }
    const query = parsedQuery

    try {
      const snapshots = query.scope === 'session'
        ? (await ctx.sessionPersistence.listSnapshots()).filter(snapshot => String(snapshot.header.id) === query.sessionId)
        : await ctx.sessionPersistence.listSnapshots()
      if (query.scope === 'session' && snapshots.length === 0) {
        sendJson(res, 404, usageFailure('SESSION_NOT_FOUND', '找不到指定会话'))
        return
      }

      const revisionKey = snapshots
        .map(snapshot => `${String(snapshot.header.id)}:${JSON.stringify(snapshot.revision)}`)
        .sort()
        .join('|')
      const cacheKey = JSON.stringify({ revisionKey, ...query, usdToCny: normalizeUsdToCny(config.usdToCny) })
      if (!query.refresh && cachedUsage !== undefined && cachedUsage.key === cacheKey && cachedUsage.expiresAt > Date.now()) {
        sendJson(res, 200, { ...cachedUsage.value, source: 'cache' })
        return
      }

      const sources = await mapWithConcurrency(snapshots, 4, async (snapshot) => {
        const inspection = await ctx.sessionPersistence.inspect(snapshot.header.id)
        return {
          sessionId: String(inspection.meta.id),
          title: sessionTitle(inspection.events, String(inspection.meta.id)),
          header: inspection.meta,
          events: inspection.events,
        }
      })
      const usdToCny = normalizeUsdToCny(config.usdToCny)
      const aggregateOptions: {
        timeZone: string
        from?: string
        to?: string
        usdToCny?: number
      } = { timeZone: query.timeZone }
      if (query.from !== undefined) aggregateOptions.from = query.from
      if (query.to !== undefined) aggregateOptions.to = query.to
      if (usdToCny !== undefined) aggregateOptions.usdToCny = usdToCny
      const aggregate = aggregateBilling(sources, aggregateOptions)
      const fetchedAt = new Date().toISOString()
      const value: UsageAllSuccess | UsageSessionSuccess = query.scope === 'session'
        ? (() => {
            const selected = aggregate.summary.bySession.find(item => item.sessionId === query.sessionId) ?? {
              ...aggregate.summary.totals,
              sessionId: query.sessionId ?? '',
              title: query.sessionId ?? '',
            }
            return {
              ok: true,
              scope: 'session',
              fetchedAt,
              source: 'live',
              session: selected,
              summary: aggregate.summary,
              requests: [...(aggregate.requestsBySession.get(query.sessionId ?? '') ?? [])],
            }
          })()
        : {
            ok: true,
            scope: 'all',
            fetchedAt,
            source: 'live',
            summary: aggregate.summary,
          }
      cachedUsage = { key: cacheKey, expiresAt: Date.now() + config.cacheMs, value }
      sendJson(res, 200, value)
    } catch (error) {
      ctx.logger.warn(error)
      sendJson(res, 503, usageFailure('UPSTREAM_UNAVAILABLE', '读取会话消费记录失败，请稍后重试'))
    }
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: BALANCE_ROUTE, handler }),
    `dsh-balance: ${BALANCE_ROUTE}`,
  )
  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: MODELS_ROUTE, handler: modelsHandler }),
    `dsh-balance: ${MODELS_ROUTE}`,
  )
  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: USAGE_ROUTE, handler: usageHandler }),
    `dsh-balance: ${USAGE_ROUTE}`,
  )
}

export { BalanceQueryError, parseDeepSeekBalance, queryDeepSeekBalance } from './balance.ts'
export { ModelQueryError, parseDeepSeekModels, queryDeepSeekModels } from './models.ts'
export {
  aggregateBilling,
  assertTimeZone,
  BILLING_PRICES,
  BILLING_PRICING_VERSION,
  calculateRequestCost,
  extractSessionUsage,
  normalizeUsdToCny,
  resolveBillingPrice,
  USAGE_ROUTE,
} from './billing.ts'
export type {
  BalanceApiResponse,
  BalanceFailure,
  BalanceInfo,
  BalanceSuccess,
  ModelInfo,
  ModelsApiResponse,
  ModelsFailure,
  ModelsSuccess,
} from './types.ts'
export type {
  BillingPrice,
  BillingUnknownReason,
  BillingUsage,
  UsageAllSuccess,
  UsageApiResponse,
  UsageDayAggregate,
  UsageFailure,
  UsageModelAggregate,
  UsageQuery,
  UsageRequestRecord,
  UsageSessionAggregate,
  UsageSessionSuccess,
  UsageSummary,
  UsageTotals,
} from './billing.ts'
