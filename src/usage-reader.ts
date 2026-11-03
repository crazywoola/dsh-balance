import type { SessionPersistence, SessionPersistenceSnapshot } from '@deepseek-ai/dsh-session-persistence'
import { extractSessionUsage } from './billing.ts'
import type { BillingRecordsSource } from './billing.ts'

function sessionTitle(events: readonly { type: string; data: unknown }[], fallback: string): string {
  let title = fallback
  for (const event of events) {
    if (event.type !== 'session/title' || typeof event.data !== 'object' || event.data === null || Array.isArray(event.data)) continue
    const value = (event.data as Record<string, unknown>).title
    if (typeof value === 'string' && value.trim().length > 0) title = value
  }
  return title
}

/** One log at a time across all HTTP queries; only compact usage survives a read. */
export class UsageReader {
  private readonly cache = new Map<string, { revision: string; source: BillingRecordsSource }>()
  private readonly pending = new Map<string, Promise<BillingRecordsSource>>()
  private tail: Promise<void> = Promise.resolve()

  constructor(private readonly persistence: SessionPersistence) {}

  prune(snapshots: readonly SessionPersistenceSnapshot[]): void {
    const ids = new Set(snapshots.map(snapshot => String(snapshot.header.id)))
    for (const id of this.cache.keys()) if (!ids.has(id)) this.cache.delete(id)
  }

  read(snapshot: SessionPersistenceSnapshot, refresh: boolean): Promise<BillingRecordsSource> {
    const id = String(snapshot.header.id)
    const revision = JSON.stringify(snapshot.revision)
    const key = JSON.stringify([id, revision])
    // A forced refresh still joins an identical read already in progress.
    const active = this.pending.get(key)
    if (active !== undefined) return active
    const cached = this.cache.get(id)
    if (!refresh && cached?.revision === revision) return Promise.resolve(cached.source)

    const operation = this.tail.then(async () => {
      // Do not retain a prior revision (or serve it after a forced read fails).
      this.cache.delete(id)
      const handle = await this.persistence.open(snapshot.header.id, 'read')
      let source: BillingRecordsSource
      try {
        const { events } = await handle.read()
        source = {
          sessionId: id,
          title: sessionTitle(events, id),
          records: extractSessionUsage(id, handle.inheritedEventCount, events, { timeZone: 'UTC' }),
        }
      } finally {
        await handle.close()
      }
      this.cache.set(id, { revision, source })
      return source
    })
    this.pending.set(key, operation)
    this.tail = operation.then(() => { this.pending.delete(key) }, () => { this.pending.delete(key) })
    return operation
  }
}
