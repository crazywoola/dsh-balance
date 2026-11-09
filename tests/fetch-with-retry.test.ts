import { describe, expect, it } from 'vitest'
import { isRetryableStatus, retryAfterMs } from '../src/fetch-with-retry.ts'

describe('retry policy helpers', () => {
  it('retries only transient statuses', () => {
    expect([429, 500, 502, 503, 504].every(isRetryableStatus)).toBe(true)
    expect([200, 301, 400, 401, 403, 404, 408, 422].some(isRetryableStatus)).toBe(false)
  })

  it('parses Retry-After seconds and HTTP dates, capped and sanitized', () => {
    expect(retryAfterMs(new Response('', { headers: { 'retry-after': '3' } }), 5_000)).toBe(3_000)
    expect(retryAfterMs(new Response('', { headers: { 'retry-after': '120' } }), 5_000)).toBe(5_000)
    expect(retryAfterMs(new Response('', { headers: { 'retry-after': '-1' } }), 5_000)).toBeUndefined()
    expect(retryAfterMs(new Response('', { headers: { 'retry-after': 'soon' } }), 5_000)).toBeUndefined()
    expect(retryAfterMs(new Response('', { headers: { 'retry-after': new Date(Date.now() + 2_000).toUTCString() } }), 5_000)).toBeGreaterThan(0)
    expect(retryAfterMs(new Response('', { headers: {} }), 5_000)).toBeUndefined()
  })
})
