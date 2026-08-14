import { describe, expect, it } from 'vitest'
import { en, errorLocaleKey, zh } from '../src/client/locales.ts'
import type { DeepSeekApiErrorCode } from '../src/types.ts'

describe('client locales', () => {
  it('keeps the English dictionary in sync with Chinese', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(Object.values(en).every(Boolean)).toBe(true)
    expect(Object.values(zh).every(Boolean)).toBe(true)
  })

  it('maps every API error code to a translated key', () => {
    const codes: DeepSeekApiErrorCode[] = [
      'FORBIDDEN',
      'INVALID_API_KEY',
      'INVALID_RESPONSE',
      'METHOD_NOT_ALLOWED',
      'MISSING_API_KEY',
      'RATE_LIMITED',
      'UPSTREAM_ERROR',
      'UPSTREAM_TIMEOUT',
      'UPSTREAM_UNAVAILABLE',
    ]

    expect(codes.map(errorLocaleKey)).toEqual(codes.map(code => `error.${code}`))
  })
})
