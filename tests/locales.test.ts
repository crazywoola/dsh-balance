import { describe, expect, it } from 'vitest'
import { en, errorLocaleKey, zh } from '../src/client/locales.ts'
import { zhTW } from '../src/client/locales-zh-tw.ts'
import type { DeepSeekApiErrorCode } from '../src/types.ts'

describe('client locales', () => {
  it('keeps the English dictionary in sync with Chinese', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(Object.values(en).every(Boolean)).toBe(true)
    expect(Object.values(zh).every(Boolean)).toBe(true)
  })

  it('maps every API error code to a translated key', () => {
    const codes: DeepSeekApiErrorCode[] = [
      'UNSUPPORTED_PROVIDER',
      'BALANCE_NOT_SUPPORTED',
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

describe('zh-TW locale', () => {
  it('has no missing or extra keys versus zh and en, and no empty values', () => {
    const keys = Object.keys(zh).sort()
    expect(Object.keys(zhTW).sort()).toEqual(keys)
    expect(Object.keys(zhTW).sort()).toEqual(Object.keys(en).sort())
    expect(Object.values(zhTW).every(Boolean)).toBe(true)
    expect(zhTW['locale.tag']).toBe('zh-TW')
  })

  it('preserves {placeholders} of the zh source in every key', () => {
    const names = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
    for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
      expect(names(zhTW[key]), key).toEqual(names(zh[key]))
    }
  })
})
