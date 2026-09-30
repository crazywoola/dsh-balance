import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { SESSION_FORMAT_VERSION, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import { apply } from '../src/index.ts'

function event(type: string, data: unknown, seq: number, at = '2026-08-17T00:00:00Z'): SessionEvent {
  return { type, data, seq, time: Date.parse(at) } as SessionEvent
}

function makeSession(): { header: SessionHeader; events: SessionEvent[] } {
  const header: SessionHeader = { version: SESSION_FORMAT_VERSION, id: SessionId('live-session'), createdAt: Date.parse('2026-08-17T00:00:00Z'), isSeeded: false }
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
  it.each(['open', 'read', 'close'] as const)('keeps readable sessions when another session fails to %s and retries partial results', async (failureStage) => {
    const good = makeSession()
    const badId = SessionId('unreadable-session')
    let broken = true
    const close = vi.fn(async () => {})
    const badClose = vi.fn(async () => {
      if (broken && failureStage === 'close') throw new Error('private storage details')
    })
    const open = vi.fn(async (id: string) => {
      if (id === badId && broken && failureStage === 'open') throw new Error('unsupported historical descriptor')
      return {
        id,
        inheritedEventCount: 0,
        read: async () => {
          if (id === badId && broken && failureStage === 'read') throw new Error('private storage details')
          return { events: good.events }
        },
        close: id === badId ? badClose : close,
      }
    })
    let handler!: (req: IncomingMessage, res: ServerResponse) => Promise<void>
    const ctx = {
      credentials: { resolve: vi.fn() },
      sessionPersistence: {
        list: async () => [
          { header: good.header, revision: 'unchanged' },
          { header: { ...good.header, id: badId }, revision: 'unchanged' },
        ],
        open,
      },
      webServer: { register: ({ path, handler: route }: { path: string; handler: typeof handler }) => {
        if (path === '/dsh-balance/api/usage') handler = route
      } },
      effect: (factory: () => unknown) => factory(),
      logger: { warn: vi.fn() },
    } as unknown as Context
    apply(ctx, { apiKeyRef: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com', timeoutMs: 1000, cacheMs: 30_000, allowRemote: false })
    const request = (query = '') => ({ method: 'GET', url: `/dsh-balance/api/usage?timeZone=UTC${query}`, headers: { host: '127.0.0.1' } }) as IncomingMessage
    const partial = response()
    await handler(request(), partial.result)
    expect(partial.value()).toMatchObject({ ok: true, coverage: { readSessions: 1, skippedSessions: 1 }, summary: { totals: { requests: 1, inputTokens: 1_000_000 } } })
    expect(JSON.stringify(partial.value())).not.toContain('private storage details')
    expect(close).toHaveBeenCalledOnce()
    if (failureStage !== 'open') expect(badClose).toHaveBeenCalledOnce()

    const selected = response()
    await handler(request('&scope=session&sessionId=unreadable-session'), selected.result)
    expect(selected.value()).toMatchObject({ ok: false, code: 'UPSTREAM_UNAVAILABLE' })

    broken = false
    const recovered = response()
    await handler(request(), recovered.result)
    expect(recovered.value()).toMatchObject({ ok: true, source: 'live', coverage: { readSessions: 2, skippedSessions: 0 }, summary: { totals: { requests: 2, inputTokens: 2_000_000 } } })
    const cached = response()
    await handler(request(), cached.result)
    expect(cached.value()).toMatchObject({ source: 'cache', coverage: { readSessions: 2, skippedSessions: 0 } })
    expect(open).toHaveBeenCalledTimes(5)
  })

  it('reads through a read-only handle, caches by revision, and invalidates after a revision change', async () => {
    const session = makeSession()
    let revision = 'r1'
    const routes = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>()
    const close = vi.fn(async () => {})
    const open = vi.fn(async () => ({ id: session.header.id, header: session.header, inheritedEventCount: 0, read: async () => ({ events: session.events }), close }))
    const list = vi.fn(async () => [{ header: session.header, revision }])
    const ctx = {
      credentials: { resolve: vi.fn() },
      sessionPersistence: { list, open },
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
    expect(open).toHaveBeenCalledOnce()

    const second = response()
    await handler(request('/dsh-balance/api/usage?scope=all&timeZone=UTC'), second.result)
    expect(second.value()).toMatchObject({ ok: true, source: 'cache' })
    expect(open).toHaveBeenCalledOnce()

    revision = 'r2'
    const third = response()
    await handler(request('/dsh-balance/api/usage?scope=session&sessionId=live-session&timeZone=UTC&refresh=1'), third.result)
    expect(third.value()).toMatchObject({ ok: true, scope: 'session', source: 'live' })
    expect(open).toHaveBeenCalledTimes(2)
    expect(open).toHaveBeenLastCalledWith(session.header.id, 'read')
    expect(close).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenCalledTimes(3)
    const fourth = response()
    await handler(request('/dsh-balance/api/usage?scope=session&sessionId=live-session&timeZone=UTC'), fourth.result)
    expect(fourth.value()).toMatchObject({ ok: true, scope: 'session', source: 'cache' })
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('excludes the inherited event prefix reported by the storage handle', async () => {
    const session = makeSession()
    const close = vi.fn(async () => {})
    let handler!: (req: IncomingMessage, res: ServerResponse) => Promise<void>
    const ctx = {
      credentials: { resolve: vi.fn() },
      sessionPersistence: {
        list: async () => [{ header: { ...session.header, isSeeded: true }, revision: 'fork' }],
        open: async () => ({
          id: session.header.id,
          inheritedEventCount: session.events.length,
          read: async () => ({ events: session.events }),
          close,
        }),
      },
      webServer: { register: ({ path, handler: route }: { path: string; handler: typeof handler }) => {
        if (path === '/dsh-balance/api/usage') handler = route
      } },
      effect: (factory: () => unknown) => factory(),
      logger: { warn: vi.fn() },
    } as unknown as Context
    apply(ctx, { apiKeyRef: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com', timeoutMs: 1000, cacheMs: 0, allowRemote: false })
    const res = response()
    await handler({ method: 'GET', url: '/dsh-balance/api/usage?timeZone=UTC', headers: { host: '127.0.0.1' } } as IncomingMessage, res.result)
    expect(res.value()).toMatchObject({ ok: true, summary: { totals: { requests: 0, costUsd: 0 } } })
    expect(close).toHaveBeenCalledOnce()
  })

  it('closes handles after read failures and rejects invalid timezone without exposing upstream errors', async () => {
    const close = vi.fn(async () => {})
    const session = makeSession()
    const routes = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>()
    const ctx = {
      credentials: { resolve: vi.fn() },
      sessionPersistence: {
        list: vi.fn(async () => [{ header: session.header, revision: 'r1' }]),
        open: vi.fn(async () => ({ read: async () => { throw new Error('Bearer super-secret upstream body') }, close })),
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
    expect(close).toHaveBeenCalledOnce()
  })
})
