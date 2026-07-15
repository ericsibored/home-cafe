'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { C, SERIF, SANS } from '@/lib/theme'
import type { CafeEvent, EventOrder, EventOrderStatus } from '@/types'

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ── Login gate (Supabase Auth — same account as /admin) ─────────────────────
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true); setError('')
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message)
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
        <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 24, color: C.navy }}>Staff sign-in</h1>
        <p style={{ fontFamily: SANS, fontSize: 13, color: C.ink2, marginTop: 4, marginBottom: 18 }}>
          Order queue · Lazy Orchard Café
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

type Filter = EventOrderStatus | 'all'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'To make' },
  { value: 'made', label: 'Made' },
  { value: 'all', label: 'All' },
]

// ── The live queue ──────────────────────────────────────────────────────────
function Queue({ onSignOut }: { onSignOut: () => void }) {
  const [event, setEvent] = useState<CafeEvent | null>(null)
  const [orders, setOrders] = useState<EventOrder[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
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
    const { data } = await supa.from('event_orders').select('*').eq('event_id', ev.id)
      .order('created_at', { ascending: false })
    setOrders((data ?? []) as EventOrder[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!event) return
    const supa = getSupabase()
    const ch = supa.channel(`orders-queue-${event.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'event_orders', filter: `event_id=eq.${event.id}` }, load)
      .subscribe()
    return () => { supa.removeChannel(ch) }
  }, [event, load])

  const setStatus = async (id: string, status: EventOrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    await getSupabase().from('event_orders').update({ status }).eq('id', id)
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length
  const shown = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  return (
    <main style={{ minHeight: '100vh', background: C.peach, paddingBottom: 40 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: C.blue, padding: '12px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, color: C.navy }}>Order queue</div>
          <div style={{ fontFamily: SANS, fontSize: 12, color: C.blueDeep }}>
            {event ? event.name : 'No event'} · {pendingCount} to make
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
          const n = f.value === 'all' ? orders.length : orders.filter(o => o.status === f.value).length
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
        ) : shown.map(o => {
          const made = o.status === 'made'
          return (
            <div key={o.id} style={{ background: C.card, borderRadius: 16, padding: '14px 16px',
              boxShadow: '0 2px 12px rgba(30,58,95,0.08)', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12, opacity: made ? 0.6 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SERIF, fontSize: 17, color: C.navy,
                  textDecoration: made ? 'line-through' : 'none' }}>{o.label}</div>
                <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.midBlue, marginTop: 2 }}>
                  {o.guest_name} · {o.item_type === 'builder' ? 'build-your-own' : 'specialty'} · {timeAgo(o.created_at)}
                </div>
              </div>
              {made ? (
                <button onClick={() => setStatus(o.id, 'pending')} style={{ flexShrink: 0, fontFamily: SANS,
                  fontSize: 12.5, fontWeight: 600, padding: '8px 14px', borderRadius: 999,
                  border: `1px solid ${C.rule}`, background: 'transparent', color: C.midBlue, cursor: 'pointer' }}>
                  Undo
                </button>
              ) : (
                <button onClick={() => setStatus(o.id, 'made')} style={{ flexShrink: 0, fontFamily: SANS,
                  fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 999, border: 'none',
                  background: C.green, color: C.card, cursor: 'pointer' }}>
                  Mark made
                </button>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}

export default function OrdersPage() {
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
  if (!session) return <LoginForm />
  return <Queue onSignOut={() => getSupabase().auth.signOut()} />
}
