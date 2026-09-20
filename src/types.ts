/** The same-origin endpoint exposed by the plugin's Host half. */
export const BALANCE_ROUTE = '/dsh-balance/api/balance'

/** The same-origin endpoint that proxies DeepSeek's `/models` API. */
export const MODELS_ROUTE = '/dsh-balance/api/models'

/** Normalized monetary values; provider totals are not remaining balance components. */
export interface BalanceInfo {
  currency: string
  totalBalance: string
  grantedBalance?: string
  toppedUpBalance?: string
  totalCashBalance?: string
  totalVoucherBalance?: string
}

export interface BalancePayload {
  /** null when the provider does not report service availability. */
  isAvailable: boolean | null
  accountType?: 'prepaid' | 'postpaid'
  balanceInfos: BalanceInfo[]
}

/** A successful, browser-safe balance response. */
export interface BalanceSuccess extends BalancePayload {
  ok: true
  provider?: string
  fetchedAt: string
  source: 'live' | 'cache'
}

export type ApiErrorCode =
  | 'UNSUPPORTED_PROVIDER'
  | 'FORBIDDEN'
  | 'INVALID_API_KEY'
  | 'INVALID_RESPONSE'
  | 'METHOD_NOT_ALLOWED'
  | 'MISSING_API_KEY'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'

/** @deprecated Prefer `ApiErrorCode`. */
export type DeepSeekApiErrorCode = ApiErrorCode
export type BalanceErrorCode = ApiErrorCode

/** A failed, browser-safe response. It intentionally contains no upstream body or credential. */
export interface BalanceFailure {
  ok: false
  code: ApiErrorCode
  message: string
}

export type BalanceApiResponse = BalanceSuccess | BalanceFailure

/** One model returned by DeepSeek's `/models` API. */
export interface ModelInfo {
  id: string
  ownedBy: string
}

/** A successful, browser-safe model-list response. */
export interface ModelsSuccess {
  ok: true
  models: ModelInfo[]
  fetchedAt: string
  source: 'live' | 'cache'
}

export type ModelsFailure = BalanceFailure
export type ModelsApiResponse = ModelsSuccess | ModelsFailure
