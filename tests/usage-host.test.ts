import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import { apply } from '../src/index.ts'

function event(type: string, data: unknown, seq: number, at = '2026-08-17T00:00:00Z'): SessionEvent {
  return { type, data, seq, time: Date.parse(at) } as SessionEvent
}

function makeSession(): { header: SessionHeader; events: SessionEvent[] } {
  const header = { version: 0, id: 'live-session', createdAt: Date.parse('2026-08-17T00:00:00Z'), seedLength: 0 } as SessionHeader
  const events = [
    event('request/header', { header: { config: { provider: 'deepseek', model: 'deepseek-v4-flash' } }, reason: 'initial' }, 0),
    event('step/start', { turn: 1, step: 0 }, 1),
    event('assistant/message', { turn: 1, step: 0, message: {}, usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } }, 2, '2026-08-17T00:00:01Z'),
  ]
  return { header, events }
}

function response(): { value: () => Record<string, unknown>; result: ServerResponse } {
  let body = ''
  const result = {
    setHeader: vi.fn(),
    writeHead: vi.fn(),
    end: vi.fn((value?: string) => { body = value ?? '' }),
  }
  return { value: () => JSON.parse(body) as Record<string, unknown>, result: result as unknown as ServerResponse }
}

describe('usage Host route', () => {
  it('prefers inspection data, caches by revision, and invalidates after a revision change', async () => {
    const session = makeSession()
    let revision = 'r1'
    const routes = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>()
    const inspect = vi.fn(async () => ({ meta: session.header, events: session.events }))
    const listSnapshots = vi.fn(async () => [{ header: session.header, revision }])
    const ctx = {
      credentials: { resolve: vi.fn() },
      sessionPersistence: { listSnapshots, inspect },
      webServer: { register: vi.fn(({ path, handler }: { path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> }) => { routes.set(path, handler) }) },
      effect: (factory: () => unknown) => factory(),
      logger: { warn: vi.fn() },
    } as unknown as Context

    apply(ctx, { apiKeyRef: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com', timeoutMs: 1000, cacheMs: 30_000, allowRemote: false })
    const handler = routes.get('/dsh-balance/api/usage')!
    const request = (url: string) => ({ method: 'GET', url, headers: { host: '127.0.0.1:3080' } }) as unknown as IncomingMessage

    const first = response()
    await handler(request('/dsh-balance/api/usage?scope=all&timeZone=UTC'), first.result)
    expect(first.value()).toMatchObject({ ok: true, scope: 'all', source: 'live' })
    expect(inspect).toHaveBeenCalledOnce()

    const second = response()
    await handler(request('/dsh-balance/api/usage?scope=all&timeZone=UTC'), second.result)
    expect(second.value()).toMatchObject({ ok: true, source: 'cache' })
    expect(inspect).toHaveBeenCalledOnce()

    revision = 'r2'
    const third = response()
    await handler(request('/dsh-balance/api/usage?scope=session&sessionId=live-session&timeZone=UTC&refresh=1'), third.result)
    expect(third.value()).toMatchObject({ ok: true, scope: 'session', source: 'live' })
    expect(inspect).toHaveBeenCalledTimes(2)
    expect(listSnapshots).toHaveBeenCalledTimes(3)
  })

  it('rejects invalid timezone and does not expose any credential or upstream body', async () => {
    const session = makeSession()
    const routes = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>()
    const ctx = {
      credentials: { resolve: vi.fn() },
      sessionPersistence: {
        listSnapshots: vi.fn(async () => [{ header: session.header, revision: 'r1' }]),
        inspect: vi.fn(async () => { throw new Error('Bearer super-secret upstream body') }),
      },
      webServer: { register: vi.fn(({ path, handler }: { path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> }) => { routes.set(path, handler) }) },
      effect: (factory: () => unknown) => factory(),
      logger: { warn: vi.fn() },
    } as unknown as Context
    apply(ctx, { apiKeyRef: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com', timeoutMs: 1000, cacheMs: 30_000, allowRemote: false })
    const handler = routes.get('/dsh-balance/api/usage')!

    const invalid = response()
    await handler({ method: 'GET', url: '/dsh-balance/api/usage?timeZone=Not%2FAZone', headers: { host: '127.0.0.1' } } as unknown as IncomingMessage, invalid.result)
    expect(invalid.value()).toMatchObject({ ok: false, code: 'INVALID_REQUEST' })

    const failed = response()
    await handler({ method: 'GET', url: '/dsh-balance/api/usage?timeZone=UTC', headers: { host: '127.0.0.1' } } as unknown as IncomingMessage, failed.result)
    const value = failed.value()
    expect(value).toMatchObject({ ok: false, code: 'UPSTREAM_UNAVAILABLE' })
    expect(JSON.stringify(value)).not.toContain('super-secret')
  })
})
