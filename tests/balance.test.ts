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
