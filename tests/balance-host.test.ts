import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index.ts'
import type { Config } from '../src/index.ts'

const deepseek = { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '110', granted_balance: '10', topped_up_balance: '100' }] }
const stepfun = { object: 'account', type: 'postpaid', balance: 0, total_cash_balance: 25, total_voucher_balance: 26 }

function setup(overrides: Partial<Config> = {}, route = '/dsh-balance/api/balance') {
  const routes = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>()
  const resolve = vi.fn(async (ref: string) => ({ value: `${ref}-secret`, source: 'test' }))
  const warn = vi.fn()
  apply({
    credentials: { resolve },
    logger: { warn },
    effect: (fn: () => unknown) => fn(),
    webServer: { register: ({ path, handler }: { path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> }) => { routes.set(path, handler) } },
  } as unknown as Context, { apiKeyRef: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com', timeoutMs: 1000, cacheMs: 30_000, allowRemote: false, ...overrides })
  return {
    resolve, warn,
    request: async (query = '', method = 'GET', host = 'localhost') => {
      let status = 0
      let body = ''
      await routes.get(route)!({ method, url: `${route}${query}`, headers: { host } } as IncomingMessage, {
        setHeader: vi.fn(),
        writeHead: (value: number) => { status = value },
        end: (value: string) => { body = value },
      } as unknown as ServerResponse)
      return { status, body: JSON.parse(body) }
    },
  }
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('provider balance route', () => {
  it('isolates caches and credentials, preserves the default route, and supports refresh and expiry', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(async (url: URL) => Response.json(url.hostname === 'api.stepfun.com' ? stepfun : deepseek))
    vi.stubGlobal('fetch', fetchImpl)
    const { request, resolve } = setup()
    expect((await request()).body).toMatchObject({ provider: 'deepseek', source: 'live' })
    expect((await request('?provider=StepFun')).body).toMatchObject({ provider: 'stepfun', source: 'live', accountType: 'postpaid', isAvailable: null })
    expect(resolve.mock.calls.map(([ref]) => ref)).toEqual(['DEEPSEEK_API_KEY', 'STEPFUN_API_KEY'])
    expect((await request('?provider=STEPFUN')).body.source).toBe('cache')
    expect((await request()).body.source).toBe('cache')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect((await request('?provider=stepfun&refresh=1')).body.source).toBe('live')
    expect((await request()).body.source).toBe('cache')
    vi.advanceTimersByTime(30_001)
    expect((await request('?provider=stepfun')).body.source).toBe('live')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('uses explicit provider overrides with case-insensitive IDs', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(stepfun))
    vi.stubGlobal('fetch', fetchImpl)
    const { request, resolve } = setup({ providers: [{ id: 'StepFun', apiKeyRef: 'CUSTOM_STEP_KEY', baseUrl: 'http://127.0.0.1:3091/v1' }] })
    expect((await request('?provider=sTePfUn')).status).toBe(200)
    expect(resolve).toHaveBeenCalledWith('CUSTOM_STEP_KEY')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('http://127.0.0.1:3091/v1/accounts')
  })

  it('returns safe failures for missing credentials, resolution errors and upstream rejection', async () => {
    const { request, resolve, warn } = setup()
    resolve.mockResolvedValueOnce(undefined as never)
    expect(await request('?provider=stepfun')).toMatchObject({ status: 401, body: { code: 'MISSING_API_KEY' } })
    resolve.mockRejectedValueOnce(new Error('private-secret'))
    expect(await request('?provider=stepfun')).toMatchObject({ status: 502, body: { code: 'UPSTREAM_ERROR' } })
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-secret')
    vi.stubGlobal('fetch', async () => new Response('private-secret', { status: 401 }))
    const response = await request('?provider=stepfun')
    expect(response).toMatchObject({ status: 401, body: { code: 'INVALID_API_KEY' } })
    expect(JSON.stringify(response)).not.toContain('private-secret')
  })

  it('rejects unknown providers, non-GET and remote requests before resolving credentials', async () => {
    const { request, resolve } = setup()
    expect((await request('?provider=other')).status).toBe(400)
    expect((await request('', 'POST')).status).toBe(405)
    expect((await request('', 'GET', 'example.com')).status).toBe(403)
    expect(resolve).not.toHaveBeenCalled()
  })

  it('tracks in-process balance history and flags configured low balances', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({ ...deepseek, balance_infos: [{ currency: 'CNY', total_balance: '110', granted_balance: '10', topped_up_balance: '100' }] }))
      .mockResolvedValueOnce(Response.json({ ...deepseek, balance_infos: [{ currency: 'CNY', total_balance: '50', granted_balance: '10', topped_up_balance: '100' }] }))
    vi.stubGlobal('fetch', fetchImpl)
    // Threshold currencies compare case-insensitively against the provider response.
    const { request } = setup({ lowBalance: [{ currency: 'cny', amount: 100 }] })
    expect((await request()).body.history).toBeUndefined()
    vi.advanceTimersByTime(30_001)
    const second = (await request()).body
    expect(second.history).toHaveLength(2)
    expect(second.history[1].balances).toEqual([{ currency: 'CNY', totalBalance: '50' }])
    expect(second.lowBalance).toEqual([{ currency: 'CNY', totalBalance: '50', amount: 100 }])
    // Cached responses keep the trend and the warning without re-querying.
    const cached = (await request()).body
    expect(cached.source).toBe('cache')
    expect(cached.history).toHaveLength(2)
    expect(cached.lowBalance).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('omits history and low-balance warnings without configuration or observations', async () => {
    vi.stubGlobal('fetch', async () => Response.json(deepseek))
    const { request } = setup()
    const body = (await request()).body
    expect(body.history).toBeUndefined()
    expect(body.lowBalance).toBeUndefined()
  })

  it('returns effective per-model prices with configured overrides applied', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ object: 'list', data: [{ id: 'deepseek-v4-flash', object: 'model', owned_by: 'deepseek' }] }))
    const builtIn = (await setup({}, '/dsh-balance/api/models').request()).body
    expect(builtIn.prices).toContainEqual(expect.objectContaining({ model: 'deepseek-v4-flash', cacheMissUsdPerMillion: 0.15 }))

    const overridden = (await setup({ pricingOverrides: [{ provider: 'DeepSeek', model: 'deepseek-v4-flash', cacheMissUsdPerMillion: 0.01, cacheHitUsdPerMillion: 0, outputUsdPerMillion: 0.02 }] }, '/dsh-balance/api/models').request()).body
    const flash = overridden.prices.find((price: { model: string }) => price.model === 'deepseek-v4-flash')
    expect(flash).toMatchObject({ provider: 'deepseek', cacheMissUsdPerMillion: 0.01, pricingVersion: 'pricing-override' })
    expect(overridden.prices.filter((price: { model: string }) => price.model === 'deepseek-v4-flash')).toHaveLength(1)
  })

  it('validates overrides before registering routes', () => {
    expect(() => setup({ providers: [{ id: 'stepfun', baseUrl: 'http://example.com/v1' }] })).toThrow('HTTPS')
    expect(() => setup({ providers: [{ id: 'StepFun' }, { id: 'STEPFUN' }] })).toThrow('duplicate')
    expect(() => setup({ providers: [{ id: 'unknown' }] })).toThrow('unsupported')
  })
})

describe('provider models route', () => {
  it('uses separate credentials and caches for each provider and supports refresh', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(async (url: URL) => Response.json({ object: 'list', data: [{ object: 'model', id: url.hostname === 'api.stepfun.com' ? 'step-3.5-flash' : 'deepseek-v4-flash', owned_by: url.hostname }] }))
    vi.stubGlobal('fetch', fetchImpl)
    const { request, resolve } = setup({}, '/dsh-balance/api/models')
    expect((await request()).body).toMatchObject({ provider: 'deepseek', source: 'live', models: [{ id: 'deepseek-v4-flash' }] })
    expect((await request('?provider=StepFun')).body).toMatchObject({ provider: 'stepfun', source: 'live', models: [{ id: 'step-3.5-flash' }] })
    expect(resolve.mock.calls.map(([ref]) => ref)).toEqual(['DEEPSEEK_API_KEY', 'STEPFUN_API_KEY'])
    expect((await request('?provider=STEPFUN')).body).toMatchObject({ source: 'cache', models: [{ id: 'step-3.5-flash' }] })
    expect((await request()).body).toMatchObject({ source: 'cache', models: [{ id: 'deepseek-v4-flash' }] })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect((await request('?provider=stepfun&refresh=1')).body.source).toBe('live')
    vi.advanceTimersByTime(30_001)
    expect((await request('?provider=stepfun')).body.source).toBe('live')
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('honors provider overrides and rejects bad requests before reading credentials', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ object: 'list', data: [] }))
    vi.stubGlobal('fetch', fetchImpl)
    const { request, resolve } = setup({ providers: [{ id: 'StepFun', apiKeyRef: 'STEP_CUSTOM', baseUrl: 'http://localhost:3091/v1/' }] }, '/dsh-balance/api/models')
    expect((await request('?provider=other')).status).toBe(400)
    expect((await request('', 'POST')).status).toBe(405)
    expect((await request('', 'GET', 'example.com')).status).toBe(403)
    expect(resolve).not.toHaveBeenCalled()
    expect((await request('?provider=StepFun')).status).toBe(200)
    expect(resolve).toHaveBeenCalledWith('STEP_CUSTOM')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('http://localhost:3091/v1/models')
  })

  it('handles missing and failing credentials without exposing secrets or using another provider', async () => {
    const { request, resolve, warn } = setup({}, '/dsh-balance/api/models')
    resolve.mockResolvedValueOnce(undefined as never)
    expect(await request('?provider=stepfun')).toMatchObject({ status: 401, body: { code: 'MISSING_API_KEY' } })
    resolve.mockRejectedValueOnce(new Error('private-secret'))
    const result = await request('?provider=stepfun')
    expect(result).toMatchObject({ status: 502, body: { code: 'UPSTREAM_ERROR' } })
    expect(JSON.stringify([result, warn.mock.calls])).not.toContain('private-secret')
  })
})

describe('official DeepSeek provider ID', () => {
  it.each(['/dsh-balance/api/balance', '/dsh-balance/api/models'])('shares credentials and cache across aliases on %s', async (route) => {
    const payload = route.endsWith('/balance') ? deepseek : { object: 'list', data: [{ object: 'model', id: 'deepseek-flash', owned_by: 'deepseek' }] }
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(payload))
    vi.stubGlobal('fetch', fetchImpl)
    const { request, resolve } = setup({}, route)
    expect(await request('?provider=deepseek-official')).toMatchObject({ status: 200, body: { provider: 'deepseek', source: 'live' } })
    expect(resolve).toHaveBeenCalledWith('DEEPSEEK_API_KEY')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(`https://api.deepseek.com/${route.endsWith('/balance') ? 'user/balance' : 'models'}`)
    for (const provider of ['deepseek', 'DEEPSEEK-OFFICIAL', ' deepseek-official ']) {
      expect((await request(`?provider=${encodeURIComponent(provider)}`)).body).toMatchObject({ provider: 'deepseek', source: 'cache' })
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect((await request('?provider=deepseek-official&refresh=1')).body.source).toBe('live')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect((await request('?provider=deepseek-proxy')).body.code).toBe('UNSUPPORTED_PROVIDER')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('accepts official ID overrides and prevents ambiguous duplicate configuration', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(deepseek))
    vi.stubGlobal('fetch', fetchImpl)
    const { request, resolve } = setup({ providers: [{ id: 'DEEPSEEK-OFFICIAL', apiKeyRef: 'OFFICIAL_KEY', baseUrl: 'http://localhost:3091' }] })
    expect((await request('?provider=deepseek')).status).toBe(200)
    expect(resolve).toHaveBeenCalledWith('OFFICIAL_KEY')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('http://localhost:3091/user/balance')
    expect(() => setup({ providers: [{ id: 'deepseek' }, { id: 'deepseek-official' }] })).toThrow('duplicate')
  })
})

describe('Tokener Host routes', () => {
  it('queries documented models with isolated credentials/cache, including aliases and overrides', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({ object: 'list', data: [{ object: 'model', id: 'gpt-5.4', owned_by: 'openai' }] }))
    vi.stubGlobal('fetch', fetchImpl)
    const { request, resolve } = setup({}, '/dsh-balance/api/models')
    expect(await request('?provider=Tokener')).toMatchObject({ status: 200, body: { provider: 'tokener', source: 'live', models: [{ id: 'gpt-5.4' }] } })
    expect(resolve).toHaveBeenCalledWith('TOKENER_API_KEY')
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('https://api.tokener.ai/v1/models')
    expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer TOKENER_API_KEY-secret')
    expect((await request('?provider=TOKENER.AI')).body.source).toBe('cache')
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(JSON.stringify((await request('?provider=tokener')).body)).not.toContain('secret')
    await request('?provider=stepfun')
    expect(resolve).toHaveBeenLastCalledWith('STEPFUN_API_KEY')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const custom = setup({ providers: [{ id: 'Tokener.ai', apiKeyRef: 'CUSTOM_TOKENER', baseUrl: 'http://localhost:3091/v1' }] }, '/dsh-balance/api/models')
    await custom.request('?provider=tokener')
    expect(custom.resolve).toHaveBeenCalledWith('CUSTOM_TOKENER')
    expect(String(fetchImpl.mock.calls[2]?.[0])).toBe('http://localhost:3091/v1/models')
  })

  it('does not read credentials or invent a balance endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchImpl)
    const { request, resolve } = setup()
    expect(await request('?provider=Tokener')).toMatchObject({ status: 400, body: { code: 'BALANCE_NOT_SUPPORTED' } })
    expect(resolve).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
