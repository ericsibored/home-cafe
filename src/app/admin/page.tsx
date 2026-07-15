'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { C, SERIF, SANS } from '@/lib/theme'
import { staffHeaders } from '@/lib/staff'
import { PasswordGate } from '@/app/_components/PasswordGate'
import type { EventOrder, MenuItemRow, BuilderOption } from '@/types'

type AdminEvent = { id: string; name: string; date: string; is_active: boolean }

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}


// ── Toggle pill ─────────────────────────────────────────────────────────────
function Toggle({ on, onLabel, offLabel, onClick }: {
  on: boolean; onLabel: string; offLabel: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      fontFamily: SANS, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999,
      border: 'none', cursor: 'pointer',
      background: on ? 'rgba(201,84,80,0.12)' : 'rgba(62,155,107,0.12)',
      color: on ? C.red : C.green,
    }}>
      {on ? onLabel : offLabel}
    </button>
  )
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [event, setEvent] = useState<AdminEvent | null>(null)
  const [orders, setOrders] = useState<EventOrder[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([])
  const [builder, setBuilder] = useState<BuilderOption[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    // Orders come through the staff API (service role); menus are public read.
    const res = await fetch('/api/event-orders', { headers: staffHeaders, cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    const ev = (body.event ?? null) as AdminEvent | null
    setEvent(ev)
    setOrders(((body.orders ?? []) as EventOrder[]).filter(o => o.status === 'pending'))
    if (!ev) { setMenuItems([]); setBuilder([]); setLoading(false); return }
    const supa = getSupabase()
    const [mi, bo] = await Promise.all([
      supa.from('menu_items').select('*').eq('event_id', ev.id).order('sort_order', { ascending: true }),
      supa.from('builder_options').select('*').eq('event_id', ev.id)
        .order('category', { ascending: true }).order('sort_order', { ascending: true }),
    ])
    setMenuItems((mi.data ?? []) as MenuItemRow[])
    setBuilder((bo.data ?? []) as BuilderOption[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 4000)   // poll the staff order feed
    return () => clearInterval(iv)
  }, [load])

  const markMade = async (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id))
    await fetch('/api/event-orders', { method: 'PATCH', headers: staffHeaders, body: JSON.stringify({ id, status: 'made' }) })
  }
  const toggleSoldOut = async (item: MenuItemRow) => {
    setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, sold_out: !m.sold_out } : m))
    await fetch('/api/menu-items', { method: 'PATCH', headers: staffHeaders, body: JSON.stringify({ id: item.id, sold_out: !item.sold_out }) })
  }
  const toggleAvailable = async (opt: BuilderOption) => {
    setBuilder(prev => prev.map(b => b.id === opt.id ? { ...b, available: !b.available } : b))
    await fetch('/api/builder-options', { method: 'PATCH', headers: staffHeaders, body: JSON.stringify({ id: opt.id, available: !opt.available }) })
  }

  const card: React.CSSProperties = {
    background: C.card, borderRadius: 16, padding: 16, boxShadow: `inset 0 0 0 1px ${C.rule}`,
  }
  const sectionTitle: React.CSSProperties = {
    fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, color: C.navy, marginBottom: 12,
  }

  return (
    <main style={{ minHeight: '100vh', background: C.peach, paddingBottom: 40 }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 26, color: C.navy }}>Host dashboard</h1>
            <p style={{ fontFamily: SANS, fontSize: 13, color: C.midBlue, marginTop: 2 }}>
              {event ? event.name : 'No event yet'}
              {event && !event.is_active && ' · not currently active'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <Link href="/orders" style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600,
              color: C.navy, textDecoration: 'none', border: `1px solid ${C.rule}`,
              borderRadius: 999, padding: '6px 12px' }}>Order queue →</Link>
            <button onClick={onSignOut} style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600,
              color: C.midBlue, background: 'transparent', border: `1px solid ${C.rule}`,
              borderRadius: 999, padding: '6px 14px', cursor: 'pointer' }}>Sign out</button>
          </div>
        </div>

        {loading ? (
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink3, marginTop: 40, textAlign: 'center' }}>Loading…</p>
        ) : !event ? (
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink3, marginTop: 40, textAlign: 'center' }}>
            No events exist yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30, marginTop: 28 }}>
            {/* Pending orders */}
            <section>
              <h2 style={sectionTitle}>Pending orders ({orders.length})</h2>
              {orders.length === 0 ? (
                <div style={{ ...card, textAlign: 'center', color: C.ink3, fontFamily: SANS, fontSize: 13 }}>
                  No pending orders — all caught up ☕
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {orders.map(o => (
                    <div key={o.id} style={{ ...card, display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: SERIF, fontSize: 16, color: C.navy }}>{o.label}</div>
                        <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.midBlue, marginTop: 2 }}>
                          {o.guest_name} · {timeAgo(o.created_at)}
                        </div>
                      </div>
                      <button onClick={() => markMade(o.id)} style={{ flexShrink: 0, fontFamily: SANS,
                        fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 999, border: 'none',
                        background: C.green, color: C.card, cursor: 'pointer' }}>Mark made</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Sold-out toggles */}
            <section>
              <h2 style={sectionTitle}>Specialties</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {menuItems.map(m => (
                  <div key={m.id} style={{ ...card, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 12, opacity: m.sold_out ? 0.7 : 1 }}>
                    <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.navy }}>{m.name}</span>
                    <Toggle on={m.sold_out} onLabel="Sold out — tap to restock" offLabel="Available — tap to sell out"
                      onClick={() => toggleSoldOut(m)} />
                  </div>
                ))}
              </div>
            </section>

            {/* Builder availability */}
            {builder.length > 0 && (
              <section>
                <h2 style={sectionTitle}>Build-your-own options</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {builder.map(b => (
                    <div key={b.id} style={{ ...card, display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12, opacity: b.available ? 1 : 0.7 }}>
                      <span style={{ fontFamily: SANS, fontSize: 14, color: C.navy }}>
                        <span style={{ color: C.ink3, textTransform: 'uppercase', fontSize: 11,
                          fontWeight: 700, marginRight: 8 }}>{b.category}</span>
                        {b.name}
                      </span>
                      <Toggle on={!b.available} onLabel="Unavailable — tap to enable" offLabel="Available — tap to disable"
                        onClick={() => toggleAvailable(b)} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  return (
    <PasswordGate title="Host access" subtitle="Admin · Lazy Orchard Café">
      {signOut => <Dashboard onSignOut={signOut} />}
    </PasswordGate>
  )
}
