/** Shared retry policy for the idempotent GET upstream queries. */

/** Total attempts including the first: the initial call plus two retries. */
const DEFAULT_ATTEMPTS = 3
/** Delay before the first retry; doubles for each following retry. */
const DEFAULT_BASE_DELAY_MS = 300
/** Upper bound for a single delay, including a server-sent Retry-After. */
const DEFAULT_MAX_DELAY_MS = 5_000

export interface RetryPolicy {
  attempts: number
  baseDelayMs: number
  maxDelayMs: number
  /** Injected sleep, so tests never wait on real timers. */
  sleep: (ms: number) => Promise<void>
}

/** Partial policy overrides; an explicit undefined falls back to the default. */
export interface RetryOverrides {
  attempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  sleep?: ((ms: number) => Promise<void>) | undefined
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => { setTimeout(resolve, ms) })

/** Transient upstream statuses worth another attempt on an idempotent GET. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

/** Parse a Retry-After header (delay-seconds or HTTP-date) into capped milliseconds. */
export function retryAfterMs(response: Response, maxDelayMs: number): number | undefined {
  const header = response.headers.get('retry-after')
  if (header === null) return undefined
  const seconds = Number(header)
  const ms = header.trim() !== '' && Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1_000
    : Date.parse(header) - Date.now()
  if (!Number.isFinite(ms) || ms < 0) return undefined
  return Math.min(ms, maxDelayMs)
}

/**
 * Perform one idempotent GET, retrying transient upstream failures.
 *
 * The request factory rebuilds its options (including a fresh AbortSignal) on
 * every attempt, so each attempt carries its own timeout. Aborts and timeouts
 * propagate immediately; every other transport error is retried and then
 * rethrown for the caller's existing classification. A retryable final
 * response is returned as-is so the caller maps its status.
 */
export async function fetchWithRetry(request: () => Promise<Response>, policy: RetryOverrides = {}): Promise<Response> {
  const attempts = Math.max(1, Math.floor(policy.attempts ?? DEFAULT_ATTEMPTS))
  const baseDelayMs = Math.max(0, policy.baseDelayMs ?? DEFAULT_BASE_DELAY_MS)
  const maxDelayMs = Math.max(baseDelayMs, policy.maxDelayMs ?? DEFAULT_MAX_DELAY_MS)
  const sleep = policy.sleep ?? defaultSleep
  for (let attempt = 1; ; attempt++) {
    let response: Response
    try {
      response = await request()
    } catch (error) {
      if (isAbort(error) || attempt >= attempts) throw error
      await sleep(delayFor(attempt, baseDelayMs, maxDelayMs))
      continue
    }
    if (!isRetryableStatus(response.status) || attempt >= attempts) return response
    // Release the discarded body before the next attempt.
    void response.body?.cancel().catch(() => {})
    await sleep(retryAfterMs(response, maxDelayMs) ?? delayFor(attempt, baseDelayMs, maxDelayMs))
  }
}

function delayFor(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  return Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
}
