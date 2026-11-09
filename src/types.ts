/** The same-origin endpoint exposed by the plugin's Host half. */
export const BALANCE_ROUTE = '/dsh-balance/api/balance'

/** The same-origin endpoint that proxies the selected provider’s `/models` API. */
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

/** One in-process balance observation, kept for the trend view. */
export interface BalanceHistoryPoint {
  fetchedAt: string
  isAvailable: boolean | null
  /** Same currency order as balanceInfos; one row per reported currency. */
  balances: { currency: string; totalBalance: string }[]
}

/** A configured low-balance threshold the response fell below. */
export interface BalanceThresholdBreach {
  currency: string
  totalBalance: string
  /** The configured threshold, in the same currency. */
  amount: number
}

/** A successful, browser-safe balance response. */
export interface BalanceSuccess extends BalancePayload {
  ok: true
  provider?: string
  fetchedAt: string
  source: 'live' | 'cache'
  /** Oldest-first in-process observations, once at least two live queries completed. */
  history?: BalanceHistoryPoint[]
  /** Configured thresholds this response breaches; absent without configuration. */
  lowBalance?: BalanceThresholdBreach[]
}

export type ApiErrorCode =
  | 'UNSUPPORTED_PROVIDER'
  | 'BALANCE_NOT_SUPPORTED'
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

/** One model returned by a provider’s `/models` API. */
export interface ModelInfo {
  id: string
  ownedBy: string
  /** Unix timestamp in seconds, when supplied by the provider. */
  created?: number
}

/** A successful, browser-safe model-list response. */
export interface ModelsSuccess {
  ok: true
  provider?: string
  models: ModelInfo[]
  fetchedAt: string
  source: 'live' | 'cache'
}

export type ModelsFailure = BalanceFailure
export type ModelsApiResponse = ModelsSuccess | ModelsFailure
