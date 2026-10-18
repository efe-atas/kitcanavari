import { REMOVED_ACK } from '../store'
import type { Change, ChangesFile, CoursesFile, UserState } from '../types'

export interface Alert {
  eventId: string
  title: string
  removed: boolean
  changes: Change[]
}

/** Selected events whose schedule-relevant fingerprint changed (or that vanished) since the user last acknowledged. */
export function pendingAlerts(state: UserState, data: CoursesFile, changes: ChangesFile): Alert[] {
  const out: Alert[] = []
  for (const [id, entry] of Object.entries(state.selected)) {
    const ev = data.events[id]
    if (ev ? ev.fingerprint === entry.ackFingerprint : entry.ackFingerprint === REMOVED_ACK) continue
    const mine = changes.entries.filter((c) => c.eventId === id)
    const fresh = mine.filter((c) => c.at > state.lastSeenScrapedAt)
    out.push({
      eventId: id,
      title: ev?.title ?? entry.title ?? mine[0]?.eventTitle ?? id,
      removed: !ev,
      changes: fresh.length ? fresh : mine,
    })
  }
  return out.sort((a, b) => a.title.localeCompare(b.title))
}
