import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { SESSION_FORMAT_VERSION, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import { ADVICE_ROUTE, apply } from '../src/index.ts'

function event(type: string, data: unknown, seq: number, at = '2026-09-10T04:00:00Z'): SessionEvent {
  return { type, data, seq, time: Date.parse(at) } as SessionEvent
}

function makeSession(id = 'live-session'): { header: SessionHeader; events: SessionEvent[] } {
  const header: SessionHeader = {
    version: SESSION_FORMAT_VERSION,
    id: SessionId(id),
    createdAt: Date.parse('2026-09-10T04:00:00Z'),
    isSeeded: false,
  }
  const events = [
    event('request/header', { header: { config: { provider: 'deepseek', model: 'deepseek-flash' } }, reason: 'initial' }, 0),
    event('step/start', { turn: 1, step: 0 }, 1),
    event('assistant/message', {
      turn: 1,
      step: 0,
      message: { content: 'SECRET_PROMPT_BODY should never leave the Host compact records' },
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 },
    }, 2, '2026-09-10T04:00:01Z'),
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

function host(options?: {
  resolve?: (ref: unknown) => Promise<{ value: string } | undefined>
  sessions?: { header: SessionHeader; events: SessionEvent[]; revision?: string }[]
  usdToCny?: number
  allowRemote?: boolean
}) {
  const session: { header: SessionHeader; events: SessionEvent[]; revision?: string }[] = options?.sessions ?? [makeSession()]
  const routes = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>()
  const close = vi.fn(async () => {})
  const open = vi.fn(async (id: string) => {
    const match = session.find(item => String(item.header.id) === String(id)) ?? session[0]!
    return { id, header: match.header, inheritedEventCount: 0, read: async () => ({ events: match.events }), close }
  })
  const ctx = {
    credentials: { resolve: options?.resolve ?? vi.fn(async () => undefined) },
    sessionPersistence: {
      list: async () => session.map(item => ({ header: item.header, revision: item.revision ?? 'r1' })),
      open,
    },
    webServer: { register: vi.fn(({ path, handler }: { path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> }) => { routes.set(path, handler) }) },
    effect: (factory: () => unknown) => factory(),
    logger: { warn: vi.fn() },
  } as unknown as Context
  apply(ctx, {
    apiKeyRef: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com',
    timeoutMs: 1000,
    cacheMs: 30_000,
    allowRemote: options?.allowRemote ?? false,
    ...(options?.usdToCny === undefined ? {} : { usdToCny: options.usdToCny }),
  })
  return { handler: routes.get(ADVICE_ROUTE)!, routes, open, close, ctx }
}

describe('advice Host route', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T04:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a next-turn estimate without prompt text and prices configured official models', async () => {
    const { handler, close } = host({
      resolve: vi.fn(async () => ({ value: 'sk-never-appear-in-advice' })),
    })
    const res = response()
    await handler({ method: 'GET', url: `${ADVICE_ROUTE}?session=live-session`, headers: { host: '127.0.0.1' } } as IncomingMessage, res.result)
    const value = res.value()
    expect(value).toMatchObject({
      ok: true,
      estimateOnly: true,
      sessionId: 'live-session',
      currentPeriod: 'off-peak',
      sampleSize: 1,
      tokenShape: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 },
    })
    expect(value.now).toMatchObject({ model: 'deepseek-flash', costUsd: 0.753, combinedCny: null, pricingVersion: 'deepseek-flash-2026-09-10' })
    expect(value.fresh).toMatchObject({ costUsd: 0.9 })
    expect((value.alternatives as { model: string }[]).some(item => item.model === 'deepseek-v4-pro')).toBe(true)
    const body = JSON.stringify(value)
    expect(body).not.toContain('SECRET_PROMPT_BODY')
    expect(body).not.toContain('sk-never-appear-in-advice')
    expect(body).not.toMatch(/prompt/i)
    expect(value).not.toHaveProperty('requests')
    expect(value).not.toHaveProperty('events')
    expect(close).toHaveBeenCalledOnce()
  })

  it('accepts sessionId, applies usdToCny on the Host, and omits unpriced compare models', async () => {
    const { handler } = host({ usdToCny: 7 })
    const res = response()
    await handler({
      method: 'GET',
      url: `${ADVICE_ROUTE}?sessionId=live-session&provider=deepseek&model=deepseek-flash&compare=deepseek:mystery-model`,
      headers: { host: '127.0.0.1' },
    } as IncomingMessage, res.result)
    const value = res.value()
    expect(value).toMatchObject({ ok: true })
    expect((value.now as { combinedCny: number }).combinedCny).toBe(0.753 * 7)
    expect(JSON.stringify(value.alternatives)).not.toContain('mystery-model')
    expect((value.caveats as string[]).includes('unpriced-omitted')).toBe(true)
  })

  it('rejects missing sessions, invalid methods, and non-loopback access without leaking storage errors', async () => {
    const { handler } = host()
    const missing = response()
    await handler({ method: 'GET', url: `${ADVICE_ROUTE}?session=missing`, headers: { host: '127.0.0.1' } } as IncomingMessage, missing.result)
    expect(missing.value()).toMatchObject({ ok: false, code: 'SESSION_NOT_FOUND' })

    const invalid = response()
    await handler({ method: 'GET', url: ADVICE_ROUTE, headers: { host: '127.0.0.1' } } as IncomingMessage, invalid.result)
    expect(invalid.value()).toMatchObject({ ok: false, code: 'INVALID_REQUEST' })

    const method = response()
    await handler({ method: 'POST', url: `${ADVICE_ROUTE}?session=live-session`, headers: { host: '127.0.0.1' } } as IncomingMessage, method.result)
    expect(method.value()).toMatchObject({ ok: false, code: 'METHOD_NOT_ALLOWED' })

    const remote = response()
    await handler({ method: 'GET', url: `${ADVICE_ROUTE}?session=live-session`, headers: { host: 'example.com' } } as IncomingMessage, remote.result)
    expect(remote.value()).toMatchObject({ ok: false, code: 'FORBIDDEN' })

    const close = vi.fn(async () => {})
    const routes = new Map<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>>()
    const failingCtx = {
      credentials: { resolve: vi.fn(async () => undefined) },
      sessionPersistence: {
        list: vi.fn(async () => [{ header: makeSession().header, revision: 'r1' }]),
        open: vi.fn(async () => ({ read: async () => { throw new Error('Bearer super-secret upstream body') }, close })),
      },
      webServer: { register: vi.fn(({ path, handler: route }: { path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> }) => { routes.set(path, route) }) },
      effect: (factory: () => unknown) => factory(),
      logger: { warn: vi.fn() },
    } as unknown as Context
    apply(failingCtx, { apiKeyRef: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com', timeoutMs: 1000, cacheMs: 30_000, allowRemote: false })
    const failed = response()
    await routes.get(ADVICE_ROUTE)!({ method: 'GET', url: `${ADVICE_ROUTE}?session=live-session`, headers: { host: '127.0.0.1' } } as IncomingMessage, failed.result)
    expect(failed.value()).toMatchObject({ ok: false, code: 'UPSTREAM_UNAVAILABLE' })
    expect(JSON.stringify(failed.value())).not.toContain('super-secret')
    expect(close).toHaveBeenCalledOnce()
  })
})
