'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { C, SERIF, SANS } from '@/lib/theme'
import type { CollageEntry } from '@/types'

type WallEvent = { id: string; name: string; date: string; is_active: boolean }

function formatEventDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

const ROTATIONS = ['rotate(-2deg)', 'rotate(1.5deg)', 'rotate(-1deg)', 'rotate(2.2deg)', 'rotate(-1.6deg)', 'rotate(1deg)']

// Downscale a chosen photo before upload to keep the base64 payload small.
function fileToScaledDataUrl(file: File, max = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no canvas')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// In-page camera with a front/back flip control. Falls back to the native
// capture input (handled by the caller) when getUserMedia is unavailable.
function CameraModal({ onCapture, onClose, onUnavailable }: {
  onCapture: (dataUrl: string) => void
  onClose: () => void
  onUnavailable: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) { onUnavailable(); return }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setReady(true)
    }).catch(() => { if (!cancelled) onUnavailable() })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [facing, onUnavailable])

  const snap = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const max = 1200
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight))
    const w = Math.round(video.videoWidth * scale)
    const h = Math.round(video.videoHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Mirror selfies so the saved photo matches the mirrored preview.
    if (facing === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1) }
    ctx.drawImage(video, 0, 0, w, h)
    onCapture(canvas.toDataURL('image/jpeg', 0.85))
  }

  const roundBtn: React.CSSProperties = {
    borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: SANS, fontWeight: 700,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,25,40,0.92)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <video ref={videoRef} playsInline muted autoPlay
          style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 20, background: '#000',
            transform: facing === 'user' ? 'scaleX(-1)' : 'none', display: 'block' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <button onClick={onClose} aria-label="Close camera"
            style={{ ...roundBtn, width: 52, height: 52, fontSize: 18, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            ✕
          </button>
          <button onClick={snap} disabled={!ready} aria-label="Take photo"
            style={{ ...roundBtn, width: 72, height: 72, background: '#fff', opacity: ready ? 1 : 0.4,
              boxShadow: 'inset 0 0 0 4px rgba(15,25,40,0.9), inset 0 0 0 6px #fff' }} />
          <button onClick={() => { setReady(false); setFacing(f => f === 'user' ? 'environment' : 'user') }}
            aria-label="Switch camera"
            style={{ ...roundBtn, width: 52, height: 52, fontSize: 20, background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            🔄
          </button>
        </div>
        <p style={{ fontFamily: SANS, fontSize: 12, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 10 }}>
          {facing === 'user' ? 'Front camera' : 'Back camera'} · tap 🔄 to switch
        </p>
      </div>
    </div>
  )
}

function Polaroid({ entry, i }: { entry: CollageEntry; i: number }) {
  return (
    <div style={{ background: C.card, padding: '10px 10px 16px', transform: ROTATIONS[i % ROTATIONS.length],
      boxShadow: '0 6px 18px rgba(30,58,95,0.15)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={entry.photo_url} alt={entry.guest_name}
        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', background: C.surface }} />
      <p style={{ textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: C.navy, marginTop: 8 }}>
        {entry.guest_name}
      </p>
      {entry.note && (
        <p style={{ textAlign: 'center', fontFamily: SANS, fontSize: 11, color: C.ink3, marginTop: 2 }}>
          &ldquo;{entry.note}&rdquo;
        </p>
      )}
    </div>
  )
}

export default function WallPage() {
  const [events, setEvents] = useState<WallEvent[]>([])
  const [entries, setEntries] = useState<CollageEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [captured, setCaptured] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [note, setNote] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  // If in-page camera access fails (denied / unsupported / not https),
  // fall back to the native capture input.
  const cameraUnavailable = useCallback(() => {
    setCameraOpen(false)
    cameraRef.current?.click()
  }, [])

  const load = useCallback(async () => {
    const supa = getSupabase()
    const [ev, en] = await Promise.all([
      supa.from('events').select('id, name, date, is_active').order('date', { ascending: false }),
      fetch('/api/collage').then(r => r.json()).catch(() => []),
    ])
    setEvents((ev.data ?? []) as WallEvent[])
    setEntries(Array.isArray(en) ? (en as CollageEntry[]) : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Posting is only open during a genuinely live event.
  const activeEvent = useMemo(
    () => events.find(e => e.is_active) ?? null,
    [events],
  )

  // Group photos under their event, newest events first; keep the active event
  // visible even with no photos yet.
  const groups = useMemo(() => events
    .map(ev => ({ event: ev, photos: entries.filter(en => en.event_id === ev.id) }))
    .filter(g => g.photos.length > 0 || g.event.id === activeEvent?.id),
    [events, entries, activeEvent])

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try { setCaptured(await fileToScaledDataUrl(file)) }
    catch { setError('Could not read that image. Try another.') }
    e.target.value = ''
  }

  const post = async () => {
    if (!captured) { setError('Add a photo first.'); return }
    if (!guestName.trim()) { setError('Please enter your name.'); return }
    if (!activeEvent) { setError('No event is live right now.'); return }
    setPosting(true); setError('')
    try {
      const res = await fetch('/api/collage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoBase64: captured, note: note.trim() || null, guestName: guestName.trim(), eventId: activeEvent.id }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed to post')
      setEntries(prev => [body as CollageEntry, ...prev])
      setCaptured(null); setGuestName(''); setNote(''); setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setPosting(false)
    }
  }

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontFamily: SANS, fontSize: 14,
    padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.rule}`, outline: 'none', background: C.card,
  }

  return (
    <main style={{ minHeight: '100vh', background: C.peach, paddingBottom: 48 }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 18px 0' }}>
        <Link href="/" style={{ display: 'inline-flex', gap: 6, fontFamily: SANS, fontSize: 13,
          color: C.midBlue, textDecoration: 'none', marginBottom: 14 }}>← Home</Link>
        <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 30, color: C.navy }}>Photo wall</h1>
        <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink2, marginTop: 6 }}>
          Little photo memories from every Lazy Orchard pop-up.
        </p>

        {/* Add your photo — posts to the active event */}
        <div style={{ marginTop: 20, background: C.card, borderRadius: 20, padding: 18,
          boxShadow: '0 4px 16px rgba(30,58,95,0.1)' }}>
          {activeEvent ? (
            <>
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, color: C.navy }}>
                Add yourself to the wall 📸
              </div>
              <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink3, marginTop: 2, marginBottom: 14 }}>
                Posting to {activeEvent.name}
              </div>

              {/* capture="user" opens the front-facing (selfie) camera; the
                  capture-less input opens the photo library / camera roll. */}
              <input ref={cameraRef} type="file" accept="image/*" capture="user"
                onChange={onPick} style={{ display: 'none' }} />
              <input ref={libraryRef} type="file" accept="image/*"
                onChange={onPick} style={{ display: 'none' }} />

              {captured ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: C.card, padding: '10px 10px 14px', maxWidth: 240, width: '100%',
                    boxShadow: '0 6px 18px rgba(30,58,95,0.15)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={captured} alt="preview" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input placeholder="Your first name *" maxLength={40} value={guestName}
                      onChange={e => setGuestName(e.target.value)} style={field} />
                    <input placeholder="A little message… (optional)" maxLength={80} value={note}
                      onChange={e => setNote(e.target.value)} style={field} />
                    {error && <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.red }}>{error}</p>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setCaptured(null); setError('') }} style={{ flex: 1, padding: '11px 0',
                        borderRadius: 999, border: `1px solid ${C.rule}`, background: 'transparent',
                        fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.midBlue, cursor: 'pointer' }}>
                        Retake
                      </button>
                      <button onClick={post} disabled={posting} style={{ flex: 2, padding: '11px 0', borderRadius: 999,
                        border: 'none', background: C.navy, color: C.peach, fontFamily: SANS, fontSize: 14, fontWeight: 700,
                        cursor: posting ? 'not-allowed' : 'pointer', opacity: posting ? 0.5 : 1 }}>
                        {posting ? 'Posting…' : 'Post to wall'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {error && <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.red, marginBottom: 10 }}>{error}</p>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setCameraOpen(true)} style={{ flex: '1 1 160px', padding: '14px 0',
                      borderRadius: 999, border: 'none', background: C.navy, color: C.peach, fontFamily: SANS,
                      fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                      🤳 Take a photo
                    </button>
                    <button onClick={() => libraryRef.current?.click()} style={{ flex: '1 1 160px', padding: '14px 0',
                      borderRadius: 999, border: `1.5px solid ${C.navy}`, background: 'transparent', color: C.navy,
                      fontFamily: SANS, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                      🖼️ Camera roll
                    </button>
                  </div>
                  {done && <p style={{ fontFamily: SANS, fontSize: 13, color: C.green, textAlign: 'center', marginTop: 10 }}>
                    Added to the wall — thanks! ☕</p>}
                </>
              )}
            </>
          ) : (
            <p style={{ fontFamily: SANS, fontSize: 13, color: C.ink3, textAlign: 'center' }}>
              No event is live right now — check back during the next pop-up.
            </p>
          )}
        </div>
      </div>

      {cameraOpen && (
        <CameraModal
          onCapture={dataUrl => { setError(''); setCaptured(dataUrl); setCameraOpen(false) }}
          onClose={() => setCameraOpen(false)}
          onUnavailable={cameraUnavailable}
        />
      )}

      {/* Photos grouped by event */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 18px 0' }}>
        {loading ? (
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink3, textAlign: 'center', padding: '32px 0' }}>Loading…</p>
        ) : groups.every(g => g.photos.length === 0) ? (
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink3, textAlign: 'center', padding: '32px 0' }}>
            No photos yet — be the first! 📸
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
            {groups.filter(g => g.photos.length > 0).map(({ event, photos }) => (
              <section key={event.id}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                  <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 21, color: C.navy }}>{event.name}</h2>
                  {event.is_active && (
                    <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: 0.5, color: C.green, background: 'rgba(62,155,107,0.12)', borderRadius: 999, padding: '2px 8px' }}>
                      Live
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: SANS, fontSize: 12, color: C.midBlue, marginBottom: 14 }}>
                  {formatEventDate(event.date)} · {photos.length} photo{photos.length === 1 ? '' : 's'}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
                  {photos.map((entry, i) => <Polaroid key={entry.id} entry={entry} i={i} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
