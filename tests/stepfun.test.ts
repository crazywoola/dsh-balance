import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseStepFunBalance, queryProviderBalance } from '../src/balance.ts'
import { findBalanceProvider } from '../src/providers.ts'

const fixture = { object: 'account', type: 'prepaid', balance: 12.34, total_cash_balance: 100, total_voucher_balance: 26 }
const options = { apiKey: 'test-stepfun-secret', baseUrl: 'https://api.stepfun.com/v1', timeoutMs: 1000 }
afterEach(() => vi.unstubAllGlobals())

describe('StepFun adapter', () => {
  it.each(['StepFun', 'stepfun', 'STEPFUN', 'sTePfUn', ' StepFun '])('normalizes %s', (id) => {
    expect(findBalanceProvider(id)).toMatchObject({ id: 'stepfun', apiKeyRef: 'STEPFUN_API_KEY' })
  })

  it('keeps cumulative totals separate from the available balance', () => {
    expect(parseStepFunBalance(fixture)).toEqual({
      isAvailable: null,
      accountType: 'prepaid',
      balanceInfos: [{ currency: 'CNY', totalBalance: '12.34', totalCashBalance: '100', totalVoucherBalance: '26' }],
    })
  })

  it.each([0, -12.5])('does not infer postpaid service availability from balance %s', (balance) => {
    expect(parseStepFunBalance({ ...fixture, type: 'postpaid', balance })).toMatchObject({ isAvailable: null, accountType: 'postpaid' })
  })

  it.each([
    null, [], {}, { ...fixture, object: 'other' }, { ...fixture, type: 'unknown' },
    ...['balance', 'total_cash_balance', 'total_voucher_balance'].flatMap(key =>
      [undefined, null, '12.34', NaN, Infinity, true].map(value => ({ ...fixture, [key]: value }))),
  ])('rejects invalid account payloads %#', (payload) => {
    expect(() => parseStepFunBalance(payload)).toThrow(expect.objectContaining({ code: 'INVALID_RESPONSE' }))
  })

  it.each(['https://api.stepfun.com/v1', 'https://api.stepfun.com/v1/'])('queries accounts relative to %s', async (baseUrl) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(fixture))
    await queryProviderBalance('StepFun', { ...options, baseUrl, fetchImpl })
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('https://api.stepfun.com/v1/accounts')
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: 'GET', redirect: 'error', headers: { accept: 'application/json', authorization: 'Bearer test-stepfun-secret' } }))
  })

  it.each([[401, 'INVALID_API_KEY', 401], [403, 'INVALID_API_KEY', 401], [429, 'RATE_LIMITED', 429], [503, 'UPSTREAM_UNAVAILABLE', 502], [400, 'UPSTREAM_ERROR', 502]])('classifies HTTP %s', async (status, code, httpStatus) => {
    await expect(queryProviderBalance('stepfun', { ...options, fetchImpl: async () => new Response('private upstream body', { status: Number(status) }) })).rejects.toMatchObject({ code, httpStatus })
  })

  it.each([['TimeoutError', 'UPSTREAM_TIMEOUT'], ['AbortError', 'UPSTREAM_TIMEOUT'], ['TypeError', 'UPSTREAM_UNAVAILABLE']])('classifies %s', async (name, code) => {
    await expect(queryProviderBalance('stepfun', { ...options, fetchImpl: async () => { throw new DOMException('private detail', name) } })).rejects.toMatchObject({ code })
  })

  it('rejects malformed JSON and unknown providers', async () => {
    const fetchImpl = vi.fn(async () => new Response('{bad'))
    await expect(queryProviderBalance('stepfun', { ...options, fetchImpl })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    fetchImpl.mockClear()
    await expect(queryProviderBalance('unknown', { ...options, fetchImpl })).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

it('classifies timeouts while reading the response body', async () => {
  const response = new Response()
  vi.spyOn(response, 'json').mockRejectedValue(new DOMException('aborted', 'AbortError'))
  await expect(queryProviderBalance('stepfun', { ...options, fetchImpl: async () => response })).rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT', httpStatus: 504 })
})
