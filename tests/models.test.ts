import { describe, expect, it, vi } from 'vitest'
import { ModelQueryError, parseModel, parseDeepSeekModels, queryDeepSeekModels, queryProviderModels } from '../src/models.ts'

const fixture = {
  object: 'list',
  data: [
    { id: 'deepseek-v4-flash', object: 'model', owned_by: 'deepseek' },
    { id: 'deepseek-v4-pro', object: 'model', owned_by: 'deepseek' },
  ],
}

describe('parseDeepSeekModels', () => {
  it('maps the documented model-list response', () => {
    expect(parseDeepSeekModels(fixture)).toEqual({
      models: [
        { id: 'deepseek-v4-flash', ownedBy: 'deepseek' },
        { id: 'deepseek-v4-pro', ownedBy: 'deepseek' },
      ],
    })
  })

  it('rejects malformed model entries', () => {
    expect(() => parseDeepSeekModels({
      ...fixture,
      data: [{ id: '', object: 'model', owned_by: 'deepseek' }],
    })).toThrowError(ModelQueryError)
  })
})

describe('queryDeepSeekModels', () => {
  it('calls /models with a bearer credential', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(fixture), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch

    await expect(queryDeepSeekModels({
      apiKey: 'test-secret',
      baseUrl: 'https://api.deepseek.com',
      timeoutMs: 1_000,
      fetchImpl,
    })).resolves.toEqual(parseDeepSeekModels(fixture))

    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] ?? []
    expect(String(url)).toBe('https://api.deepseek.com/models')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-secret')
  })

  it('classifies authentication failures without exposing the upstream body', async () => {
    const fetchImpl = vi.fn(async () => new Response('secret upstream detail', { status: 401 })) as unknown as typeof fetch

    await expect(queryDeepSeekModels({
      apiKey: 'bad-key',
      baseUrl: 'https://api.deepseek.com',
      timeoutMs: 1_000,
      fetchImpl,
    })).rejects.toMatchObject({ code: 'INVALID_API_KEY', httpStatus: 401 })
  })
})

describe('StepFun models', () => {
  const stepfun = { object: 'list', data: [{ id: 'step-3.5-flash', object: 'model', created: 1713974400, owned_by: 'stepai' }] }
  const options = { apiKey: 'stepfun-test-key', baseUrl: 'https://api.stepfun.com/v1', timeoutMs: 1000 }

  it.each(['StepFun', 'stepfun', 'STEPFUN'])('queries the official list API for %s and parses Model objects', async (provider) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(stepfun))
    const result = await queryProviderModels(provider, { ...options, fetchImpl })
    expect(result.models).toEqual([{ id: 'step-3.5-flash', ownedBy: 'stepai', created: 1713974400 }])
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe('https://api.stepfun.com/v1/models')
    expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer stepfun-test-key')
  })

  it.each([null, '1713974400', NaN, Infinity, -1, 1.5, 8_640_000_000_001])('rejects invalid creation timestamps %s', (created) => {
    expect(() => parseModel({ ...stepfun.data[0], created })).toThrow(ModelQueryError)
  })

  it.each([[401, 'INVALID_API_KEY'], [429, 'RATE_LIMITED'], [503, 'UPSTREAM_UNAVAILABLE']])('classifies StepFun HTTP %s safely', async (status, code) => {
    await expect(queryProviderModels('stepfun', { ...options, fetchImpl: async () => new Response('private-upstream-detail', { status: Number(status) }) })).rejects.toMatchObject({ code })
  })

  it('rejects unsupported providers before requesting the API', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(queryProviderModels('unknown', { ...options, fetchImpl })).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
