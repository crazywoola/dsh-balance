import type { BalanceErrorCode, BalanceInfo, BalancePayload } from './types.ts'
import { findBalanceProvider } from './providers.ts'
import type { BalanceProviderId } from './providers.ts'

const DECIMAL = /^-?\d+(?:\.\d+)?$/

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
export function parseDeepSeekBalance(value: unknown): BalancePayload {
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

function numberField(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BalanceQueryError('INVALID_RESPONSE', `StepFun account response has an invalid ${key}`, 502)
  }
  return String(value)
}

/** StepFun totals are cumulative amounts, not components of the available balance. */
export function parseStepFunBalance(value: unknown): BalancePayload {
  if (!isRecord(value) || value.object !== 'account' || (value.type !== 'prepaid' && value.type !== 'postpaid')) {
    throw new BalanceQueryError('INVALID_RESPONSE', 'StepFun returned an invalid account response', 502)
  }
  return {
    isAvailable: null,
    accountType: value.type,
    balanceInfos: [{
      currency: 'CNY',
      totalBalance: numberField(value, 'balance'),
      totalCashBalance: numberField(value, 'total_cash_balance'),
      totalVoucherBalance: numberField(value, 'total_voucher_balance'),
    }],
  }
}

/** Tokener encodes USD as integer millionths; keep monetary values exact. */
function usdMicroField(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
    throw new BalanceQueryError('INVALID_RESPONSE', `Tokener balance response has an invalid ${key}`, 502)
  }
  const micro = BigInt(value)
  const absolute = micro < 0n ? -micro : micro
  const fraction = String(absolute % 1_000_000n).padStart(6, '0')
  return `${micro < 0n ? '-' : ''}${absolute / 1_000_000n}.${fraction}`
}

export function parseTokenerBalance(value: unknown): BalancePayload {
  if (!isRecord(value) || (value.status !== 'active' && value.status !== 'suspended')) {
    throw new BalanceQueryError('INVALID_RESPONSE', 'Tokener returned an invalid balance response', 502)
  }
  const totalBalance = usdMicroField(value, 'availableUsdMicro')
  return {
    isAvailable: value.status === 'active' && BigInt(value.availableUsdMicro as string) > 0n,
    balanceInfos: [{
      currency: 'USD',
      totalBalance,
      toppedUpBalance: usdMicroField(value, 'purchasedAvailableUsdMicro'),
      grantedBalance: usdMicroField(value, 'grantedAvailableUsdMicro'),
    }],
  }
}

/** Add a provider's endpoint and parser here; transport and error handling are shared. */
const adapters: Record<BalanceProviderId, { path: string; parse: (value: unknown) => BalancePayload }> = {
  deepseek: { path: 'user/balance', parse: parseDeepSeekBalance },
  stepfun: { path: 'accounts', parse: parseStepFunBalance },
  tokener: { path: 'billing/balance', parse: parseTokenerBalance },
}

function upstreamFailure(status: number, provider: string): BalanceQueryError {
  if (status === 401 || status === 403) {
    return new BalanceQueryError('INVALID_API_KEY', `${provider} API 密钥无效或无权查询余额`, 401)
  }
  if (status === 429) {
    return new BalanceQueryError('RATE_LIMITED', `${provider} API 请求过于频繁，请稍后重试`, 429)
  }
  if (status >= 500) {
    return new BalanceQueryError('UPSTREAM_UNAVAILABLE', `${provider} API 暂时不可用，请稍后重试`, 502)
  }
  return new BalanceQueryError('UPSTREAM_ERROR', `${provider} API 返回了 HTTP ${status}`, 502)
}

export interface QueryBalanceOptions {
  apiKey: string
  baseUrl: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

/** Query the official endpoint with Bearer authentication and strict response validation. */
export async function queryProviderBalance(providerId: string, options: QueryBalanceOptions): Promise<BalancePayload> {
  const provider = findBalanceProvider(providerId)
  if (provider === undefined) throw new BalanceQueryError('UNSUPPORTED_PROVIDER', '不支持此提供方的余额查询', 400)
  const adapter = adapters[provider.id]
  const baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`

  const fetchImpl = options.fetchImpl ?? fetch
  let response: Response
  try {
    response = await fetchImpl(new URL(adapter.path, baseUrl), {
      method: 'GET',
      redirect: 'error',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${options.apiKey}`,
      },
      signal: AbortSignal.timeout(options.timeoutMs),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new BalanceQueryError('UPSTREAM_TIMEOUT', `查询 ${provider.name} 余额超时`, 504, { cause: error })
    }
    throw new BalanceQueryError('UPSTREAM_UNAVAILABLE', `无法连接到 ${provider.name} API`, 502, { cause: error })
  }

  if (!response.ok) throw upstreamFailure(response.status, provider.name)

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new BalanceQueryError('UPSTREAM_TIMEOUT', `查询 ${provider.name} 余额超时`, 504, { cause: error })
    }
    throw new BalanceQueryError('INVALID_RESPONSE', `${provider.name} 返回了无法解析的余额响应`, 502, { cause: error })
  }
  return adapter.parse(payload)
}

/** Backward-compatible DeepSeek entry point. */
export function queryDeepSeekBalance(options: QueryBalanceOptions): Promise<BalancePayload> {
  return queryProviderBalance('deepseek', options)
}

export function queryStepFunBalance(options: QueryBalanceOptions): Promise<BalancePayload> {
  return queryProviderBalance('stepfun', options)
}
