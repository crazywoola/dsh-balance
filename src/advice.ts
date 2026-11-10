import { findBalanceProvider } from './providers.ts'
import { isPeakHour, nextPeriodChange, PEAK_EFFECTIVE_FROM } from './pricing.ts'
import type { BillingPrice, BillingUsage, UsageFailure, UsageRequestRecord } from './billing.ts'
import { calculateRequestCost, resolveBillingPrice } from './billing.ts'

export const ADVICE_ROUTE = '/dsh-balance/api/advice'
/** Number of recent priced requests used to form the next-turn token shape. */
export const ADVICE_SAMPLE_LIMIT = 8

/** Official models offered as alternatives when that provider is configured. Tokener is session/current only. */
const ADVICE_CATALOG_MODELS: Readonly<Record<string, readonly string[]>> = {
  deepseek: ['deepseek-flash', 'deepseek-v4-pro'],
  stepfun: ['step-5-preview', 'step-3.7-flash', 'step-3.5-flash', 'step-3.5-flash-2603', 'step-1o-turbo-vision'],
  tokener: [],
}

export type AdvicePeriod = 'peak' | 'off-peak' | 'standard'
export type AdviceCaveat =
  | 'estimate-not-a-bill'
  | 'shape-may-differ'
  | 'stepfun-grandfathering'
  | 'tokener-snapshot'
  | 'no-priced-sample'
  | 'unpriced-omitted'

export interface AdviceEstimate {
  kind: 'now' | 'after-change' | 'fresh' | 'alternative'
  provider: string
  model: string
  at: string
  period: AdvicePeriod
  pricingVersion: string
  costUsd: number | null
  costCny?: number
  combinedCny: number | null
}

export interface AdviceCoverage {
  requests: number
  pricedRequests: number
  freeRequests: number
  unpricedRequests: number
  status: 'empty' | 'priced' | 'partial' | 'unpriced'
  catalog: { provider: string; pricingVersion: string }[]
}

export interface AdviceSuccess {
  ok: true
  estimateOnly: true
  sessionId: string
  fetchedAt: string
  currentPeriod: AdvicePeriod
  nextChangeAt: string | null
  sampleSize: number
  sampleLimit: number
  tokenShape: BillingUsage | null
  current?: { provider: string; model: string }
  now?: AdviceEstimate
  afterChange?: AdviceEstimate
  fresh?: AdviceEstimate
  alternatives: AdviceEstimate[]
  cacheSavings?: { costUsd: number | null; costCny?: number; combinedCny: number | null }
  coverage: AdviceCoverage
  caveats: AdviceCaveat[]
}

export type AdviceApiResponse = AdviceSuccess | UsageFailure

export interface AdviceInput {
  sessionId: string
  records: readonly UsageRequestRecord[]
  current?: { provider: string; model: string }
  /** Extra provider/model pairs to compare when they can be priced. */
  compare?: readonly { provider: string; model: string }[]
  /** Official providers treated as configured in this Harness. */
  configuredProviders?: readonly string[]
  pricingOverrides?: readonly BillingPrice[]
  usdToCny?: number
  at?: Date
  sampleLimit?: number
}

function roundMoney(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000
}

function combinedCny(costUsd: number | null, costCny: number | undefined, usdToCny: number | undefined): number | null {
  if (usdToCny === undefined) return null
  return roundMoney((costCny ?? 0) + (costUsd ?? 0) * usdToCny)
}

function periodFor(provider: string, at: Date): AdvicePeriod {
  if (findBalanceProvider(provider)?.id !== 'deepseek' || at.getTime() < PEAK_EFFECTIVE_FROM) return 'standard'
  return isPeakHour(at) ? 'peak' : 'off-peak'
}

/** Median of a non-empty list of non-negative token counts, rounded to an integer. */
export function medianTokens(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor((sorted.length - 1) / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return Math.round((sorted[mid]! + sorted[mid + 1]!) / 2)
}

/** Most recent priced requests, oldest first, capped at `limit`. */
export function recentPricedRequests(records: readonly UsageRequestRecord[], limit: number): UsageRequestRecord[] {
  return records
    .filter(record => record.billingStatus === 'priced')
    .sort((left, right) => left.time.localeCompare(right.time) || left.seq - right.seq)
    .slice(-Math.max(limit, 0))
}

/** Per-bucket median of the sample; fields are independent and may not match any one request. */
export function medianTokenShape(records: readonly UsageRequestRecord[]): BillingUsage | undefined {
  if (records.length === 0) return undefined
  return {
    inputTokens: medianTokens(records.map(record => record.inputTokens)),
    outputTokens: medianTokens(records.map(record => record.outputTokens)),
    cacheReadTokens: medianTokens(records.map(record => record.cacheReadTokens)),
    cacheWriteTokens: medianTokens(records.map(record => record.cacheWriteTokens)),
  }
}

/** Treat previously cached input as a cache miss, keeping output and cache-write buckets. */
export function freshSessionUsage(usage: BillingUsage): BillingUsage {
  return {
    inputTokens: usage.inputTokens + usage.cacheReadTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: usage.cacheWriteTokens,
  }
}

function providerModel(record: { provider: string | null; model: string | null }): { provider: string; model: string } | undefined {
  if (record.provider === null || record.model === null) return undefined
  const provider = findBalanceProvider(record.provider)?.id ?? record.provider
  return { provider, model: record.model }
}

function resolveCurrent(records: readonly UsageRequestRecord[], current: { provider: string; model: string } | undefined): { provider: string; model: string } | undefined {
  if (current !== undefined) {
    const provider = findBalanceProvider(current.provider)?.id ?? current.provider
    if (current.model.trim().length > 0) return { provider, model: current.model }
  }
  const priced = recentPricedRequests(records, Number.POSITIVE_INFINITY)
  for (let index = priced.length - 1; index >= 0; index -= 1) {
    const value = providerModel(priced[index]!)
    if (value !== undefined) return value
  }
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const value = providerModel(records[index]!)
    if (value !== undefined) return value
  }
  return undefined
}

function money(cost: number, price: BillingPrice, usdToCny: number | undefined): Pick<AdviceEstimate, 'costUsd' | 'costCny' | 'combinedCny'> {
  if (price.currency === 'CNY') return { costUsd: null, costCny: cost, combinedCny: combinedCny(null, cost, usdToCny) }
  return { costUsd: cost, combinedCny: combinedCny(cost, undefined, usdToCny) }
}

function estimate(
  kind: AdviceEstimate['kind'],
  provider: string,
  model: string,
  usage: BillingUsage,
  at: Date,
  overrides: readonly BillingPrice[],
  usdToCny: number | undefined,
): AdviceEstimate | undefined {
  const price = resolveBillingPrice(provider, model, at.getTime(), overrides)
  if (price === undefined) return undefined
  const providerId = findBalanceProvider(provider)?.id ?? provider
  if (providerId === 'tokener' && usage.cacheWriteTokens > 0) return undefined
  const cost = calculateRequestCost(usage, price, at.getTime())
  return {
    kind,
    provider: providerId,
    model,
    at: at.toISOString(),
    period: periodFor(providerId, at),
    pricingVersion: price.pricingVersion,
    ...money(cost, price, usdToCny),
  }
}

function sameTarget(left: { provider: string; model: string }, right: { provider: string; model: string }): boolean {
  const leftId = findBalanceProvider(left.provider)?.id ?? left.provider
  const rightId = findBalanceProvider(right.provider)?.id ?? right.provider
  return leftId === rightId && left.model === right.model
}

function priceIdentity(estimate: AdviceEstimate): string {
  return JSON.stringify([
    estimate.provider,
    estimate.pricingVersion,
    estimate.costUsd,
    estimate.costCny ?? null,
  ])
}

function coverageStatus(priced: number, unpriced: number, requests: number): AdviceCoverage['status'] {
  if (requests === 0) return 'empty'
  if (unpriced === 0) return 'priced'
  if (priced === 0) return 'unpriced'
  return 'partial'
}

function savings(now: AdviceEstimate, fresh: AdviceEstimate): NonNullable<AdviceSuccess['cacheSavings']> {
  const usd = now.costUsd !== null && fresh.costUsd !== null ? roundMoney(fresh.costUsd - now.costUsd) : null
  const cny = now.costCny !== undefined && fresh.costCny !== undefined ? roundMoney(fresh.costCny - now.costCny) : undefined
  const combined = now.combinedCny !== null && fresh.combinedCny !== null ? roundMoney(fresh.combinedCny - now.combinedCny) : null
  return { costUsd: usd, ...(cny === undefined ? {} : { costCny: cny }), combinedCny: combined }
}

/** Build a next-turn estimate from already-folded session records. Reuses billing prices as-is. */
export function buildAdvice(input: AdviceInput): AdviceSuccess {
  const at = input.at ?? new Date()
  const sampleLimit = input.sampleLimit ?? ADVICE_SAMPLE_LIMIT
  const overrides = input.pricingOverrides ?? []
  const usdToCny = input.usdToCny
  const sample = recentPricedRequests(input.records, sampleLimit)
  const tokenShape = medianTokenShape(sample)
  const current = resolveCurrent(input.records, input.current)
  const configured = new Set(
    (input.configuredProviders ?? []).map(id => findBalanceProvider(id)?.id ?? id),
  )
  for (const record of input.records) {
    const provider = record.provider === null ? undefined : findBalanceProvider(record.provider)?.id
    if (provider !== undefined) configured.add(provider)
  }
  if (current !== undefined) configured.add(findBalanceProvider(current.provider)?.id ?? current.provider)

  const now = current !== undefined && tokenShape !== undefined
    ? estimate('now', current.provider, current.model, tokenShape, at, overrides, usdToCny)
    : undefined
  const nextChange = current !== undefined && findBalanceProvider(current.provider)?.id === 'deepseek'
    ? nextPeriodChange(at)
    : undefined
  const afterChange = current !== undefined && tokenShape !== undefined && nextChange !== undefined
    ? estimate('after-change', current.provider, current.model, tokenShape, nextChange, overrides, usdToCny)
    : undefined
  const fresh = current !== undefined && tokenShape !== undefined
    ? estimate('fresh', current.provider, current.model, freshSessionUsage(tokenShape), at, overrides, usdToCny)
    : undefined

  const candidates: { provider: string; model: string }[] = []
  const push = (value: { provider: string; model: string }) => {
    const provider = findBalanceProvider(value.provider)?.id ?? value.provider
    const model = value.model
    if (model.trim().length === 0) return
    if (current !== undefined && sameTarget({ provider, model }, current)) return
    if (candidates.some(item => sameTarget(item, { provider, model }))) return
    candidates.push({ provider, model })
  }
  for (const record of input.records) {
    const value = providerModel(record)
    if (value !== undefined) push(value)
  }
  for (const value of input.compare ?? []) push(value)
  for (const provider of configured) {
    for (const model of ADVICE_CATALOG_MODELS[provider] ?? []) push({ provider, model })
  }

  const alternatives: AdviceEstimate[] = []
  const seen = new Set<string>()
  if (tokenShape !== undefined) {
    for (const candidate of candidates) {
      const value = estimate('alternative', candidate.provider, candidate.model, tokenShape, at, overrides, usdToCny)
      if (value === undefined) continue
      const identity = priceIdentity(value)
      if (now !== undefined && priceIdentity({ ...value, provider: now.provider }) === priceIdentity(now) && value.provider === now.provider) continue
      if (seen.has(identity)) continue
      seen.add(identity)
      alternatives.push(value)
    }
  }

  const pricedRequests = input.records.filter(record => record.billingStatus === 'priced').length
  const freeRequests = input.records.filter(record => record.billingStatus === 'free').length
  const unpricedRequests = input.records.filter(record => record.billingStatus === 'unpriced').length
  const estimates = [now, afterChange, fresh, ...alternatives]
  const usedStep5Standard = estimates.some(item =>
    item?.provider === 'stepfun' && item.model === 'step-5-preview' && item.pricingVersion !== 'stepfun-reference-2026-09-30')
  const usedTokener = estimates.some(item => item?.provider === 'tokener')
  const omittedCurrent = current !== undefined && tokenShape !== undefined && now === undefined
  const omittedAlternatives = tokenShape !== undefined && candidates.some(candidate =>
    estimate('alternative', candidate.provider, candidate.model, tokenShape, at, overrides, usdToCny) === undefined)
  const omittedUnpriced = omittedCurrent || omittedAlternatives

  const caveats: AdviceCaveat[] = ['estimate-not-a-bill']
  if (sample.length > 0) caveats.push('shape-may-differ')
  else caveats.push('no-priced-sample')
  if (usedStep5Standard) caveats.push('stepfun-grandfathering')
  if (usedTokener) caveats.push('tokener-snapshot')
  if (omittedUnpriced) caveats.push('unpriced-omitted')

  // Catalog versions are collected from estimates actually shown, not unused tables.
  const catalogEntries = [...new Map(
    [now, afterChange, fresh, ...alternatives]
      .filter((item): item is AdviceEstimate => item !== undefined)
      .map(item => [`${item.provider}:${item.pricingVersion}`, { provider: item.provider, pricingVersion: item.pricingVersion }]),
  ).values()]

  return {
    ok: true,
    estimateOnly: true,
    sessionId: input.sessionId,
    fetchedAt: at.toISOString(),
    currentPeriod: current === undefined ? (at.getTime() >= PEAK_EFFECTIVE_FROM && isPeakHour(at) ? 'peak' : at.getTime() >= PEAK_EFFECTIVE_FROM ? 'off-peak' : 'standard') : periodFor(current.provider, at),
    nextChangeAt: nextChange?.toISOString() ?? null,
    sampleSize: sample.length,
    sampleLimit,
    tokenShape: tokenShape ?? null,
    ...(current === undefined ? {} : { current }),
    ...(now === undefined ? {} : { now }),
    ...(afterChange === undefined ? {} : { afterChange }),
    ...(fresh === undefined ? {} : { fresh }),
    alternatives,
    ...(now !== undefined && fresh !== undefined ? { cacheSavings: savings(now, fresh) } : {}),
    coverage: {
      requests: input.records.length,
      pricedRequests,
      freeRequests,
      unpricedRequests,
      status: coverageStatus(pricedRequests, unpricedRequests, input.records.length),
      catalog: catalogEntries,
    },
    caveats,
  }
}
