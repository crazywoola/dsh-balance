import type { BalanceErrorCode, BalanceInfo } from './types.ts'

const DECIMAL = /^-?\d+(?:\.\d+)?$/

interface DeepSeekBalancePayload {
  isAvailable: boolean
  balanceInfos: BalanceInfo[]
}

/** A safe, classified failure suitable for translation at the Host boundary. */
export class BalanceQueryError extends Error {
  constructor(
    readonly code: BalanceErrorCode,
    message: string,
    readonly httpStatus: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'BalanceQueryError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function decimalField(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || !DECIMAL.test(value)) {
    throw new BalanceQueryError('INVALID_RESPONSE', `DeepSeek balance response has an invalid ${key}`, 502)
  }
  return value
}

/** Parse the documented DeepSeek payload and reject incomplete or surprising wire values. */
export function parseDeepSeekBalance(value: unknown): DeepSeekBalancePayload {
  if (!isRecord(value) || typeof value.is_available !== 'boolean' || !Array.isArray(value.balance_infos)) {
    throw new BalanceQueryError('INVALID_RESPONSE', 'DeepSeek returned an invalid balance response', 502)
  }

  const balanceInfos = value.balance_infos.map((item): BalanceInfo => {
    if (!isRecord(item) || typeof item.currency !== 'string' || item.currency.length === 0) {
      throw new BalanceQueryError('INVALID_RESPONSE', 'DeepSeek returned an invalid balance currency row', 502)
    }
    return {
      currency: item.currency,
      totalBalance: decimalField(item, 'total_balance'),
      grantedBalance: decimalField(item, 'granted_balance'),
      toppedUpBalance: decimalField(item, 'topped_up_balance'),
    }
  })

  return { isAvailable: value.is_available, balanceInfos }
}

function balanceEndpoint(baseUrl: string): URL {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return new URL('user/balance', normalized)
}

function upstreamFailure(status: number): BalanceQueryError {
  if (status === 401 || status === 403) {
    return new BalanceQueryError('INVALID_API_KEY', 'DeepSeek API 密钥无效或无权查询余额', 401)
  }
  if (status === 429) {
    return new BalanceQueryError('RATE_LIMITED', 'DeepSeek API 请求过于频繁，请稍后重试', 429)
  }
  if (status >= 500) {
    return new BalanceQueryError('UPSTREAM_UNAVAILABLE', 'DeepSeek API 暂时不可用，请稍后重试', 502)
  }
  return new BalanceQueryError('UPSTREAM_ERROR', `DeepSeek API 返回了 HTTP ${status}`, 502)
}

export interface QueryBalanceOptions {
  apiKey: string
  baseUrl: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

/** Query the official endpoint with Bearer authentication and strict response validation. */
export async function queryDeepSeekBalance(options: QueryBalanceOptions): Promise<DeepSeekBalancePayload> {
  const fetchImpl = options.fetchImpl ?? fetch
  let response: Response
  try {
    response = await fetchImpl(balanceEndpoint(options.baseUrl), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${options.apiKey}`,
      },
      signal: AbortSignal.timeout(options.timeoutMs),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new BalanceQueryError('UPSTREAM_TIMEOUT', '查询 DeepSeek 余额超时', 504, { cause: error })
    }
    throw new BalanceQueryError('UPSTREAM_UNAVAILABLE', '无法连接到 DeepSeek API', 502, { cause: error })
  }

  if (!response.ok) throw upstreamFailure(response.status)

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new BalanceQueryError('INVALID_RESPONSE', 'DeepSeek 返回了无法解析的余额响应', 502, { cause: error })
  }
  return parseDeepSeekBalance(payload)
}
