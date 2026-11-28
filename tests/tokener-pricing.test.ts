import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  TOKENER_CURRENT_PRICES,
  TOKENER_LEGACY_PRICES,
  TOKENER_OFFPEAK_VALID_FROM,
  TOKENER_OFFPEAK_VALID_THROUGH,
  TOKENER_REPRICED_MODELS,
  isTokenerOffPeak,
  selectTokenerRates,
  tokenerInputCount,
} from '../src/tokener-pricing.ts'

interface CatalogTier {
  thresholdTokens: number
  inputPerMillion: string
  cacheReadPerMillion: string
  outputPerMillion: string
}

interface CatalogModel {
  id: string
  pricing: {
    inputPerMillion?: string | null
    cacheReadPerMillion?: string | null
    outputPerMillion?: string | null
    contextPriceTiers?: CatalogTier[]
    offPeakPricing?: {
      inputPerMillion: string
      cacheReadPerMillion: string
      outputPerMillion: string
      calendar: { holidays: string[]; validFrom: string; validThrough: string }
    }
  }
}

const catalog = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/tokener-public-catalog-2026-11-28.json'), 'utf8'),
) as { schemaVersion: number; catalogRevision: string; models: CatalogModel[] }

function usd(value: string | null | undefined): number | null {
  return value === undefined || value === null ? null : Number(value)
}

describe('Tokener public catalog snapshot', () => {
  it('matches the checked-in 2026-11-28 official catalog, including tiers and off-peak rates', () => {
    expect(catalog.schemaVersion).toBe(1)
    expect(catalog.catalogRevision).toBe('sha256:d6e160bc81b620b91cb7b6c263fb2487d0e0060f84e651b3b06d6ca9b77bcf31')
    expect(Object.keys(TOKENER_CURRENT_PRICES).sort()).toEqual(catalog.models.map(model => model.id).sort())

    for (const model of catalog.models) {
      const quote = TOKENER_CURRENT_PRICES[model.id]
      if (quote === undefined) throw new Error(`missing quote for ${model.id}`)
      const input = usd(model.pricing.inputPerMillion)
      const cacheRead = usd(model.pricing.cacheReadPerMillion)
      const output = usd(model.pricing.outputPerMillion)
      if (cacheRead === null || output === null) {
        expect(quote.rates).toEqual({ cacheMissUsdPerMillion: input, cacheHitUsdPerMillion: 0, outputUsdPerMillion: 0 })
        expect(quote.unpublishedCacheRead).toBe(true)
      }
      else {
        expect(quote.rates).toEqual({
          cacheMissUsdPerMillion: input,
          cacheHitUsdPerMillion: cacheRead,
          outputUsdPerMillion: output,
        })
        expect(quote.unpublishedCacheRead).toBeUndefined()
      }

      const tiers = model.pricing.contextPriceTiers ?? []
      if (tiers.length === 0) expect(quote.contextPriceTiers).toBeUndefined()
      else {
        expect(quote.contextPriceTiers).toEqual(tiers.map(tier => ({
          thresholdTokens: tier.thresholdTokens,
          cacheMissUsdPerMillion: Number(tier.inputPerMillion),
          cacheHitUsdPerMillion: Number(tier.cacheReadPerMillion),
          outputUsdPerMillion: Number(tier.outputPerMillion),
        })))
      }

      const offPeak = model.pricing.offPeakPricing
      if (offPeak === undefined) expect(quote.offPeakRates).toBeUndefined()
      else {
        expect(quote.offPeakRates).toEqual({
          cacheMissUsdPerMillion: Number(offPeak.inputPerMillion),
          cacheHitUsdPerMillion: Number(offPeak.cacheReadPerMillion),
          outputUsdPerMillion: Number(offPeak.outputPerMillion),
        })
        expect(offPeak.calendar.validFrom).toBe(TOKENER_OFFPEAK_VALID_FROM)
        expect(offPeak.calendar.validThrough).toBe(TOKENER_OFFPEAK_VALID_THROUGH)
      }
    }
  })

  it('marks only models whose public base rates changed since the 2026-11-03 snapshot', () => {
    const changed: string[] = []
    for (const [model, quote] of Object.entries(TOKENER_CURRENT_PRICES)) {
      const previous = TOKENER_LEGACY_PRICES[model]
      if (previous === undefined) continue
      if (quote.unpublishedCacheRead) continue
      const [input, cacheRead, output] = previous
      if (
        input !== quote.rates.cacheMissUsdPerMillion
        || cacheRead !== quote.rates.cacheHitUsdPerMillion
        || output !== quote.rates.outputUsdPerMillion
      ) changed.push(model)
    }
    expect(new Set(changed)).toEqual(TOKENER_REPRICED_MODELS)
  })

  it('keeps identical off-peak holiday calendars on the two official off-peak models', () => {
    const calendars = catalog.models
      .filter(model => model.pricing.offPeakPricing !== undefined)
      .map(model => ({ id: model.id, calendar: model.pricing.offPeakPricing!.calendar }))
    expect(calendars.map(item => item.id).sort()).toEqual(['deepseek-flash', 'deepseek-v4-pro'])
    expect(calendars[0]?.calendar).toEqual(calendars[1]?.calendar)
    expect(calendars[0]?.calendar.holidays).toHaveLength(62)
  })
})

describe('Tokener rate selection', () => {
  it('treats times outside the official calendar window as peak', () => {
    expect(isTokenerOffPeak(new Date('2025-12-31T15:59:59Z'))).toBe(false) // 2025-12-31 23:59:59 Beijing, before validFrom
    expect(isTokenerOffPeak(new Date('2025-12-31T16:00:00Z'))).toBe(true) // 2026-01-01 00:00 Beijing, New Year holiday
    expect(isTokenerOffPeak(new Date('2027-12-31T15:59:59Z'))).toBe(true) // still 2027-12-31
    expect(isTokenerOffPeak(new Date('2027-12-31T16:00:00Z'))).toBe(false) // 2028-01-01 00:00 Beijing
  })

  it('selects the matching context tier from total input including cached tokens', () => {
    const quote = TOKENER_CURRENT_PRICES['claude-haiku-5-5']!
    const below = { inputTokens: 40_000, cacheReadTokens: 60_000, cacheWriteTokens: 0, outputTokens: 1 }
    const above = { inputTokens: 40_001, cacheReadTokens: 60_000, cacheWriteTokens: 0, outputTokens: 1 }
    expect(tokenerInputCount(below)).toBe(100_000)
    expect(tokenerInputCount(above)).toBe(100_001)
    expect(selectTokenerRates(quote, below, new Date('2026-11-28T00:00:00Z'))).toEqual(quote.rates)
    expect(selectTokenerRates(quote, above, new Date('2026-11-28T00:00:00Z'))).toEqual(quote.contextPriceTiers![0])
  })
})
