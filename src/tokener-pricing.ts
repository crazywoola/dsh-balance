import { beijingDateKey, isChineseStatutoryPeakHour } from './pricing.ts'

/** USD per million tokens from the public Tokener catalog.
 * Current snapshot checked 2026-11-28 against
 * https://console.tokener.ai/api/public/v1/models
 * (schemaVersion 1, catalogRevision sha256:d6e160bc81b620b91cb7b6c263fb2487d0e0060f84e651b3b06d6ca9b77bcf31),
 * https://www.tokener.ai/docs/guides/models, and model pages such as
 * https://www.tokener.ai/models/deepseek-flash and
 * https://www.tokener.ai/models/claude-haiku-5-5.
 * Model IDs are exact and case-sensitive. These are reference estimates, not account bills.
 * Cache-write pricing is not published; requests with cache writes stay unpriced.
 * Embedding models are priced on input only; a cache-read rate is not published for them.
 */
export const TOKENER_PRICING_VERSION = 'tokener-reference-2026-11-28'
export const TOKENER_LEGACY_PRICING_VERSION = 'tokener-reference-2026-11-03'
/** Re-verification instant for rate changes noticed on 2026-11-28. Not a vendor-published effective date. */
export const TOKENER_CURRENT_EFFECTIVE_FROM = Date.parse('2026-11-28T00:00:00+08:00')

/** Official off-peak calendar window from Tokener model pages / catalog `offPeakPricing.calendar`. */
export const TOKENER_OFFPEAK_VALID_FROM = '2026-01-01'
export const TOKENER_OFFPEAK_VALID_THROUGH = '2027-12-31'

export interface TokenerUsdRates {
  cacheMissUsdPerMillion: number
  cacheHitUsdPerMillion: number
  outputUsdPerMillion: number
}

export interface TokenerContextTier extends TokenerUsdRates {
  thresholdTokens: number
}

export interface TokenerModelQuote {
  rates: TokenerUsdRates
  contextPriceTiers?: readonly TokenerContextTier[]
  offPeakRates?: TokenerUsdRates
  /** Cache-read rate is unpublished; usage with cache reads stays unpriced. */
  unpublishedCacheRead?: true
}

function rates(cacheMissUsdPerMillion: number, cacheHitUsdPerMillion: number, outputUsdPerMillion: number): TokenerUsdRates {
  return { cacheMissUsdPerMillion, cacheHitUsdPerMillion, outputUsdPerMillion }
}

/** Last known public-catalog rates from the 2026-11-03 snapshot.
 * Kept so IDs that left the public catalog, and pre-change rates for repriced models, can still be estimated.
 */
export const TOKENER_LEGACY_PRICES: Readonly<Record<string, readonly [input: number, cacheRead: number, output: number]>> = {
  'claude-fable-5': [10.0, 1.0, 50.0],
  'claude-fable-5-1': [10.0, 0.25, 50.0],
  'claude-haiku-4-5-20251001': [1.0, 0.1, 5.0],
  'claude-haiku-5-5': [0.5, 0.05, 2.5],
  'claude-opus-4-5-20251101': [5.0, 0.5, 25.0],
  'claude-opus-4-6': [5.0, 0.5, 25.0],
  'claude-opus-4-7': [5.0, 0.5, 25.0],
  'claude-opus-4-8': [5.0, 0.5, 25.0],
  'claude-opus-5': [5.0, 0.5, 25.0],
  'claude-opus-5-5': [4.0, 0.2, 20.0],
  'claude-sonnet-4-5-20250929': [3.0, 0.3, 15.0],
  'claude-sonnet-4-6': [3.0, 0.3, 15.0],
  'claude-sonnet-5': [2.0, 0.2, 10.0],
  'deepseek-flash': [0.3, 0.006, 1.2],
  'deepseek-v4.1-flash': [0.3, 0.3, 1.2],
  'deepseek-v4-flash-0731': [0.15, 0.003, 0.6],
  'deepseek-v4-pro': [1.32, 0.044, 3.96],
  'gemini-2.5-flash': [0.3, 0.03, 2.5],
  'gemini-2.5-flash-image': [0.3, 0.075, 30.0],
  'gemini-2.5-flash-lite': [0.1, 0.01, 0.4],
  'gemini-2.5-pro': [2.5, 0.25, 15.0],
  'gemini-3.1-flash-lite': [0.25, 0.025, 1.5],
  'gemini-3.1-pro-preview': [4.0, 0.4, 18.0],
  'gemini-3.1-pro-preview-customtools': [4.0, 0.4, 18.0],
  'gemini-3.5-flash': [1.5, 0.15, 9.0],
  'gemini-3.5-flash-lite': [0.3, 0.03, 2.5],
  'gemini-3.6-flash': [0.75, 0.075, 3.75],
  'gemini-3.7-flash': [0.75, 0.075, 3.75],
  'gemini-3.8-flash': [0.75, 0.075, 3.75],
  'gemini-3-flash-preview': [0.5, 0.05, 3.0],
  'gemini-3-pro-image-preview': [2.0, 2.0, 120.0],
  'gemini-4-argon': [2.0, 0.1, 10.0],
  'gemini-flash-latest': [0.75, 0.075, 3.75],
  'gemini-flash-lite-latest': [0.3, 0.03, 2.5],
  'glm-5': [1.0, 0.2, 3.2],
  'glm-5.1': [1.4, 0.26, 4.4],
  'glm-5.3': [1.68, 0.312, 5.28],
  'gpt-4.1': [2.0, 0.5, 8.0],
  'gpt-4.1-2025-04-14': [2.0, 0.5, 8.0],
  'gpt-4.1-mini': [0.4, 0.1, 1.6],
  'gpt-4.1-mini-2025-04-14': [0.4, 0.1, 1.6],
  'gpt-4o': [2.5, 1.25, 10.0],
  'gpt-4o-2024-08-06': [2.5, 1.25, 10.0],
  'gpt-4o-2024-11-20': [2.5, 1.25, 10.0],
  'gpt-4o-mini': [0.15, 0.075, 0.6],
  'gpt-4o-mini-2024-07-18': [0.15, 0.075, 0.6],
  'gpt-5': [1.25, 0.125, 10.0],
  'gpt-5.1': [1.25, 0.125, 10.0],
  'gpt-5.1-2025-11-13': [1.25, 0.125, 10.0],
  'gpt-5.2': [1.75, 0.175, 14.0],
  'gpt-5.2-2025-12-11': [1.75, 0.175, 14.0],
  'gpt-5.4': [5.0, 0.5, 22.5],
  'gpt-5.4-2026-03-05': [5.0, 0.5, 22.5],
  'gpt-5.4-mini': [0.75, 0.075, 4.5],
  'gpt-5.4-mini-2026-03-17': [0.75, 0.075, 4.5],
  'gpt-5.4-nano': [0.2, 0.02, 1.25],
  'gpt-5.4-nano-2026-03-17': [0.2, 0.02, 1.25],
  'gpt-5.5': [10.0, 1.0, 45.0],
  'gpt-5.5-2026-04-23': [10.0, 1.0, 45.0],
  'gpt-5.6-luna': [0.2, 0.02, 1.2],
  'gpt-5.6-sol': [4.0, 0.4, 20.0],
  'gpt-5.6-terra': [2.0, 0.2, 12.0],
  'gpt-5-mini': [0.25, 0.025, 2.0],
  'gpt-5-nano': [0.05, 0.005, 0.4],
  'gpt-6-astra': [10.0, 1.0, 12.5],
  'gpt-6-luna': [0.2, 0.02, 0.75],
  'gpt-6-sol': [4.0, 0.4, 15.0],
  'grok-4.20-0309-non-reasoning': [2.5, 0.4, 5.0],
  'grok-4.20-0309-reasoning': [2.5, 0.4, 5.0],
  'grok-4.3': [2.5, 0.4, 5.0],
  'grok-4.5': [4.0, 0.6, 12.0],
  'grok-4.6': [4.0, 1.0, 12.0],
  'grok-4.7': [2.0, 0.5, 6.0],
  'kimi-k2.5': [0.574, 0.574, 3.011],
  'kimi-k3': [3.0, 0.3, 15.0],
  'MiniMax-M2.5': [0.3, 0.03, 1.2],
  'o3': [2.0, 0.5, 8.0],
  'qwen3.5-flash': [0.1, 0.01, 0.4],
  'qwen3.5-flash-2026-02-23': [0.1, 0.01, 0.4],
  'qwen3.5-plus': [0.5, 0.5, 3.0],
  'qwen3.5-plus-2026-02-15': [0.5, 0.5, 3.0],
  'qwen3.6-flash': [1.0, 0.1, 4.0],
  'qwen3.6-flash-2026-04-16': [1.0, 0.1, 4.0],
  'qwen3.6-plus': [2.0, 0.2, 6.0],
  'qwen3.6-plus-2026-04-02': [2.0, 0.2, 6.0],
  'qwen3.7-flash': [0.2, 0.04, 0.8],
  'qwen3.7-flash-2026-07-15': [0.2, 0.04, 0.8],
  'qwen3.7-max': [2.5, 0.5, 7.5],
  'qwen3.7-plus': [1.2, 0.24, 4.8],
  'qwen3.7-plus-2026-05-26': [1.2, 0.24, 4.8],
  'qwen3.8-flash': [0.15, 0.016, 0.47],
  'qwen3.8-max': [2.0, 0.25, 6.0],
  'qwen3-vl-plus': [0.6, 0.12, 4.8],
  'qwen-flash': [0.25, 0.05, 2.0],
  'qwen-flash-2025-07-28': [0.25, 0.05, 2.0],
  'qwen-long': [0.072, 0.072, 0.287],
  'qwen-max': [1.6, 1.6, 6.4],
  'qwen-mt-flash': [0.16, 0.16, 0.49],
  'qwen-mt-plus': [2.46, 2.46, 7.37],
  'qwen-plus': [1.2, 0.24, 12.0],
  'qwen-plus-2025-04-28': [1.2, 0.24, 12.0],
  'qwen-plus-latest': [1.2, 0.24, 12.0],
}

/** Public catalog models as of 2026-11-28 (38 entries). */
export const TOKENER_CURRENT_PRICES: Readonly<Record<string, TokenerModelQuote>> = {
  'claude-fable-5': {
    rates: rates(10.0, 1.0, 50.0),
  },
  'claude-fable-5-1': {
    rates: rates(10.0, 0.25, 50.0),
  },
  'claude-fable-5-2': {
    rates: rates(8.0, 0.2, 40.0),
  },
  'claude-haiku-4-5-20251001': {
    rates: rates(1.0, 0.1, 5.0),
  },
  'claude-haiku-5-5': {
    rates: rates(0.1, 0.01, 0.5),
    contextPriceTiers: [
      { thresholdTokens: 100001, ...rates(0.5, 0.05, 2.5) },
    ],
  },
  'claude-opus-4-5-20251101': {
    rates: rates(5.0, 0.5, 25.0),
  },
  'claude-opus-4-6': {
    rates: rates(5.0, 0.5, 25.0),
  },
  'claude-opus-4-7': {
    rates: rates(5.0, 0.5, 25.0),
  },
  'claude-opus-4-8': {
    rates: rates(5.0, 0.5, 25.0),
  },
  'claude-opus-5': {
    rates: rates(5.0, 0.5, 25.0),
  },
  'claude-opus-5-5': {
    rates: rates(4.0, 0.2, 20.0),
  },
  'claude-sonnet-4-5-20250929': {
    rates: rates(3.0, 0.3, 15.0),
  },
  'claude-sonnet-4-6': {
    rates: rates(3.0, 0.3, 15.0),
  },
  'claude-sonnet-5': {
    rates: rates(2.0, 0.2, 10.0),
  },
  'claude-sonnet-5-5': {
    rates: rates(2.0, 0.1, 10.0),
  },
  'deepseek-flash': {
    rates: rates(0.3, 0.006, 1.2),
    offPeakRates: rates(0.15, 0.003, 0.6),
  },
  'deepseek-v3.2': {
    rates: rates(0.62, 0.62, 1.85),
  },
  'deepseek-v4-pro': {
    rates: rates(1.32, 0.044, 3.96),
    offPeakRates: rates(0.66, 0.022, 1.98),
  },
  // priced on input only
  'embed-english-v3': {
    rates: rates(0.1, 0, 0),
    unpublishedCacheRead: true,
  },
  // priced on input only
  'embed-multilingual-v3': {
    rates: rates(0.1, 0, 0),
    unpublishedCacheRead: true,
  },
  // priced on input only
  'embed-v4': {
    rates: rates(0.12, 0, 0),
    unpublishedCacheRead: true,
  },
  'glm-4.7': {
    rates: rates(0.6, 0.6, 2.2),
  },
  'glm-4.7-flash': {
    rates: rates(0.07, 0.07, 0.4),
  },
  'glm-5': {
    rates: rates(1.0, 0.2, 3.2),
  },
  'grok-4.3': {
    rates: rates(1.25, 0.2, 2.5),
  },
  'grok-4.6': {
    rates: rates(2.0, 0.5, 6.0),
  },
  'grok-4.7': {
    rates: rates(2.0, 0.5, 6.0),
  },
  'kimi-k3': {
    rates: rates(3.0, 0.3, 15.0),
  },
  'kimi-k3.1': {
    rates: rates(4.0, 0.2, 20.0),
  },
  'kimi-k3.1-pro': {
    rates: rates(2.0, 0.2, 10.0),
  },
  // deprecated in the public catalog, still listed
  'MiniMax-M2.5': {
    rates: rates(0.3, 0.03, 1.2),
  },
  'qwen3-235b-a22b-2507': {
    rates: rates(0.22, 0.22, 0.88),
  },
  'qwen3-32b': {
    rates: rates(0.15, 0.15, 0.6),
  },
  'qwen3-coder-30b-a3b': {
    rates: rates(0.15, 0.15, 0.6),
  },
  'qwen3-coder-480b-a35b': {
    rates: rates(0.45, 0.45, 1.8),
  },
  'qwen3-coder-next': {
    rates: rates(0.5, 0.5, 1.2),
  },
  'qwen3-next-80b-a3b': {
    rates: rates(0.15, 0.15, 1.2),
  },
  'qwen3-vl-235b-a22b': {
    rates: rates(0.53, 0.53, 2.66),
  },
}

/** Models whose public-catalog rates changed between the 2026-11-03 snapshot and the 2026-11-28 check. */
export const TOKENER_REPRICED_MODELS: ReadonlySet<string> = new Set([
  'claude-haiku-5-5',
  'grok-4.3',
  'grok-4.6',
])

/** Whether Tokener official off-peak rates apply at `date`.
 * Off-peak is every time outside Mon–Fri 09:00–12:00 and 14:00–18:00 Beijing time,
 * excluding Chinese public holidays, including weekend makeup workdays.
 * Official model pages: off-peak prices apply only from 2026-01-01 through 2027-12-31;
 * outside that window, peak (base catalog) prices apply. Prices use the billing time.
 */
export function isTokenerOffPeak(date: Date): boolean {
  const key = beijingDateKey(date)
  if (key < TOKENER_OFFPEAK_VALID_FROM || key > TOKENER_OFFPEAK_VALID_THROUGH) return false
  return !isChineseStatutoryPeakHour(date)
}

/** Total input tokens used to match `contextPriceTiers`, including cached tokens. */
export function tokenerInputCount(usage: { inputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }): number {
  return usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

/** Pick the official rates for a Tokener quote at a given usage shape and billing time. */
export function selectTokenerRates(quote: TokenerModelQuote, usage: { inputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }, at: Date): TokenerUsdRates {
  const base = quote.offPeakRates !== undefined && isTokenerOffPeak(at) ? quote.offPeakRates : quote.rates
  const tiers = quote.contextPriceTiers
  if (tiers === undefined || tiers.length === 0) return base
  const inputCount = tokenerInputCount(usage)
  let matched: TokenerContextTier | undefined
  for (const tier of tiers) {
    if (inputCount >= tier.thresholdTokens && (matched === undefined || tier.thresholdTokens > matched.thresholdTokens)) {
      matched = tier
    }
  }
  return matched ?? base
}

