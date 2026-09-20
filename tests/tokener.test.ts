import { describe, expect, it, vi } from 'vitest'
import { parseTokenerBalance, queryProviderBalance } from '../src/balance.ts'
import { findBalanceProvider } from '../src/providers.ts'

const fixture = {
  availableUsdMicro: '12000001', purchasedAvailableUsdMicro: '10000000',
  grantedAvailableUsdMicro: '2000001', status: 'active', updatedAt: null,
}

describe('Tokener adapter', () => {
  it('uses USD millionths and remaining purchased / granted balances', () => {
    expect(findBalanceProvider(' ToKeNeR ')?.id).toBe('tokener')
    expect(parseTokenerBalance(fixture)).toEqual({ isAvailable: true, balanceInfos: [{
      currency: 'USD', totalBalance: '12.000001', toppedUpBalance: '10.000000', grantedBalance: '2.000001',
    }] })
    expect(parseTokenerBalance({ ...fixture, availableUsdMicro: '9007199254740993' }).balanceInfos[0]?.totalBalance).toBe('9007199254.740993')
    expect(parseTokenerBalance({ ...fixture, availableUsdMicro: '-1' }).balanceInfos[0]?.totalBalance).toBe('-0.000001')
  })

  it.each([{ availableUsdMicro: '0' }, { availableUsdMicro: '-123' }, { status: 'suspended' }])('reports unavailable for %j', (override) => {
    expect(parseTokenerBalance({ ...fixture, ...override }).isAvailable).toBe(false)
  })

  it.each([{}, { ...fixture, status: 'unknown' }, ...['availableUsdMicro', 'purchasedAvailableUsdMicro', 'grantedAvailableUsdMicro'].flatMap(key =>
    [undefined, null, 10, '1.5', '1e6', '', true].map(value => ({ ...fixture, [key]: value })))])('rejects invalid wire payload %#', (value) => {
    expect(() => parseTokenerBalance(value)).toThrow(expect.objectContaining({ code: 'INVALID_RESPONSE' }))
  })

  it('uses the management endpoint and Bearer authentication without following redirects', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(fixture))
    await queryProviderBalance('Tokener', { baseUrl: 'https://console.tokener.ai/api/v1', apiKey: 'test-pat', timeoutMs: 1000, fetchImpl })
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('https://console.tokener.ai/api/v1/billing/balance')
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error', headers: { authorization: 'Bearer test-pat' } })
  })
})
