import type { EventOrder, EventOrderStatus } from '@/types'

/** One checkout: every item a guest ordered together. */
export type Ticket = {
  key: string
  guest: string
  createdAt: string
  items: EventOrder[]
}

/**
 * Everything checked out together is written in a single INSERT, so those rows
 * share an identical created_at (Postgres now() is per-transaction). That
 * timestamp plus the guest name identifies a ticket, with no extra column.
 * Input order is preserved.
 */
export function groupIntoTickets(orders: EventOrder[]): Ticket[] {
  const byKey = new Map<string, Ticket>()
  for (const o of orders) {
    const key = `${o.guest_name}|${o.created_at}`
    const existing = byKey.get(key)
    if (existing) existing.items.push(o)
    else byKey.set(key, { key, guest: o.guest_name, createdAt: o.created_at, items: [o] })
  }
  return [...byKey.values()]
}

/** A ticket is only done once every item on it is made. */
export const ticketStatus = (t: Ticket): EventOrderStatus =>
  t.items.every(i => i.status === 'made') ? 'made' : 'pending'
