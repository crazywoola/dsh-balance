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
