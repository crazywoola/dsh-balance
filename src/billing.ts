import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import { findBalanceProvider } from './providers.ts'
import { isPeakHour, PEAK_EFFECTIVE_FROM } from './pricing.ts'

export const USAGE_ROUTE = '/dsh-balance/api/usage'
export const BILLING_PRICING_VERSION = 'deepseek-v4-2026-08-17'
const TOKENS_PER_MILLION = 1_000_000

export interface BillingPrice {
  provider: string
  model: string
  effectiveFrom: string
  pricingVersion: string
  cacheHitUsdPerMillion: number
  cacheMissUsdPerMillion: number
  outputUsdPerMillion: number
}

interface PriceRates {
  cacheHitUsdPerMillion: number
  cacheMissUsdPerMillion: number
  outputUsdPerMillion: number
}

const CURRENT_PRICES: Record<string, PriceRates> = {
  'deepseek-v4-flash': { cacheHitUsdPerMillion: 0.007, cacheMissUsdPerMillion: 0.22, outputUsdPerMillion: 0.66 },
  'deepseek-v4-pro': { cacheHitUsdPerMillion: 0.022, cacheMissUsdPerMillion: 0.66, outputUsdPerMillion: 1.98 },
}

const LEGACY_PRICES: Record<string, PriceRates> = {
  'deepseek-chat': { cacheHitUsdPerMillion: 0.07, cacheMissUsdPerMillion: 0.27, outputUsdPerMillion: 1.10 },
  'deepseek-reasoner': { cacheHitUsdPerMillion: 0.14, cacheMissUsdPerMillion: 0.55, outputUsdPerMillion: 2.19 },
}

export const BILLING_PRICES: readonly BillingPrice[] = [
  ...Object.entries(LEGACY_PRICES).map(([model, rates]) => ({
    provider: 'deepseek',
    model,
    effectiveFrom: new Date(0).toISOString(),
    pricingVersion: 'deepseek-legacy',
    ...rates,
  })),
  ...Object.entries(CURRENT_PRICES).map(([model, rates]) => ({
    provider: 'deepseek',
    model,
    effectiveFrom: new Date(PEAK_EFFECTIVE_FROM).toISOString(),
    pricingVersion: BILLING_PRICING_VERSION,
    ...rates,
  })),
]

export interface BillingUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export type BillingUnknownReason = 'missing-usage' | 'unknown-provider' | 'unknown-model' | 'missing-request-metadata'

export interface UsageRequestRecord {
  sessionId: string
  turn: number
  step: number
  time: string
  provider: string | null
  model: string | null
  usage?: BillingUsage
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number | null
  pricingVersion?: string
  unknownReason?: BillingUnknownReason
}

export interface UsageTotals {
  requests: number
  pricedRequests: number
  unpricedRequests: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number
  costCny: number | null
}

export interface UsageModelAggregate extends UsageTotals {
  provider: string
  model: string
}

export interface UsageDayAggregate extends UsageTotals {
  date: string
}

export interface UsageSessionAggregate extends UsageTotals {
  sessionId: string
  title: string
}

export interface UsageSummary {
  timeZone: string
  usdToCny: number | null
  totals: UsageTotals
  byModel: UsageModelAggregate[]
  byDay: UsageDayAggregate[]
  bySession: UsageSessionAggregate[]
}

export interface UsageAllSuccess {
  ok: true
  scope: 'all'
  fetchedAt: string
  source: 'live' | 'cache'
  summary: UsageSummary
}

export interface UsageSessionSuccess {
  ok: true
  scope: 'session'
  fetchedAt: string
  source: 'live' | 'cache'
  session: UsageSessionAggregate
  summary: UsageSummary
  requests: UsageRequestRecord[]
}

export interface UsageFailure {
  ok: false
  code: 'FORBIDDEN' | 'INVALID_REQUEST' | 'METHOD_NOT_ALLOWED' | 'SESSION_NOT_FOUND' | 'UPSTREAM_UNAVAILABLE'
  message: string
}

export type UsageApiResponse = UsageAllSuccess | UsageSessionSuccess | UsageFailure

export interface UsageQuery {
  scope: 'all' | 'session'
  sessionId?: string
  timeZone: string
  from?: string
  to?: string
  refresh: boolean
  provider?: string
}

interface RequestContext {
  provider: string
  model: string
  time: number
}

interface MutableTotals {
  requests: number
  pricedRequests: number
  unpricedRequests: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number
}

interface SessionRecords {
  session: UsageSessionAggregate
  records: UsageRequestRecord[]
}

function emptyTotals(): MutableTotals {
  return {
    requests: 0,
    pricedRequests: 0,
    unpricedRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
  }
}

function addTotals(target: MutableTotals, record: UsageRequestRecord): void {
  target.requests += 1
  if (record.costUsd === null) target.unpricedRequests += 1
  else {
    target.pricedRequests += 1
    target.costUsd += record.costUsd
  }
  target.inputTokens += record.inputTokens
  target.outputTokens += record.outputTokens
  target.cacheReadTokens += record.cacheReadTokens
  target.cacheWriteTokens += record.cacheWriteTokens
}

function toTotals(value: MutableTotals, usdToCny: number | null): UsageTotals {
  const costUsd = roundMoney(value.costUsd)
  return {
    ...value,
    costUsd,
    costCny: usdToCny === null ? null : roundMoney(costUsd * usdToCny),
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000
}

function requiredPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function readUsage(value: unknown): BillingUsage | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  const inputTokens = requiredPositiveInteger(row.inputTokens)
  const outputTokens = requiredPositiveInteger(row.outputTokens)
  const cacheReadTokens = row.cacheReadTokens === undefined ? 0 : requiredPositiveInteger(row.cacheReadTokens)
  const cacheWriteTokens = row.cacheWriteTokens === undefined ? 0 : requiredPositiveInteger(row.cacheWriteTokens)
  if (inputTokens === undefined || outputTokens === undefined || cacheReadTokens === undefined || cacheWriteTokens === undefined) return undefined
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }
}

function readRequestMetadata(event: SessionEvent): RequestContext | undefined {
  if (event.type !== 'request/header') return undefined
  const config = event.data.header.config
  if (typeof config.provider !== 'string' || typeof config.model !== 'string') return undefined
  return { provider: config.provider, model: config.model, time: event.time }
}

function stepKey(turn: number, step: number): string {
  return `${turn}:${step}`
}

function messageMetadata(event: SessionEvent): { provider: string; model: string } | undefined {
  if (event.type !== 'assistant/message') return undefined
  const message = event.data.message as unknown as Record<string, unknown>
  const source = message.source
  if (typeof source !== 'object' || source === null || Array.isArray(source)) return undefined
  const row = source as Record<string, unknown>
  return typeof row.provider === 'string' && typeof row.model === 'string'
    ? { provider: row.provider, model: row.model }
    : undefined
}

/** Resolve the versioned price for one request. */
export function resolveBillingPrice(provider: string, model: string, time: number): BillingPrice | undefined {
  if (findBalanceProvider(provider)?.id !== 'deepseek') return undefined
  const canonicalModel = model === 'deepseek-chat' || model === 'deepseek-reasoner'
    ? (time >= PEAK_EFFECTIVE_FROM ? 'deepseek-v4-flash' : model)
    : model
  const rates = time < PEAK_EFFECTIVE_FROM && canonicalModel === model
    ? LEGACY_PRICES[canonicalModel]
    : CURRENT_PRICES[canonicalModel]
  if (rates === undefined) return undefined
  return {
    provider: 'deepseek',
    model: canonicalModel,
    effectiveFrom: new Date(time < PEAK_EFFECTIVE_FROM ? 0 : PEAK_EFFECTIVE_FROM).toISOString(),
    pricingVersion: time < PEAK_EFFECTIVE_FROM ? 'deepseek-legacy' : BILLING_PRICING_VERSION,
    ...rates,
  }
}

/** Compute one request charge. Cache writes are billed as cache misses. */
export function calculateRequestCost(usage: BillingUsage, price: BillingPrice, time: number): number {
  const multiplier = findBalanceProvider(price.provider)?.id === 'deepseek' && isPeakHour(new Date(time)) ? 2 : 1
  const missTokens = usage.inputTokens + usage.cacheWriteTokens
  return roundMoney((
    missTokens * price.cacheMissUsdPerMillion
    + usage.cacheReadTokens * price.cacheHitUsdPerMillion
    + usage.outputTokens * price.outputUsdPerMillion
  ) / TOKENS_PER_MILLION * multiplier)
}

function dateKey(time: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time))
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year ?? '0000'}-${values.month ?? '00'}-${values.day ?? '00'}`
}

function inDateRange(time: number, timeZone: string, from: string | undefined, to: string | undefined): boolean {
  const day = dateKey(time, timeZone)
  return (from === undefined || day >= from) && (to === undefined || day <= to)
}

/** Fold a complete session log into request-level billing records. */
export function extractSessionUsage(
  sessionId: string,
  header: Pick<SessionHeader, 'seedLength'>,
  events: readonly SessionEvent[],
  options: Pick<UsageQuery, 'timeZone' | 'from' | 'to' | 'provider'>,
): UsageRequestRecord[] {
  // The inherited prefix is still needed to recover the first live request's header,
  // but its assistant messages must never be charged again in a fork.
  const seedLength = header.seedLength ?? 0
  let latestRequest: RequestContext | undefined
  const requests = new Map<string, { metadata: RequestContext | undefined; time: number }>()
  let activeStep: string | undefined
  const records: UsageRequestRecord[] = []

  for (const event of events) {
    if (event.type === 'request/header') {
      latestRequest = readRequestMetadata(event)
      // Harness writes changed headers after step/start, including retry changes.
      if (activeStep !== undefined) requests.set(activeStep, { metadata: latestRequest, time: event.time })
    }
    if (event.type === 'step/start') {
      activeStep = stepKey(event.data.turn, event.data.step)
      requests.set(activeStep, { metadata: latestRequest, time: event.time })
      continue
    }
    if (event.type === 'step/end') activeStep = undefined
    if (event.type !== 'assistant/message' || event.seq < seedLength) continue

    const request = requests.get(stepKey(event.data.turn, event.data.step))
    // The completed message records the actual call, even if selection changed in flight.
    const metadata = messageMetadata(event) ?? request?.metadata ?? latestRequest
    const provider = metadata === undefined ? null : (findBalanceProvider(metadata.provider)?.id ?? metadata.provider)
    const model = metadata?.model ?? null
    const time = request?.time ?? event.time
    if (options.provider !== undefined && provider !== (findBalanceProvider(options.provider)?.id ?? options.provider)) continue
    if (!inDateRange(time, options.timeZone, options.from, options.to)) continue

    const usage = readUsage(event.data.usage)
    const inputTokens = usage?.inputTokens ?? 0
    const outputTokens = usage?.outputTokens ?? 0
    const cacheReadTokens = usage?.cacheReadTokens ?? 0
    const cacheWriteTokens = usage?.cacheWriteTokens ?? 0
    let costUsd: number | null = null
    let pricingVersion: string | undefined
    let unknownReason: BillingUnknownReason | undefined
    if (usage === undefined) unknownReason = 'missing-usage'
    else if (provider === null || model === null) unknownReason = 'missing-request-metadata'
    else {
      const price = resolveBillingPrice(provider, model, time)
      if (price === undefined) unknownReason = findBalanceProvider(provider) !== undefined ? 'unknown-model' : 'unknown-provider'
      else {
        costUsd = calculateRequestCost(usage, price, time)
        pricingVersion = price.pricingVersion
      }
    }

    const record: UsageRequestRecord = {
      sessionId,
      turn: event.data.turn,
      step: event.data.step,
      time: new Date(time).toISOString(),
      provider,
      model,
      ...(usage === undefined ? {} : { usage }),
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUsd,
      ...(pricingVersion === undefined ? {} : { pricingVersion }),
      ...(unknownReason === undefined ? {} : { unknownReason }),
    }
    records.push(record)
  }

  return records
}

function aggregateRecords(
  records: readonly UsageRequestRecord[],
  sessionTitles: ReadonlyMap<string, string>,
  timeZone: string,
  usdToCny: number | null,
): { summary: UsageSummary; sessionRecords: SessionRecords[] } {
  const totals = emptyTotals()
  const models = new Map<string, MutableTotals & { provider: string; model: string }>()
  const days = new Map<string, MutableTotals & { date: string }>()
  const sessions = new Map<string, MutableTotals & { sessionId: string; title: string }>()

  for (const record of records) {
    addTotals(totals, record)
    const provider = record.provider ?? 'unknown'
    const model = record.model ?? 'unknown'
    const modelKey = JSON.stringify([provider, model])
    const modelTotal = models.get(modelKey) ?? { ...emptyTotals(), provider, model }
    addTotals(modelTotal, record)
    models.set(modelKey, modelTotal)

    const day = dateKey(Date.parse(record.time), timeZone)
    const dayTotal = days.get(day) ?? { ...emptyTotals(), date: day }
    addTotals(dayTotal, record)
    days.set(day, dayTotal)

    const sessionTotal = sessions.get(record.sessionId) ?? {
      ...emptyTotals(),
      sessionId: record.sessionId,
      title: sessionTitles.get(record.sessionId) ?? record.sessionId,
    }
    addTotals(sessionTotal, record)
    sessions.set(record.sessionId, sessionTotal)
  }

  const toAggregate = <T extends MutableTotals>(value: T): UsageTotals & Omit<T, keyof MutableTotals> => {
    const { requests, pricedRequests, unpricedRequests, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUsd } = value
    const totals = {
      requests,
      pricedRequests,
      unpricedRequests,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUsd: roundMoney(costUsd),
      costCny: usdToCny === null ? null : roundMoney(costUsd * usdToCny),
    }
    const extras = value as T & Partial<{
      provider: string
      model: string
      date: string
      sessionId: string
      title: string
    }>
    if (extras.provider !== undefined && extras.model !== undefined) return { ...totals, provider: extras.provider, model: extras.model } as unknown as UsageTotals & Omit<T, keyof MutableTotals>
    if (extras.date !== undefined) return { ...totals, date: extras.date } as unknown as UsageTotals & Omit<T, keyof MutableTotals>
    return { ...totals, sessionId: extras.sessionId ?? '', title: extras.title ?? '' } as unknown as UsageTotals & Omit<T, keyof MutableTotals>
  }

  const summary: UsageSummary = {
    timeZone,
    usdToCny,
    totals: toTotals(totals, usdToCny),
    byModel: [...models.values()].map(value => ({ ...toAggregate(value), provider: value.provider, model: value.model })),
    byDay: [...days.values()].map(value => ({ ...toAggregate(value), date: value.date })),
    bySession: [...sessions.values()].map(value => ({ ...toAggregate(value), sessionId: value.sessionId, title: value.title })),
  }
  summary.byModel.sort((a, b) => b.costUsd - a.costUsd || `${a.provider}/${a.model}`.localeCompare(`${b.provider}/${b.model}`))
  summary.byDay.sort((a, b) => b.date.localeCompare(a.date))
  summary.bySession.sort((a, b) => b.costUsd - a.costUsd || a.title.localeCompare(b.title))

  const sessionRecords = [...sessions.keys()].map(sessionId => ({
    session: summary.bySession.find(item => item.sessionId === sessionId) ?? {
      ...toTotals(emptyTotals(), usdToCny),
      sessionId,
      title: sessionTitles.get(sessionId) ?? sessionId,
    },
    records: records.filter(record => record.sessionId === sessionId),
  }))
  return { summary, sessionRecords }
}

export interface BillingSource {
  sessionId: string
  title: string
  header: Pick<SessionHeader, 'seedLength'>
  events: readonly SessionEvent[]
}

/** Aggregate one or many sessions for the settings page or session view. */
export function aggregateBilling(
  sources: readonly BillingSource[],
  options: Pick<UsageQuery, 'timeZone' | 'from' | 'to' | 'provider'> & { usdToCny?: number },
): { summary: UsageSummary; requestsBySession: ReadonlyMap<string, UsageRequestRecord[]> } {
  const records: UsageRequestRecord[] = []
  const titles = new Map<string, string>()
  for (const source of sources) {
    titles.set(source.sessionId, source.title)
    records.push(...extractSessionUsage(source.sessionId, source.header, source.events, options))
  }
  const aggregate = aggregateRecords(records, titles, options.timeZone, options.usdToCny ?? null)
  return {
    summary: aggregate.summary,
    requestsBySession: new Map(aggregate.sessionRecords.map(item => [item.session.sessionId, item.records])),
  }
}

/** Validate an IANA timezone before accepting it at the Host boundary. */
export function assertTimeZone(timeZone: string): void {
  new Intl.DateTimeFormat('en-US', { timeZone }).format()
}

/** Convert the configured USD rate into a JSON-safe optional amount. */
export function normalizeUsdToCny(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined
}
