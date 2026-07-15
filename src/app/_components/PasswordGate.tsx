'use client'

import { useEffect, useState } from 'react'
import { C, SERIF, SANS } from '@/lib/theme'
import { STAFF_PASSWORD } from '@/lib/staff'

// Simple shared-password gate (no username). Persists in sessionStorage so it
// isn't asked again for the session. Wrap staff pages: <PasswordGate title=...>
export function PasswordGate({ title, subtitle, children }: {
  title: string
  subtitle?: string
  children: (signOut: () => void) => React.ReactNode
}) {
  const [authed, setAuthed] = useState(false)
  const [ready, setReady] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    try { if (sessionStorage.getItem('staff_authed') === '1') setAuthed(true) } catch {}
    setReady(true)
  }, [])

  const submit = () => {
    if (pw === STAFF_PASSWORD) {
      try { sessionStorage.setItem('staff_authed', '1') } catch {}
      setAuthed(true)
    } else { setError(true); setPw('') }
  }
  const signOut = () => { try { sessionStorage.removeItem('staff_authed') } catch {}; setAuthed(false) }

  if (!ready) return <main style={{ minHeight: '100vh', background: C.peach }} />
  if (authed) return <>{children(signOut)}</>

  return (
    <main style={{ minHeight: '100vh', background: C.peach, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.card, borderRadius: 22, padding: 26, width: '100%', maxWidth: 340,
        boxShadow: '0 8px 24px rgba(30,58,95,0.1)' }}>
        <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 24, color: C.navy }}>{title}</h1>
        <p style={{ fontFamily: SANS, fontSize: 13, color: C.ink2, marginTop: 4, marginBottom: 18 }}>
          {subtitle ?? 'Lazy Orchard Café'}
        </p>
        <input type="password" placeholder="Password" value={pw} autoFocus autoComplete="current-password"
          onChange={e => { setPw(e.target.value); setError(false) }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: SANS, fontSize: 15,
            padding: '11px 14px', borderRadius: 12, border: `1px solid ${error ? C.red : C.rule}`, outline: 'none' }} />
        {error && <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.red, marginTop: 8 }}>Incorrect password</p>}
        <button onClick={submit} disabled={!pw}
          style={{ width: '100%', marginTop: 14, padding: '12px 0', borderRadius: 999, border: 'none',
            background: C.navy, color: C.peach, fontFamily: SANS, fontSize: 14, fontWeight: 700,
            cursor: pw ? 'pointer' : 'not-allowed', opacity: pw ? 1 : 0.5 }}>
          Enter
        </button>
      </div>
    </main>
  )
}
