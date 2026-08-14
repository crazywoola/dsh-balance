/** The same-origin endpoint exposed by the plugin's Host half. */
export const BALANCE_ROUTE = '/dsh-balance/api/balance'

/** The same-origin endpoint that proxies DeepSeek's `/models` API. */
export const MODELS_ROUTE = '/dsh-balance/api/models'

/** One currency row returned by DeepSeek's `/user/balance` API. */
export interface BalanceInfo {
  currency: string
  totalBalance: string
  grantedBalance: string
  toppedUpBalance: string
}

/** A successful, browser-safe balance response. */
export interface BalanceSuccess {
  ok: true
  isAvailable: boolean
  balanceInfos: BalanceInfo[]
  fetchedAt: string
  source: 'live' | 'cache'
}

export type DeepSeekApiErrorCode =
  | 'FORBIDDEN'
  | 'INVALID_API_KEY'
  | 'INVALID_RESPONSE'
  | 'METHOD_NOT_ALLOWED'
  | 'MISSING_API_KEY'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'

/** @deprecated Prefer the feature-neutral `DeepSeekApiErrorCode`. */
export type BalanceErrorCode = DeepSeekApiErrorCode

/** A failed, browser-safe response. It intentionally contains no upstream body or credential. */
export interface BalanceFailure {
  ok: false
  code: DeepSeekApiErrorCode
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
