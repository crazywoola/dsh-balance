import { describe, expect, it, vi } from 'vitest'
import { BalanceQueryError, parseDeepSeekBalance, queryDeepSeekBalance } from '../src/balance.ts'

const fixture = {
  is_available: true,
  balance_infos: [{
    currency: 'CNY',
    total_balance: '110.00',
    granted_balance: '10.00',
    topped_up_balance: '100.00',
  }],
}

describe('parseDeepSeekBalance', () => {
  it('maps the documented snake_case response', () => {
    expect(parseDeepSeekBalance(fixture)).toEqual({
      isAvailable: true,
      balanceInfos: [{
        currency: 'CNY',
        totalBalance: '110.00',
        grantedBalance: '10.00',
        toppedUpBalance: '100.00',
      }],
    })
  })

  it('rejects malformed monetary fields', () => {
    expect(() => parseDeepSeekBalance({
      ...fixture,
      balance_infos: [{ ...fixture.balance_infos[0], total_balance: 'not-a-number' }],
    })).toThrowError(BalanceQueryError)
  })
})

describe('queryDeepSeekBalance', () => {
  it('calls /user/balance with a bearer credential', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(fixture), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch

    await expect(queryDeepSeekBalance({
      apiKey: 'test-secret',
      baseUrl: 'https://api.deepseek.com',
      timeoutMs: 1_000,
      fetchImpl,
    })).resolves.toEqual(parseDeepSeekBalance(fixture))

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] ?? []
    expect(String(url)).toBe('https://api.deepseek.com/user/balance')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-secret')
  })

  it('classifies an authentication failure without exposing its body', async () => {
    const fetchImpl = vi.fn(async () => new Response('secret upstream detail', { status: 401 })) as unknown as typeof fetch

    await expect(queryDeepSeekBalance({
      apiKey: 'bad-key',
      baseUrl: 'https://api.deepseek.com',
      timeoutMs: 1_000,
      fetchImpl,
    })).rejects.toMatchObject({ code: 'INVALID_API_KEY', httpStatus: 401 })
  })
})

describe('upstream retries', () => {
  const options = { apiKey: 'k', baseUrl: 'https://api.deepseek.com', timeoutMs: 1_000 }

  it('retries a rate-limited response and honors Retry-After', async () => {
    const sleeps: number[] = []
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '2' } }))
      .mockResolvedValueOnce(Response.json(fixture))
    await expect(queryDeepSeekBalance({ ...options, fetchImpl: fetchImpl as never, sleep: async ms => { sleeps.push(ms) } }))
      .resolves.toEqual(parseDeepSeekBalance(fixture))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleeps).toEqual([2_000])
  })

  it('retries transient network errors with exponential backoff', async () => {
    const sleeps: number[] = []
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(Response.json(fixture))
    await expect(queryDeepSeekBalance({ ...options, fetchImpl: fetchImpl as never, sleep: async ms => { sleeps.push(ms) } }))
      .resolves.toEqual(parseDeepSeekBalance(fixture))
    expect(sleeps).toEqual([300])
  })

  it('gives up after three attempts and classifies the last response', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 }))
    await expect(queryDeepSeekBalance({ ...options, fetchImpl: fetchImpl as never, sleep: async () => {} }))
      .rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', httpStatus: 502 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('never retries an authentication failure or a timeout', async () => {
    const auth = vi.fn(async () => new Response('', { status: 401 }))
    await expect(queryDeepSeekBalance({ ...options, fetchImpl: auth as never, sleep: async () => {} }))
      .rejects.toMatchObject({ code: 'INVALID_API_KEY' })
    expect(auth).toHaveBeenCalledOnce()
    const timeout = vi.fn(async () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }) })
    await expect(queryDeepSeekBalance({ ...options, fetchImpl: timeout as never, sleep: async () => {} }))
      .rejects.toMatchObject({ code: 'UPSTREAM_TIMEOUT' })
    expect(timeout).toHaveBeenCalledOnce()
  })
})
