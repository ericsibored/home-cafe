'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { C, SERIF, SANS } from '@/lib/theme'
import { staffHeaders } from '@/lib/staff'
import { PasswordGate } from '@/app/_components/PasswordGate'
import type { EventOrder, EventOrderStatus } from '@/types'

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

type Filter = EventOrderStatus | 'all'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'To make' },
  { value: 'made', label: 'Made' },
  { value: 'all', label: 'All' },
]

// Everything checked out together lands in one INSERT, so those rows share an
// identical created_at — that plus the guest name identifies a ticket.
type Ticket = { key: string; guest: string; createdAt: string; items: EventOrder[] }

function groupIntoTickets(orders: EventOrder[]): Ticket[] {
  const byKey = new Map<string, Ticket>()
  for (const o of orders) {
    const key = `${o.guest_name}|${o.created_at}`
    const existing = byKey.get(key)
    if (existing) existing.items.push(o)
    else byKey.set(key, { key, guest: o.guest_name, createdAt: o.created_at, items: [o] })
  }
  return [...byKey.values()]
}

const ticketStatus = (t: Ticket): EventOrderStatus =>
  t.items.every(i => i.status === 'made') ? 'made' : 'pending'

// ── The live queue (polls the staff API) ────────────────────────────────────
function Queue({ onSignOut }: { onSignOut: () => void }) {
  const [eventName, setEventName] = useState<string | null>(null)
  const [orders, setOrders] = useState<EventOrder[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/event-orders', { headers: staffHeaders, cache: 'no-store' })
      const body = await res.json()
      if (res.ok) {
        setEventName(body.event?.name ?? null)
        setOrders((body.orders ?? []) as EventOrder[])
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 4000)               // live-ish without exposing orders to anon
    const onFocus = () => { if (document.visibilityState !== 'hidden') load() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('focus', onFocus) }
  }, [load])

  const setStatus = async (id: string, status: EventOrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    await fetch('/api/event-orders', { method: 'PATCH', headers: staffHeaders, body: JSON.stringify({ id, status }) })
    load()
  }

  // Update every item on a ticket at once.
  const setManyStatus = async (ids: string[], status: EventOrderStatus) => {
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status } : o))
    await Promise.all(ids.map(id => fetch('/api/event-orders', {
      method: 'PATCH', headers: staffHeaders, body: JSON.stringify({ id, status }),
    })))
    load()
  }

  const tickets = useMemo(() => groupIntoTickets(orders), [orders])
  const pendingCount = tickets.filter(t => ticketStatus(t) === 'pending').length
  const shown = filter === 'all' ? tickets : tickets.filter(t => ticketStatus(t) === filter)

  return (
    <main style={{ minHeight: '100vh', background: C.peach, paddingBottom: 40 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: C.blue, padding: '12px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, color: C.navy }}>Order queue</div>
          <div style={{ fontFamily: SANS, fontSize: 12, color: C.blueDeep }}>
            {eventName ?? 'No event'} · {pendingCount} ticket{pendingCount === 1 ? '' : 's'} to make
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/admin" style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: C.navy,
            textDecoration: 'none' }}>Admin →</Link>
          <button onClick={onSignOut} style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600,
            color: C.navy, background: 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 999,
            padding: '5px 12px', cursor: 'pointer' }}>Sign out</button>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 18px 0',
        display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const n = f.value === 'all' ? tickets.length : tickets.filter(t => ticketStatus(t) === f.value).length
          return (
            <button key={f.value} onClick={() => setFilter(f.value)}
              style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
                border: 'none', cursor: 'pointer',
                background: filter === f.value ? C.navy : C.card,
                color: filter === f.value ? C.peach : C.midBlue,
                boxShadow: filter === f.value ? 'none' : `inset 0 0 0 1px ${C.rule}` }}>
              {f.label}{n > 0 ? ` (${n})` : ''}
            </button>
          )
        })}
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px 18px 0',
        display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink3, textAlign: 'center', padding: '40px 0' }}>Loading…</p>
        ) : shown.length === 0 ? (
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink3, textAlign: 'center', padding: '40px 0' }}>
            {filter === 'pending' ? 'No orders to make — all caught up ☕' : 'No orders.'}
          </p>
        ) : shown.map(t => {
          const done = ticketStatus(t) === 'made'
          const ids = t.items.map(i => i.id)
          const remaining = t.items.filter(i => i.status === 'pending').length
          return (
            <div key={t.key} style={{ background: C.card, borderRadius: 16, padding: '14px 16px',
              boxShadow: '0 2px 12px rgba(30,58,95,0.08)', opacity: done ? 0.6 : 1 }}>
              {/* Ticket header — one guest, one checkout */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: SERIF, fontSize: 18, color: C.navy }}>{t.guest}</div>
                <div style={{ fontFamily: SANS, fontSize: 12, color: C.midBlue }}>
                  {t.items.length} item{t.items.length === 1 ? '' : 's'}
                  {!done && remaining !== t.items.length ? ` · ${remaining} left` : ''} · {timeAgo(t.createdAt)}
                </div>
              </div>

              {/* Items — each can be ticked off on its own */}
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {t.items.map(o => {
                  const made = o.status === 'made'
                  return (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                      justifyContent: 'space-between' }}>
                      <div style={{ minWidth: 0, fontFamily: SANS, fontSize: 14,
                        color: made ? C.ink3 : C.navy,
                        textDecoration: made ? 'line-through' : 'none' }}>
                        {o.label}
                      </div>
                      <button onClick={() => setStatus(o.id, made ? 'pending' : 'made')}
                        aria-label={made ? `Undo ${o.label}` : `Mark ${o.label} made`}
                        style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, cursor: 'pointer',
                          border: made ? 'none' : `1.5px solid ${C.rule}`,
                          background: made ? C.green : 'transparent',
                          color: made ? C.card : C.midBlue, fontSize: 14, lineHeight: 1 }}>
                        ✓
                      </button>
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.rule}`,
                display: 'flex', justifyContent: 'flex-end' }}>
                {done ? (
                  <button onClick={() => setManyStatus(ids, 'pending')} style={{ fontFamily: SANS,
                    fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 999,
                    border: `1px solid ${C.rule}`, background: 'transparent', color: C.midBlue, cursor: 'pointer' }}>
                    Undo ticket
                  </button>
                ) : (
                  <button onClick={() => setManyStatus(ids, 'made')} style={{ fontFamily: SANS,
                    fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 999, border: 'none',
                    background: C.green, color: C.card, cursor: 'pointer' }}>
                    Mark ticket made
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}

export default function OrdersPage() {
  return (
    <PasswordGate title="Staff access" subtitle="Order queue · Lazy Orchard Café">
      {signOut => <Queue onSignOut={signOut} />}
    </PasswordGate>
  )
}
