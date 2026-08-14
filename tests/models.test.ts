import { describe, expect, it, vi } from 'vitest'
import { ModelQueryError, parseDeepSeekModels, queryDeepSeekModels } from '../src/models.ts'

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
