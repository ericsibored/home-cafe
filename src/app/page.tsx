'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { MENU, CATEGORIES } from '@/lib/menu'
import type { MenuItem, OrderItem } from '@/types'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  peach:     '#f6e7d7',
  blue:      '#8fafee',
  blueHover: '#7a9de6',
  blueDeep:  '#3a5f9e',
  navy:      '#1e3a5f',
  midBlue:   '#4a6fa8',
  pale:      '#d9e8fa',
  paleHover: '#c5d8f6',
  surface:   '#fcf3e7',
  card:      '#ffffff',
  green:     '#3e9b6b',
  amber:     '#c98842',
  red:       '#c95450',
  venmo:     '#3D95CE',
  ink2:      'rgba(30,58,95,0.62)',
  ink3:      'rgba(30,58,95,0.42)',
  rule:      'rgba(30,58,95,0.10)',
  ruleSoft:  'rgba(30,58,95,0.06)',
} as const

const SERIF = 'var(--font-newsreader), Georgia, serif'
const SANS  = 'var(--font-geist-sans), system-ui, sans-serif'
const MONO  = 'var(--font-geist-mono), monospace'

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = 'menu' | 'rank'
type CatFilter = 'all' | 'drinks' | 'food'

interface PlacedOrder {
  id: string
  total: number
  venmoNote: string
  ticketCode?: string
  items: OrderItem[]
  name: string
}

interface Review {
  id: string
  reviewer_name: string
  rating: number
  comment: string | null
  created_at: string
  item_id?: string | null
  ticket_code?: string | null
}

// ── LazyLogo SVG ──────────────────────────────────────────────────────────────
function LazyLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="peach-grad" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0%" stopColor="#fbd4b2" />
          <stop offset="60%" stopColor="#f4b485" />
          <stop offset="100%" stopColor="#d98c5f" />
        </radialGradient>
      </defs>
      <path d="M32 12 C20 12 10 22 10 36 C10 50 20 58 32 58 C44 58 54 50 54 36 C54 22 44 12 32 12 Z"
        fill="url(#peach-grad)" stroke="#1e3a5f" strokeWidth="2"/>
      <path d="M32 14 Q30 30 32 50" stroke="#1e3a5f" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.55"/>
      <path d="M30 10 C24 4 14 4 12 10 C18 14 26 14 30 10 Z" fill="#8fafee" stroke="#1e3a5f" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M14 8 Q20 10 28 10" stroke="#1e3a5f" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6"/>
      <path d="M30 10 Q33 8 35 11" stroke="#1e3a5f" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

// ── Stars SVG ─────────────────────────────────────────────────────────────────
function Stars({ value = 5, size = 12, color = C.blue }: { value?: number; size?: number; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 12 12">
          <path d="M6 1l1.5 3.2 3.5.4-2.6 2.4.7 3.4L6 8.8l-3.1 1.6.7-3.4L1 4.6l3.5-.4L6 1z"
            fill={i < value ? color : 'transparent'} stroke={color} strokeWidth="0.8" strokeLinejoin="round"/>
        </svg>
      ))}
    </span>
  )
}

// ── PulseDot ──────────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  return (
    <span style={{ position: 'relative', width: 10, height: 10, display: 'inline-block', flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
      <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: color, opacity: 0.25 }} />
    </span>
  )
}

// ── Steps progress bar ────────────────────────────────────────────────────────
function Steps({ active = 0 }: { active?: number }) {
  const labels = ['paid', 'making', 'ready', 'picked up']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {labels.map((s, i) => (
        <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: '100%', height: 4, borderRadius: 4, background: i <= active ? C.blue : C.rule }} />
          <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600,
            color: i <= active ? C.navy : C.ink3,
            textTransform: 'uppercase', letterSpacing: 0.4 }}>{s}</span>
        </div>
      ))}
    </div>
  )
}

// ── TempPill ──────────────────────────────────────────────────────────────────
function TempPill({ value, options, onChange }: {
  value: 'hot' | 'iced'
  options: ('hot' | 'iced')[]
  onChange: (t: 'hot' | 'iced') => void
}) {
  return (
    <div style={{ display: 'inline-flex', background: C.pale, borderRadius: 999, padding: 3 }}>
      {options.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          padding: '3px 9px', borderRadius: 999, fontFamily: SANS, fontSize: 11.5, fontWeight: 600,
          color: value === t ? C.navy : C.midBlue,
          background: value === t ? C.card : 'transparent',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 3,
          boxShadow: value === t ? '0 1px 2px rgba(30,58,95,0.10)' : 'none',
        }}>
          <span style={{ fontSize: 10 }}>{t === 'hot' ? '☕' : '🧊'}</span>{t}
        </button>
      ))}
    </div>
  )
}

// ── AddControl ────────────────────────────────────────────────────────────────
function AddControl({ qty, onAdd, onRemove }: { qty: number; onAdd: () => void; onRemove: () => void }) {
  if (qty > 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', background: C.card,
        borderRadius: 999, padding: 2, boxShadow: `inset 0 0 0 1px ${C.rule}` }}>
        <button onClick={onRemove} style={{ width: 30, height: 30, borderRadius: 999, border: 'none',
          cursor: 'pointer', background: 'transparent', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: C.midBlue, fontSize: 18 }}>−</button>
        <span style={{ minWidth: 18, textAlign: 'center', fontFamily: SANS, fontWeight: 600,
          color: C.navy, fontSize: 14 }}>{qty}</span>
        <button onClick={onAdd} style={{ width: 30, height: 30, borderRadius: 999, border: 'none',
          cursor: 'pointer', background: C.blue, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: C.navy, fontSize: 18, fontWeight: 600 }}>+</button>
      </div>
    )
  }
  return (
    <button onClick={onAdd} style={{ width: 34, height: 34, borderRadius: 999, background: C.blue,
      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: C.navy, fontSize: 20, fontWeight: 600,
      boxShadow: '0 1px 2px rgba(30,58,95,0.12)', flexShrink: 0 }}>+</button>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' | 'xl' }) {
  const sz = size === 'xl' ? 16 : size === 'lg' ? 14 : 12
  return <Stars value={rating} size={sz} />
}

// ── StarRating (interactive) ──────────────────────────────────────────────────
function StarRating({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} onClick={() => onRate(star)}
          onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
          className="text-lg leading-none transition-transform active:scale-125">
          <span className={(hover || rating) >= star ? 'text-[#8fafee]' : 'text-gray-200'}>★</span>
        </button>
      ))}
    </div>
  )
}

// ── Review Modal ──────────────────────────────────────────────────────────────
type TicketItem = { id: string; name: string }

function ReviewModal({
  reviews,
  loading,
  onClose,
  onNewReviews,
}: {
  reviews: Review[]
  loading: boolean
  onClose: () => void
  onNewReviews: (newReviews: Review[]) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [ticketCode, setTicketCode] = useState('')
  const [orderItems, setOrderItems] = useState<TicketItem[] | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({})
  const [itemComments, setItemComments] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }

  const count = reviews.length
  const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0
  const histogram = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
  }))

  const resetForm = () => {
    setName('')
    setTicketCode('')
    setOrderItems(null)
    setLookupError('')
    setItemRatings({})
    setItemComments({})
    setSubmitError('')
  }

  const lookupOrder = async () => {
    if (ticketCode.length !== 4) { setLookupError('Please enter a 4-digit code.'); return }
    setLookupLoading(true)
    setLookupError('')
    setOrderItems(null)
    try {
      const res = await fetch(`/api/orders?code=${ticketCode}`)
      const body = await res.json()
      if (!res.ok || body?.error) { setLookupError('Code not found. Please check your ticket.'); return }
      const items: TicketItem[] = Array.isArray(body.items) ? body.items : []
      if (items.length === 0) { setLookupError('No items found for this ticket.'); return }
      setOrderItems(items)
    } catch {
      setLookupError('Something went wrong. Try again.')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!name.trim()) { setSubmitError('Please enter your first name.'); return }
    const ratedItems = (orderItems ?? []).filter(item => (itemRatings[item.id] ?? 0) > 0)
    if (ratedItems.length === 0) { setSubmitError('Please rate at least one item.'); return }
    setSubmitting(true)
    setSubmitError('')
    try {
      const newReviews: Review[] = []
      for (const item of ratedItems) {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewer_name: name.trim(),
            rating: itemRatings[item.id],
            comment: itemComments[item.id]?.trim() || null,
            ticket_code: ticketCode,
            item_id: item.id,
          }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'Failed to submit')
        newReviews.push(body)
      }
      onNewReviews(newReviews)
      setSubmitted(true)
      setShowForm(false)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] shadow-2xl overflow-hidden">
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-gray-100">
          <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, color: C.navy }}>Reviews</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          <div className="px-5 py-5 flex gap-6 items-center border-b border-gray-100">
            <div className="text-center flex-shrink-0">
              <p style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 48, color: C.navy, lineHeight: 1 }}>
                {count > 0 ? avg.toFixed(1) : '—'}
              </p>
              <div className="mt-1"><StarDisplay rating={Math.round(avg)} size="lg" /></div>
              <p className="text-xs text-gray-400 mt-1">{count} {count === 1 ? 'review' : 'reviews'}</p>
            </div>
            <div className="flex-1 space-y-1">
              {histogram.map(({ star, count: c }) => {
                const pct = count > 0 ? Math.round((c / count) * 100) : 0
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-3 text-right">{star}</span>
                    <span style={{ color: C.blue }} className="text-xs leading-none">★</span>
                    <div style={{ flex: 1, background: C.pale, borderRadius: 999, height: 6, overflow: 'hidden' }}>
                      <div style={{ background: C.blue, height: '100%', borderRadius: 999, width: `${pct}%` }}
                        className="transition-all duration-500" />
                    </div>
                    <span className="text-xs text-gray-400 w-4 text-right">{c}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="px-5 py-4 border-b border-gray-100">
            {submitted && !showForm ? (
              <div className="text-center py-2">
                <p className="text-2xl mb-1">🎉</p>
                <p className="text-sm font-semibold text-[#1e3a5f]">Thanks for your review!</p>
                <button onClick={() => { setSubmitted(false); setShowForm(true); resetForm() }}
                  className="text-xs text-[#4a6fa8] underline mt-1">Leave another</button>
              </div>
            ) : !showForm ? (
              <button onClick={() => setShowForm(true)}
                style={{ width: '100%', padding: '10px 0', borderRadius: 999,
                  border: `2px solid ${C.blue}`, background: 'transparent',
                  fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.navy, cursor: 'pointer' }}>
                ✍️ Write a Review
              </button>
            ) : (
              <div className="space-y-4">
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, color: C.navy }}>Your Review</p>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">First name *</label>
                  <input type="text" placeholder="e.g. Sarah" value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ width: '100%', border: `1px solid ${C.rule}`, borderRadius: 10,
                      padding: '8px 12px', fontFamily: SANS, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Ticket code *</label>
                  <div className="flex gap-2">
                    <input type="text" inputMode="numeric" maxLength={4} placeholder="0000"
                      value={ticketCode}
                      onChange={e => {
                        setTicketCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                        setOrderItems(null)
                        setLookupError('')
                      }}
                      className="flex-1 text-center text-2xl font-bold tracking-widest border-2 border-gray-200 rounded-xl py-3 focus:border-[#8fafee] focus:outline-none focus:ring-2 focus:ring-[#8fafee]/30" />
                    <button onClick={lookupOrder}
                      disabled={lookupLoading || ticketCode.length !== 4}
                      style={{ padding: '0 16px', borderRadius: 12, background: C.blue,
                        border: 'none', fontFamily: SANS, fontSize: 13, fontWeight: 600,
                        color: C.navy, cursor: 'pointer', opacity: lookupLoading || ticketCode.length !== 4 ? 0.4 : 1 }}>
                      {lookupLoading ? '…' : 'Look up'}
                    </button>
                  </div>
                  {lookupError && <p className="text-red-500 text-xs mt-1">{lookupError}</p>}
                </div>
                {orderItems && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 font-medium">Rate your items:</p>
                    {orderItems.map(item => (
                      <div key={item.id} style={{ background: C.surface, borderRadius: 14, padding: 12 }} className="space-y-2">
                        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                        <div className="flex gap-1 items-center">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button key={s}
                              onClick={() => setItemRatings(prev => ({ ...prev, [item.id]: s }))}
                              className="text-2xl leading-none transition-transform active:scale-110">
                              <span className={s <= (itemRatings[item.id] ?? 0) ? 'text-[#8fafee]' : 'text-gray-200'}>★</span>
                            </button>
                          ))}
                          {(itemRatings[item.id] ?? 0) > 0 && (
                            <span className="text-xs text-gray-400 ml-1">
                              {['', 'Not for me', "It's okay", 'Pretty good', 'Really good', 'Obsessed'][itemRatings[item.id]]}
                            </span>
                          )}
                        </div>
                        <textarea placeholder="Any thoughts? (optional)"
                          value={itemComments[item.id] ?? ''}
                          onChange={e => setItemComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8fafee] resize-none" />
                      </div>
                    ))}
                  </div>
                )}
                {submitError && <p className="text-red-500 text-xs">{submitError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowForm(false); resetForm() }}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 999,
                      border: `1px solid ${C.rule}`, background: 'transparent',
                      fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.midBlue, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleSubmitReview}
                    disabled={submitting || !orderItems}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 999,
                      background: C.blue, border: 'none',
                      fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.navy, cursor: 'pointer',
                      opacity: submitting || !orderItems ? 0.4 : 1 }}>
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-2">
            {loading ? (
              <div className="py-8 text-center">
                <p style={{ fontFamily: SANS, fontSize: 13, color: C.ink3 }}>Loading reviews…</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-2xl mb-2">☕</p>
                <p style={{ fontFamily: SANS, fontSize: 13, color: C.ink3 }}>No reviews yet — be the first!</p>
              </div>
            ) : (
              <div>
                {reviews.map((review, idx) => {
                  const menuItem = review.item_id ? MENU.find(m => m.id === review.item_id) : null
                  return (
                    <div key={review.id} style={{ padding: '14px 0',
                      borderTop: idx ? `1px solid ${C.ruleSoft}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 999, background: C.pale,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: C.midBlue }}>
                            {review.reviewer_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <p style={{ fontFamily: SANS, fontWeight: 600, fontSize: 14, color: C.navy }}>{review.reviewer_name}</p>
                            <p style={{ fontFamily: SANS, fontSize: 11, color: C.ink3, flexShrink: 0 }}>{formatDate(review.created_at)}</p>
                          </div>
                          {menuItem && (
                            <p style={{ fontFamily: SANS, fontSize: 11, color: C.midBlue, fontWeight: 600, marginTop: 2 }}>
                              {menuItem.emoji} {menuItem.name}
                            </p>
                          )}
                          <div className="mt-0.5"><StarDisplay rating={review.rating} size="sm" /></div>
                          {review.comment && (
                            <p style={{ fontFamily: SANS, fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.5 }}>
                              {review.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stack Rank Tab ────────────────────────────────────────────────────────────
function generateMatchups(items: MenuItem[], count: number): [MenuItem, MenuItem][] {
  const pairs: [MenuItem, MenuItem][] = []
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      pairs.push([items[i], items[j]])
  return [...pairs].sort(() => Math.random() - 0.5).slice(0, count)
}

function RankTab({ ratings }: { ratings: Record<string, number> }) {
  const [matchups] = useState(() => generateMatchups(MENU, 10))
  const [current, setCurrent] = useState(0)
  const [wins, setWins] = useState<Record<string, number>>({})
  const [done, setDone] = useState(false)

  const choose = (winner: MenuItem) => {
    const next = { ...wins, [winner.id]: (wins[winner.id] ?? 0) + 1 }
    setWins(next)
    if (current + 1 >= matchups.length) setDone(true)
    else setCurrent(c => c + 1)
  }

  const restart = () => { setCurrent(0); setWins({}); setDone(false) }

  if (done) {
    const ranked = [...MENU].sort((a, b) => (wins[b.id] ?? 0) - (wins[a.id] ?? 0))
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 18px' }}>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 24, color: C.navy, marginBottom: 4 }}>
          Your Rankings
        </div>
        <p style={{ fontFamily: SANS, fontSize: 12, color: C.midBlue, marginBottom: 24 }}>
          Based on your head-to-head picks
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranked.map((item, i) => {
            const w = wins[item.id] ?? 0
            const total = matchups.length
            const pct = Math.round((w / total) * 100)
            const starRating = ratings[item.id]
            return (
              <div key={item.id} style={{ background: C.card, borderRadius: 18, padding: 16,
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: `inset 0 0 0 1px ${C.rule}` }}>
                <span style={{ fontWeight: 800, color: C.blue, width: 28, textAlign: 'center', fontSize: 18 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span style={{ fontSize: 22 }}>{item.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: SERIF, fontWeight: 500, color: C.navy, fontSize: 15 }}>{item.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <div style={{ flex: 1, background: C.pale, borderRadius: 999, height: 6, overflow: 'hidden' }}>
                      <div style={{ background: C.blue, height: '100%', borderRadius: 999, width: `${pct}%` }} />
                    </div>
                    <span style={{ fontFamily: SANS, fontSize: 11, color: C.ink3 }}>{w}W</span>
                  </div>
                </div>
                {starRating > 0 && <Stars value={starRating} size={12} />}
              </div>
            )
          })}
        </div>
        <button onClick={restart} style={{
          marginTop: 20, width: '100%', padding: '13px 0', borderRadius: 999,
          border: `1px solid ${C.blue}`, background: 'transparent',
          fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.navy, cursor: 'pointer',
        }}>
          Play again
        </button>
      </div>
    )
  }

  const [a, b] = matchups[current]
  const progress = Math.round((current / matchups.length) * 100)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: C.midBlue,
          textTransform: 'uppercase', letterSpacing: 0.8 }}>Which do you prefer?</p>
        <p style={{ fontFamily: SANS, fontSize: 11, color: C.ink3 }}>{current + 1} / {matchups.length}</p>
      </div>
      <div style={{ background: C.pale, borderRadius: 999, height: 4, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ background: C.blue, height: '100%', borderRadius: 999,
          width: `${progress}%`, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[a, b].map(item => (
          <button key={item.id} onClick={() => choose(item)} style={{
            background: C.card, borderRadius: 20, padding: 20,
            boxShadow: `inset 0 0 0 1px ${C.rule}`, border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 44 }}>{item.emoji}</span>
            <p style={{ fontFamily: SERIF, fontWeight: 500, color: C.navy, fontSize: 14,
              textAlign: 'center', lineHeight: 1.2 }}>{item.name}</p>
            <p style={{ fontFamily: SANS, fontSize: 11, color: C.ink2,
              textAlign: 'center', lineHeight: 1.4 }}>{item.description}</p>
          </button>
        ))}
      </div>
      <p style={{ textAlign: 'center', fontFamily: SANS, fontSize: 11, color: C.ink3, marginTop: 24 }}>
        Tap your favorite to continue
      </p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const [tab, setTab] = useState<Tab>('menu')
  const [catFilter, setCatFilter] = useState<CatFilter>('all')
  const [cart, setCart] = useState<Map<string, number>>(new Map())
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null)
  const [tipOption, setTipOption] = useState<string | null>(null)
  const [customTipStr, setCustomTipStr] = useState('')
  const [error, setError] = useState('')
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [drinkTemp, setDrinkTemp] = useState<Record<string, 'hot' | 'iced'>>({})
  const getDrinkTemp = (item: { id: string; tempOptions?: ('hot' | 'iced')[] }) =>
    drinkTemp[item.id] ?? (item.tempOptions?.[0] ?? 'hot')

  const [showReviews, setShowReviews] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('loc-ratings')
      if (saved) setRatings(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    if (!showReviews) return
    setReviewsLoading(true)
    fetch('/api/reviews')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setReviews(data) })
      .catch(() => {})
      .finally(() => setReviewsLoading(false))
  }, [showReviews])

  const handleNewReviews = (newReviews: Review[]) => {
    setReviews(prev => [...newReviews, ...prev])
  }

  const rate = (itemId: string, stars: number) => {
    const next = { ...ratings, [itemId]: stars }
    setRatings(next)
    try { localStorage.setItem('loc-ratings', JSON.stringify(next)) } catch {}
  }
  void rate // used in future star-rating UI

  const updateQty = (itemId: string, delta: number) => {
    setCart(prev => {
      const next = new Map(prev)
      const updated = (next.get(itemId) ?? 0) + delta
      if (updated <= 0) next.delete(itemId)
      else next.set(itemId, updated)
      return next
    })
  }

  const cartItems: OrderItem[] = MENU
    .filter(item => cart.has(item.id))
    .map(item => ({
      id: item.id,
      name: item.name,
      quantity: cart.get(item.id)!,
      price: item.price,
    }))

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleSubmit = async () => {
    if (!customerName.trim() || cartItems.length === 0) return
    setLoading(true)
    setError('')
    const venmoNote = cartItems.map(i => `${i.quantity}x ${i.name}`).join(', ')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: customerName.trim(), items: cartItems, total, note }),
      })
      const text = await res.text()
      const body = text ? JSON.parse(text) : {}
      if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`)
      setPlacedOrder({
        id: body.id,
        total,
        venmoNote,
        ticketCode: body.ticket_code,
        items: cartItems,
        name: customerName.trim(),
      })
      setCart(new Map())
      setCustomerName('')
      setNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const venmoUsername = process.env.NEXT_PUBLIC_VENMO_USERNAME ?? 'your-venmo'

  // ── Order / Ticket screen ─────────────────────────────────────────────────
  if (placedOrder) {
    const subtotal = placedOrder.total
    const discount = subtotal
    const TIP_AMOUNTS = [1, 1.5, 2, 3]
    const customTipAmt = parseFloat(customTipStr.replace(/[^0-9.]/g, '')) || 0
    const tipAmount =
      !tipOption || tipOption === 'none' ? 0
      : tipOption === 'custom' ? customTipAmt
      : parseFloat(tipOption)
    const grandTotal = tipAmount
    const amount = grandTotal.toFixed(2)
    const venmoNoteWithExtras = [
      placedOrder.venmoNote,
      tipAmount > 0 ? `$${tipAmount.toFixed(2)} tip` : null,
    ].filter(Boolean).join(' + ')
    const encodedNote = encodeURIComponent(venmoNoteWithExtras)
    const deepLink = `venmo://paycharge?txn=pay&recipients=${venmoUsername}&amount=${amount}&note=${encodedNote}`
    const webLink = `https://venmo.com/${venmoUsername}?txn=pay&amount=${amount}&note=${encodedNote}`

    return (
      <main style={{ minHeight: '100vh', background: C.peach, paddingBottom: 48 }}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => { setPlacedOrder(null); setTipOption(null); setCustomTipStr('') }}
            style={{ width: 34, height: 34, borderRadius: 999, background: C.card, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `inset 0 0 0 1px ${C.rule}`, fontSize: 17, color: C.midBlue, cursor: 'pointer' }}>
            ←
          </button>
          <div style={{ flex: 1, fontFamily: SERIF, fontStyle: 'italic', fontSize: 24,
            letterSpacing: -0.4, color: C.navy }}>Your order</div>
          <LazyLogo size={28} />
        </div>

        <div style={{ padding: '0 18px', maxWidth: 480, margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Ticket card */}
          <div style={{ background: C.card, borderRadius: 24, padding: 22,
            boxShadow: '0 8px 24px rgba(30,58,95,0.08), inset 0 0 0 1px rgba(30,58,95,0.06)',
            position: 'relative', overflow: 'hidden' }}>
            {/* Peach motif */}
            <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #fbd4b2 0%, #f4b485 60%, transparent 75%)',
              opacity: 0.45 }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start',
              justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: SANS, fontSize: 11, textTransform: 'uppercase',
                  letterSpacing: 0.6, color: C.midBlue }}>Order placed</div>
                <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 80, lineHeight: 0.95,
                  color: C.navy, marginTop: 6, letterSpacing: -3 }}>
                  {placedOrder.ticketCode ? `#${placedOrder.ticketCode}` : '🍑'}
                </div>
                <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 18,
                  color: C.navy, marginTop: 4 }}>
                  {placedOrder.name}
                </div>
              </div>
              {placedOrder.id && (
                <div style={{ background: C.pale, borderRadius: 12, padding: '4px 8px',
                  fontFamily: MONO, fontSize: 11, color: C.blueDeep, letterSpacing: 1 }}>
                  {placedOrder.id.slice(0, 8)}
                </div>
              )}
            </div>
            {/* Status pill */}
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 8,
              background: C.surface, padding: '10px 14px', borderRadius: 999,
              boxShadow: `inset 0 0 0 1px ${C.rule}` }}>
              <PulseDot color={C.amber} />
              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 13, color: C.navy }}>
                Awaiting payment
              </span>
            </div>
            {/* Steps */}
            <div style={{ marginTop: 16 }}>
              <Steps active={0} />
            </div>
          </div>

          {/* Items + totals */}
          <div style={{ background: C.card, borderRadius: 18, overflow: 'hidden',
            boxShadow: `inset 0 0 0 1px ${C.rule}` }}>
            {placedOrder.items.map((item, i) => {
              const menuItem = MENU.find(m => m.id === item.id)
              return (
                <div key={item.id} style={{ padding: '12px 14px', display: 'flex',
                  alignItems: 'center', gap: 12,
                  borderTop: i ? `1px solid ${C.ruleSoft}` : 'none' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: C.peach,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, flexShrink: 0 }}>
                    {menuItem?.emoji ?? '☕'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SERIF, fontSize: 15, color: C.navy, lineHeight: 1.2 }}>{item.name}</div>
                    <div style={{ fontFamily: SANS, fontSize: 11, color: C.ink3, marginTop: 2 }}>qty {item.quantity}</div>
                  </div>
                  <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 14, color: C.blueDeep }}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              )
            })}
            {/* Totals */}
            <div style={{ margin: '0 14px', borderTop: `1px dashed ${C.rule}`, padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontFamily: SANS, fontSize: 13, color: C.ink3, marginBottom: 6 }}>
                <span style={{ textDecoration: 'line-through' }}>Subtotal</span>
                <span style={{ textDecoration: 'line-through' }}>${subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontFamily: SANS, fontSize: 13, color: C.green, fontWeight: 600,
                marginBottom: tipAmount > 0 ? 6 : 0 }}>
                <span>Discount (100% off 🎉)</span>
                <span>−${discount.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  fontFamily: SANS, fontSize: 13, color: C.ink2, marginBottom: 6 }}>
                  <span>Tip</span>
                  <span>${tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontFamily: SANS, fontWeight: 700, fontSize: 16, color: C.navy,
                marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.rule}` }}>
                <span>Total</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Tip selector */}
          <div>
            <div style={{ fontFamily: SANS, fontSize: 11, textTransform: 'uppercase',
              letterSpacing: 0.5, color: C.midBlue, marginBottom: 8 }}>
              Tip the home barista 🙏
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {TIP_AMOUNTS.map(amt => {
                const key = String(amt)
                const selected = tipOption === key
                return (
                  <button key={key} onClick={() => setTipOption(key)}
                    style={{ flex: 1, padding: '10px 0', textAlign: 'center',
                      borderRadius: 12, fontFamily: SANS, fontWeight: 600, fontSize: 13,
                      background: selected ? C.blue : C.card,
                      color: selected ? C.navy : C.midBlue,
                      border: `1px solid ${selected ? C.blue : C.rule}`,
                      cursor: 'pointer' }}>
                    ${amt === 1.5 ? '1.50' : amt}
                  </button>
                )
              })}
              <button onClick={() => setTipOption('none')}
                style={{ flex: 1, padding: '10px 0', textAlign: 'center',
                  borderRadius: 12, fontFamily: SANS, fontWeight: 600, fontSize: 12,
                  background: tipOption === 'none' ? C.blue : C.card,
                  color: tipOption === 'none' ? C.navy : C.midBlue,
                  border: `1px solid ${tipOption === 'none' ? C.blue : C.rule}`,
                  cursor: 'pointer', lineHeight: 1.2 }}>
                Skip
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => setTipOption('custom')}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: SANS, fontSize: 12,
                  color: tipOption === 'custom' ? C.navy : C.ink3 }}>
                ✏️ Custom amount
              </button>
              {tipOption === 'custom' && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: C.ink2, fontFamily: SANS, fontSize: 14 }}>$</span>
                  <input type="number" min="0" step="0.50" placeholder="0.00"
                    value={customTipStr} onChange={e => setCustomTipStr(e.target.value)}
                    autoFocus
                    style={{ flex: 1, border: `1px solid ${C.rule}`, borderRadius: 10,
                      padding: '8px 12px', fontFamily: SANS, fontSize: 14,
                      outline: 'none', background: C.card }} />
                </div>
              )}
            </div>
            <p style={{ fontFamily: SANS, fontSize: 11, color: C.ink3, marginTop: 8 }}>
              Tips are split evenly among your hosts 🤍
            </p>
          </div>

          {/* Ticket code for review lookup */}
          {placedOrder.ticketCode && (
            <div style={{ background: C.pale, borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: SANS, fontSize: 10.5, textTransform: 'uppercase',
                letterSpacing: 0.5, color: C.midBlue, marginBottom: 6 }}>Your review code</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700,
                color: C.navy, letterSpacing: 4 }}>{placedOrder.ticketCode}</div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: C.ink3, marginTop: 4 }}>
                Save to leave a review after your meal
              </div>
            </div>
          )}

          {/* QR code */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.ink3, marginBottom: 10 }}>
              📱 On your phone — scan to open Venmo
            </div>
            <QRCodeSVG value={deepLink} size={140} />
          </div>

          {/* Venmo pay button */}
          <a href={webLink} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', background: C.venmo, borderRadius: 999, padding: '15px 22px',
              alignItems: 'center', justifyContent: 'center', gap: 10,
              color: '#fff', fontFamily: SANS, fontWeight: 700, fontSize: 16, textDecoration: 'none',
              boxShadow: '0 8px 24px rgba(61,149,206,0.35)' }}>
            <span>Pay ${grandTotal.toFixed(2)} with</span>
            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 19 }}>venmo</span>
            <span style={{ opacity: 0.85 }}>↗</span>
          </a>
          <div style={{ textAlign: 'center', fontFamily: SANS, fontSize: 11, color: C.ink2 }}>
            Opens Venmo · returns with your ticket
          </div>
        </div>
      </main>
    )
  }

  // ── Menu screen ───────────────────────────────────────────────────────────
  const reviewAvg = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null

  const filteredCategories = catFilter === 'all'
    ? CATEGORIES
    : CATEGORIES.filter(cat => cat.toLowerCase() === catFilter)

  return (
    <main style={{ minHeight: '100vh', background: C.peach }}>

      {/* Sticky header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 10, padding: '12px 18px',
        background: C.peach, borderBottom: `1px solid ${C.rule}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LazyLogo size={36} />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, fontWeight: 500,
              color: C.navy, letterSpacing: -0.3 }}>Lazy Orchard</div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: C.midBlue,
              letterSpacing: 0.5, textTransform: 'uppercase' }}>Café · Order &amp; Pay</div>
          </div>
        </div>
        <Link href="/orders" style={{ fontFamily: SANS, fontSize: 12, color: C.midBlue,
          padding: '6px 10px', borderRadius: 999, background: C.card,
          boxShadow: `inset 0 0 0 1px ${C.rule}`, textDecoration: 'none' }}>
          Staff →
        </Link>
      </header>

      {/* Welcome panel */}
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{ background: C.surface, borderRadius: 20, padding: '16px 18px',
          boxShadow: `inset 0 0 0 1px ${C.rule}` }}>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, lineHeight: 1.15,
            color: C.navy, letterSpacing: -0.3 }}>Welcome to Lazy Orchard&nbsp;🍑</div>
          <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink2, marginTop: 8, lineHeight: 1.5 }}>
            Bringing the café experience home. Thanks for being one of our first official tasters.
          </p>
          <button onClick={() => setShowReviews(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Stars value={reviewAvg ? Math.round(reviewAvg) : 5} size={14} />
            <span style={{ fontFamily: SANS, fontSize: 12, color: C.midBlue,
              textDecoration: 'underline', textDecorationColor: C.rule, textUnderlineOffset: 3 }}>
              {reviews.length > 0
                ? `${reviewAvg!.toFixed(1)} · ${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`
                : 'Write a Review'} ›
            </span>
          </button>
        </div>
      </div>

      {/* Tabs: Menu / Play Beli */}
      <div style={{ display: 'flex', padding: '4px 18px 0', borderBottom: `1px solid ${C.rule}`, marginTop: 12 }}>
        {(['menu', 'rank'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            fontFamily: SANS, fontSize: 14, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 16px 9px',
            color: tab === t ? C.navy : C.midBlue,
            borderBottom: tab === t ? `2px solid ${C.blue}` : '2px solid transparent',
            marginBottom: -1,
          }}>
            {t === 'menu' ? 'Menu' : 'Play Beli'}
          </button>
        ))}
      </div>

      {tab === 'rank' ? (
        <RankTab ratings={ratings} />
      ) : (
        <>
          {/* Category filter */}
          <div style={{ padding: '12px 18px', display: 'flex', gap: 6 }}>
            {(['all', 'drinks', 'food'] as CatFilter[]).map(f => (
              <button key={f} onClick={() => setCatFilter(f)} style={{
                padding: '7px 16px', borderRadius: 999,
                fontFamily: SANS, fontSize: 14, fontWeight: 500,
                background: catFilter === f ? C.navy : 'transparent',
                color: catFilter === f ? C.peach : C.midBlue,
                border: catFilter === f ? 'none' : `1px solid ${C.rule}`,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{f}</button>
            ))}
          </div>

          {/* Menu items */}
          <div style={{ padding: '0 18px', paddingBottom: cartItems.length > 0 ? 168 : 48,
            display: 'flex', flexDirection: 'column', gap: 22 }}>
            {filteredCategories.map(category => (
              <section key={category}>
                {/* Section label with rule */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, fontWeight: 500,
                    color: C.navy, letterSpacing: -0.4 }}>{category}</div>
                  <div style={{ flex: 1, height: 1, background: C.rule }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {MENU.filter(item =>
                    catFilter === 'all'
                      ? item.category === category
                      : item.category.toLowerCase() === catFilter
                  ).map(item => {
                    const qty = cart.get(item.id) ?? 0
                    const isExpanded = expandedItem === item.id
                    const itemTemp = getDrinkTemp(item)
                    return (
                      <div key={item.id}
                        style={{ background: C.card, borderRadius: 18, padding: 14,
                          boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 3px rgba(30,58,95,0.04)',
                          cursor: 'pointer' }}
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          {/* Emoji tile */}
                          <div style={{ width: 48, height: 48, borderRadius: 14, background: C.peach,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 26, flexShrink: 0 }}>
                            {item.emoji}
                          </div>
                          {/* Name / desc / meta */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: C.navy,
                              lineHeight: 1.15, letterSpacing: -0.2 }}>{item.name}</div>
                            <div style={{ fontFamily: SANS, fontSize: 12, color: C.ink2,
                              marginTop: 3, lineHeight: 1.3 }}>{item.description}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                              marginTop: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 14,
                                color: C.blueDeep }}>${item.price.toFixed(2)}</span>
                              <Stars value={5} />
                              {item.tempOptions && item.tempOptions.length > 1 && (
                                <div onClick={e => e.stopPropagation()}>
                                  <TempPill
                                    value={itemTemp}
                                    options={item.tempOptions as ('hot' | 'iced')[]}
                                    onChange={t => setDrinkTemp(prev => ({ ...prev, [item.id]: t }))}
                                  />
                                </div>
                              )}
                              {item.tempOptions?.length === 1 && item.tempOptions[0] === 'iced' && (
                                <span style={{ fontFamily: SANS, fontSize: 10.5, padding: '2px 8px',
                                  borderRadius: 999, background: C.pale, color: C.navy, fontWeight: 600 }}>
                                  🧊 iced only
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Add control */}
                          <div onClick={e => e.stopPropagation()}>
                            <AddControl
                              qty={qty}
                              onAdd={() => updateQty(item.id, 1)}
                              onRemove={() => updateQty(item.id, -1)}
                            />
                          </div>
                        </div>
                        {/* Expandable details */}
                        {isExpanded && (
                          <div style={{ marginTop: 12, paddingTop: 12,
                            borderTop: `1px solid ${C.ruleSoft}`,
                            display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {item.calories && (
                              <div style={{ display: 'flex', gap: 8, fontFamily: SANS, fontSize: 11.5, color: C.ink2 }}>
                                <span>🔥</span><span>{item.calories} cal</span>
                              </div>
                            )}
                            {item.ingredients && item.ingredients.length > 0 && (
                              <div style={{ display: 'flex', gap: 8, fontFamily: SANS, fontSize: 11.5, color: C.ink2 }}>
                                <span>🌿</span><span>Ingredients: {item.ingredients.join(', ')}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, fontFamily: SANS, fontSize: 11.5,
                              color: item.allergens && item.allergens.length === 0 ? C.green : C.ink2 }}>
                              <span>{item.allergens && item.allergens.length > 0 ? '⚠️' : '✅'}</span>
                              <span>
                                {item.allergens && item.allergens.length > 0
                                  ? `Allergens: ${item.allergens.join(', ')}`
                                  : 'No common allergens'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* Sticky cart bar */}
          {cartItems.length > 0 && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '0 18px 20px',
              background: 'linear-gradient(to bottom, transparent, rgba(246,231,215,0.97) 32%)' }}>
              <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" placeholder="Your name *"
                    value={customerName} onChange={e => setCustomerName(e.target.value)}
                    style={{ flex: 1, border: `1px solid ${C.rule}`, borderRadius: 12,
                      padding: '10px 14px', fontFamily: SANS, fontSize: 14,
                      background: C.card, outline: 'none' }} />
                  <input type="text" placeholder="Note (optional)"
                    value={note} onChange={e => setNote(e.target.value)}
                    style={{ flex: 1, border: `1px solid ${C.rule}`, borderRadius: 12,
                      padding: '10px 14px', fontFamily: SANS, fontSize: 14,
                      background: C.card, outline: 'none' }} />
                </div>
                {error && (
                  <p style={{ fontFamily: SANS, fontSize: 12, color: C.red }}>{error}</p>
                )}
                <button onClick={handleSubmit}
                  disabled={!customerName.trim() || loading}
                  style={{ background: C.navy, borderRadius: 999, padding: '14px 22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    color: C.peach, fontFamily: SANS, fontWeight: 600, fontSize: 15,
                    boxShadow: '0 8px 24px rgba(30,58,95,0.25), 0 2px 6px rgba(30,58,95,0.15)',
                    border: 'none', width: '100%',
                    cursor: !customerName.trim() || loading ? 'not-allowed' : 'pointer',
                    opacity: !customerName.trim() || loading ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 999, background: C.blue,
                      color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700 }}>
                      {cartItems.reduce((s, i) => s + i.quantity, 0)}
                    </div>
                    <span>{loading ? 'Placing order…' : 'Place Order'}</span>
                  </div>
                  <span>${total.toFixed(2)}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review modal */}
      {showReviews && (
        <ReviewModal
          reviews={reviews}
          loading={reviewsLoading}
          onClose={() => setShowReviews(false)}
          onNewReviews={handleNewReviews}
        />
      )}
    </main>
  )
}
