/** The same-origin endpoint exposed by the plugin's Host half. */
export const BALANCE_ROUTE = '/dsh-balance/api/balance'

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

export type BalanceErrorCode =
  | 'FORBIDDEN'
  | 'INVALID_API_KEY'
  | 'INVALID_RESPONSE'
  | 'METHOD_NOT_ALLOWED'
  | 'MISSING_API_KEY'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'

/** A failed, browser-safe response. It intentionally contains no upstream body or credential. */
export interface BalanceFailure {
  ok: false
  code: BalanceErrorCode
  message: string
}

export type BalanceApiResponse = BalanceSuccess | BalanceFailure
