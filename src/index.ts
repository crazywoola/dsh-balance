import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'
import { BalanceQueryError, queryDeepSeekBalance } from './balance.ts'
import { ModelQueryError, queryDeepSeekModels } from './models.ts'
import { BALANCE_ROUTE, MODELS_ROUTE } from './types.ts'
import type { BalanceApiResponse, BalanceSuccess, ModelsApiResponse, ModelsSuccess } from './types.ts'

export const name = 'dsh-balance'
export const inject = ['webServer', 'credentials']

export interface Config {
  apiKeyRef: string
  baseUrl: string
  timeoutMs: number
  cacheMs: number
  allowRemote: boolean
}

export const Config: z<Config> = z.object({
  apiKeyRef: z.string().role('credential-ref').default('DEEPSEEK_API_KEY'),
  baseUrl: z.string().default('https://api.deepseek.com'),
  timeoutMs: z.number().step(1).min(1).max(60_000).default(10_000),
  cacheMs: z.number().step(1).min(0).max(300_000).default(30_000),
  allowRemote: z.boolean().default(false),
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

function sendJson(res: ServerResponse, status: number, body: BalanceApiResponse | ModelsApiResponse): void {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}

/** Register the Host route that keeps credentials and upstream access out of the browser. */
export function apply(ctx: Context, config: Config): void {
  validateBaseUrl(config.baseUrl)
  const ref = credentialRef(config.apiKeyRef)
  let cached: { expiresAt: number; value: BalanceSuccess } | undefined
  let cachedModels: { expiresAt: number; value: ModelsSuccess } | undefined

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

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: BALANCE_ROUTE, handler }),
    `dsh-balance: ${BALANCE_ROUTE}`,
  )
  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: MODELS_ROUTE, handler: modelsHandler }),
    `dsh-balance: ${MODELS_ROUTE}`,
  )
}

export { BalanceQueryError, parseDeepSeekBalance, queryDeepSeekBalance } from './balance.ts'
export { ModelQueryError, parseDeepSeekModels, queryDeepSeekModels } from './models.ts'
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
