'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { C, SERIF, SANS } from '@/lib/theme'
import type { CafeEvent, EventOrder, MenuItemRow, BuilderOption } from '@/types'

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ── Login gate ──────────────────────────────────────────────────────────────
function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true); setError('')
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) { setError(error.message); return }
    onLogin()
  }

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontFamily: SANS, fontSize: 15,
    padding: '11px 14px', borderRadius: 12, border: `1px solid ${C.rule}`, outline: 'none',
  }

  return (
    <main style={{ minHeight: '100vh', background: C.peach, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.card, borderRadius: 22, padding: 26, width: '100%', maxWidth: 380,
        boxShadow: '0 8px 24px rgba(30,58,95,0.1)' }}>
        <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 24, color: C.navy }}>Host sign-in</h1>
        <p style={{ fontFamily: SANS, fontSize: 13, color: C.ink2, marginTop: 4, marginBottom: 18 }}>
          Lazy Orchard Café admin
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="Email" value={email} autoComplete="username"
            onChange={e => setEmail(e.target.value)} style={field} />
          <input type="password" placeholder="Password" value={password} autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !busy) submit() }} style={field} />
          {error && <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.red }}>{error}</p>}
          <button onClick={submit} disabled={busy || !email || !password}
            style={{ padding: '12px 0', borderRadius: 999, border: 'none', background: C.navy,
              color: C.peach, fontFamily: SANS, fontSize: 14, fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy || !email || !password ? 0.5 : 1 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    </main>
  )
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
  const [event, setEvent] = useState<CafeEvent | null>(null)
  const [orders, setOrders] = useState<EventOrder[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([])
  const [builder, setBuilder] = useState<BuilderOption[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supa = getSupabase()
    const { data: active } = await supa.from('events').select('*').eq('is_active', true).maybeSingle()
    let ev = active as CafeEvent | null
    if (!ev) {
      const { data: latest } = await supa.from('events').select('*')
        .order('date', { ascending: false }).limit(1).maybeSingle()
      ev = latest as CafeEvent | null
    }
    setEvent(ev)
    if (!ev) { setLoading(false); return }
    const [o, mi, bo] = await Promise.all([
      supa.from('event_orders').select('*').eq('event_id', ev.id).eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supa.from('menu_items').select('*').eq('event_id', ev.id).order('sort_order', { ascending: true }),
      supa.from('builder_options').select('*').eq('event_id', ev.id)
        .order('category', { ascending: true }).order('sort_order', { ascending: true }),
    ])
    setOrders((o.data ?? []) as EventOrder[])
    setMenuItems((mi.data ?? []) as MenuItemRow[])
    setBuilder((bo.data ?? []) as BuilderOption[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Live order feed for the active event.
  useEffect(() => {
    if (!event) return
    const supa = getSupabase()
    const ch = supa.channel(`admin-${event.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'event_orders', filter: `event_id=eq.${event.id}` }, load)
      .subscribe()
    return () => { supa.removeChannel(ch) }
  }, [event, load])

  const markMade = async (id: string) => {
    await getSupabase().from('event_orders').update({ status: 'made' }).eq('id', id)
    setOrders(prev => prev.filter(o => o.id !== id))
  }
  const toggleSoldOut = async (item: MenuItemRow) => {
    await getSupabase().from('menu_items').update({ sold_out: !item.sold_out }).eq('id', item.id)
    setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, sold_out: !m.sold_out } : m))
  }
  const toggleAvailable = async (opt: BuilderOption) => {
    await getSupabase().from('builder_options').update({ available: !opt.available }).eq('id', opt.id)
    setBuilder(prev => prev.map(b => b.id === opt.id ? { ...b, available: !b.available } : b))
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
          <button onClick={onSignOut} style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600,
            color: C.midBlue, background: 'transparent', border: `1px solid ${C.rule}`,
            borderRadius: 999, padding: '6px 14px', cursor: 'pointer' }}>Sign out</button>
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
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supa = getSupabase()
    supa.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supa.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <main style={{ minHeight: '100vh', background: C.peach, display: 'flex',
        alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink3 }}>Loading…</p>
      </main>
    )
  }

  if (!session) return <LoginForm onLogin={() => { /* session arrives via onAuthStateChange */ }} />

  return <Dashboard onSignOut={() => getSupabase().auth.signOut()} />
}
