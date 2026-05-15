'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { MENU, CATEGORIES } from '@/lib/menu'
import type { MenuItem, OrderItem } from '@/types'

type Tab = 'menu' | 'rank'

interface PlacedOrder {
  id: string
  total: number
  venmoNote: string
  ticketCode?: string
  items: OrderItem[]
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' | 'xl' }) {
  const cls = size === 'xl' ? 'text-3xl' : size === 'lg' ? 'text-xl' : 'text-sm'
  return (
    <span className={cls}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className={s <= rating ? 'text-[#8fafee]' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

// ── Star Rating (interactive) ──────────────────────────────────────────────────

function StarRating({
  rating,
  onRate,
}: {
  rating: number
  onRate: (r: number) => void
}) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onRate(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="text-lg leading-none transition-transform active:scale-125"
        >
          <span className={(hover || rating) >= star ? 'text-[#8fafee]' : 'text-gray-200'}>
            ★
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Review Modal ───────────────────────────────────────────────────────────────

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

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }

  // Compute stats
  const count = reviews.length
  const avg = count > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / count
    : 0
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
      if (!res.ok || body?.error) {
        setLookupError('Code not found. Please check your ticket.')
        return
      }
      const items: TicketItem[] = Array.isArray(body.items) ? body.items : []
      if (items.length === 0) {
        setLookupError('No items found for this ticket.')
        return
      }
      setOrderItems(items)
    } catch {
      setLookupError('Something went wrong. Try again.')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleSubmit = async () => {
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

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-gray-100">
          <h2 className="text-base font-bold text-[#1e3a5f]">Reviews</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">

          {/* Summary */}
          <div className="px-5 py-5 flex gap-6 items-center border-b border-gray-100">
            {/* Big average */}
            <div className="text-center flex-shrink-0">
              <p className="text-5xl font-black text-[#1e3a5f] leading-none">
                {count > 0 ? avg.toFixed(1) : '—'}
              </p>
              <div className="mt-1">
                <StarDisplay rating={Math.round(avg)} size="lg" />
              </div>
              <p className="text-xs text-gray-400 mt-1">{count} {count === 1 ? 'review' : 'reviews'}</p>
            </div>

            {/* Histogram */}
            <div className="flex-1 space-y-1">
              {histogram.map(({ star, count: c }) => {
                const pct = count > 0 ? Math.round((c / count) * 100) : 0
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-3 text-right">{star}</span>
                    <span className="text-[#8fafee] text-xs leading-none">★</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#8fafee] h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-4 text-right">{c}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Write a Review CTA / ticket form */}
          <div className="px-5 py-4 border-b border-gray-100">
            {submitted && !showForm ? (
              <div className="text-center py-2">
                <p className="text-2xl mb-1">🎉</p>
                <p className="text-sm font-semibold text-[#1e3a5f]">Thanks for your review!</p>
                <button
                  onClick={() => { setSubmitted(false); setShowForm(true); resetForm() }}
                  className="text-xs text-[#4a6fa8] underline mt-1"
                >
                  Leave another
                </button>
              </div>
            ) : !showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full py-2.5 rounded-xl border-2 border-[#8fafee] text-[#1e3a5f] text-sm font-semibold hover:bg-[#8fafee]/10 transition-colors"
              >
                ✍️ Write a Review
              </button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-[#1e3a5f]">Your Review</p>

                {/* Name */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">First name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8fafee]"
                  />
                </div>

                {/* Ticket code */}
                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Ticket code *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="0000"
                      value={ticketCode}
                      onChange={e => {
                        setTicketCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                        setOrderItems(null)
                        setLookupError('')
                      }}
                      className="flex-1 text-center text-2xl font-bold tracking-widest border-2 border-gray-200 rounded-xl py-3 focus:border-[#8fafee] focus:outline-none focus:ring-2 focus:ring-[#8fafee]/30"
                    />
                    <button
                      onClick={lookupOrder}
                      disabled={lookupLoading || ticketCode.length !== 4}
                      className="px-4 rounded-xl bg-[#8fafee] hover:bg-[#7a9de6] disabled:opacity-40 text-[#1e3a5f] text-sm font-semibold transition-colors flex-shrink-0"
                    >
                      {lookupLoading ? '…' : 'Look up'}
                    </button>
                  </div>
                  {lookupError && <p className="text-red-500 text-xs mt-1">{lookupError}</p>}
                </div>

                {/* Order items — shown after successful ticket lookup */}
                {orderItems && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 font-medium">Rate your items:</p>
                    {orderItems.map(item => (
                      <div key={item.id} className="bg-[#f6e7d7]/40 rounded-xl p-3 space-y-2">
                        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                        <div className="flex gap-1 items-center">
                          {[1, 2, 3, 4, 5].map(s => (
                            <button
                              key={s}
                              onClick={() => setItemRatings(prev => ({ ...prev, [item.id]: s }))}
                              className="text-2xl leading-none transition-transform active:scale-110"
                            >
                              <span className={s <= (itemRatings[item.id] ?? 0) ? 'text-[#8fafee]' : 'text-gray-200'}>★</span>
                            </button>
                          ))}
                          {(itemRatings[item.id] ?? 0) > 0 && (
                            <span className="text-xs text-gray-400 ml-1">
                              {['', 'Not for me', 'It\'s okay', 'Pretty good', 'Really good', 'Obsessed'][itemRatings[item.id]]}
                            </span>
                          )}
                        </div>
                        <textarea
                          placeholder="Any thoughts? (optional)"
                          value={itemComments[item.id] ?? ''}
                          onChange={e => setItemComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8fafee] resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {submitError && <p className="text-red-500 text-xs">{submitError}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowForm(false); resetForm() }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !orderItems}
                    className="flex-1 py-2.5 rounded-xl bg-[#8fafee] hover:bg-[#7a9de6] disabled:opacity-40 text-[#1e3a5f] text-sm font-semibold transition-colors"
                  >
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Review list */}
          <div className="px-5 py-2">
            {loading ? (
              <div className="py-8 text-center">
                <p className="text-gray-300 text-sm">Loading reviews…</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-2xl mb-2">☕</p>
                <p className="text-sm text-gray-400">No reviews yet — be the first!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {reviews.map(review => {
                  const menuItem = review.item_id ? MENU.find(m => m.id === review.item_id) : null
                  return (
                    <div key={review.id} className="py-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-[#d9e8fa] flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-[#4a6fa8]">
                            {review.reviewer_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{review.reviewer_name}</p>
                            <p className="text-xs text-gray-400 flex-shrink-0">{formatDate(review.created_at)}</p>
                          </div>
                          {menuItem && (
                            <p className="text-xs text-[#4a6fa8] font-medium mt-0.5">{menuItem.emoji} {menuItem.name}</p>
                          )}
                          <div className="mt-0.5">
                            <StarDisplay rating={review.rating} size="sm" />
                          </div>
                          {review.comment && (
                            <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{review.comment}</p>
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

// ── Stack Rank Tab ─────────────────────────────────────────────────────────────

function generateMatchups(items: MenuItem[], count: number): [MenuItem, MenuItem][] {
  const pairs: [MenuItem, MenuItem][] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]])
    }
  }
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

  const restart = () => {
    setCurrent(0)
    setWins({})
    setDone(false)
  }

  if (done) {
    const ranked = [...MENU].sort((a, b) => (wins[b.id] ?? 0) - (wins[a.id] ?? 0))
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-1">Your Rankings</h2>
        <p className="text-xs text-[#4a6fa8] mb-6">Based on your head-to-head picks</p>
        <div className="space-y-2">
          {ranked.map((item, i) => {
            const w = wins[item.id] ?? 0
            const total = matchups.length
            const pct = Math.round((w / total) * 100)
            const starRating = ratings[item.id]
            return (
              <div key={item.id} className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm">
                <span className="text-xl font-black text-[#8fafee] w-7 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span className="text-xl">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#8fafee] h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{w}W</span>
                  </div>
                </div>
                {starRating > 0 && (
                  <div className="flex-shrink-0 text-xs text-[#8fafee] font-semibold">
                    {'★'.repeat(starRating)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button
          onClick={restart}
          className="mt-6 w-full py-3 rounded-xl border border-[#8fafee] text-[#1e3a5f] text-sm font-semibold hover:bg-[#8fafee]/10 transition-colors"
        >
          Play again
        </button>
      </div>
    )
  }

  const [a, b] = matchups[current]
  const progress = Math.round((current / matchups.length) * 100)

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-[#4a6fa8] uppercase tracking-widest">
          Which do you prefer?
        </p>
        <p className="text-xs text-gray-400">{current + 1} / {matchups.length}</p>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1 mb-8 overflow-hidden">
        <div
          className="bg-[#8fafee] h-full rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[a, b].map(item => (
          <button
            key={item.id}
            onClick={() => choose(item)}
            className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all text-center flex flex-col items-center gap-3 border-2 border-transparent hover:border-[#8fafee]"
          >
            <span className="text-5xl">{item.emoji}</span>
            <p className="text-sm font-semibold text-gray-900 leading-snug">{item.name}</p>
            <p className="text-xs text-gray-400 leading-snug">{item.description}</p>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-gray-300 mt-8">Tap your favorite to continue</p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>('menu')
  const [cart, setCart] = useState<Map<string, number>>(new Map())
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null)
  const [tipOption, setTipOption] = useState<'15' | '18' | '20' | 'none' | 'custom' | null>(null)
  const [customTipStr, setCustomTipStr] = useState('')
  const [error, setError] = useState('')
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [drinkTemp, setDrinkTemp] = useState<Record<string, 'hot' | 'iced'>>({})
  const getDrinkTemp = (item: { id: string; tempOptions?: ('hot' | 'iced')[] }) =>
    drinkTemp[item.id] ?? (item.tempOptions?.[0] ?? 'hot')

  // Reviews state
  const [showReviews, setShowReviews] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('loc-ratings')
      if (saved) setRatings(JSON.parse(saved))
    } catch {}
  }, [])

  // Fetch reviews when modal opens
  useEffect(() => {
    if (!showReviews) return
    setReviewsLoading(true)
    fetch('/api/reviews')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setReviews(data)
      })
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
      setPlacedOrder({ id: body.id, total, venmoNote, ticketCode: body.ticket_code, items: cartItems })
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

  if (placedOrder) {
    const subtotal = placedOrder.total   // pre-discount food total
    const discount = subtotal            // 100% off food
    const TIP_PCTS = [15, 18, 20] as const
    const customTipAmt = parseFloat(customTipStr.replace(/[^0-9.]/g, '')) || 0
    // Tips are calculated against pre-discount subtotal, not zero
    const tipAmount = !tipOption || tipOption === 'none' ? 0
      : tipOption === 'custom' ? customTipAmt
      : Math.round(subtotal * parseInt(tipOption)) / 100
    const grandTotal = tipAmount   // food is free; total = tip only
    const amount = grandTotal.toFixed(2)

    const venmoNoteWithExtras = [
      placedOrder.venmoNote,
      tipAmount > 0 ? `$${tipAmount.toFixed(2)} tip` : null,
    ].filter(Boolean).join(' + ')
    const encodedNote = encodeURIComponent(venmoNoteWithExtras)
    const deepLink = `venmo://paycharge?txn=pay&recipients=${venmoUsername}&amount=${amount}&note=${encodedNote}`
    const webLink = `https://venmo.com/${venmoUsername}?txn=pay&amount=${amount}&note=${encodedNote}`

    return (
      <main className="min-h-screen bg-[#f6e7d7] flex items-start justify-center p-4 pt-8 pb-12">
        <div className="bg-white rounded-2xl max-w-sm w-full shadow-lg overflow-hidden">

          {/* Header */}
          <div className="bg-[#8fafee] px-6 py-5 text-center">
            <div className="text-3xl mb-1">✅</div>
            <h2 className="text-xl font-bold text-[#1e3a5f]">Order placed!</h2>
            <p className="text-[#4a6fa8] text-sm mt-1">Here&apos;s what you ordered</p>
          </div>

          <div className="px-5 py-5 space-y-4">

            {/* Itemized list */}
            <div className="space-y-1.5">
              {placedOrder.items.map(item => (
                <div key={item.id} className="flex justify-between items-baseline text-sm">
                  <span className="text-gray-700">
                    {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}
                  </span>
                  <span className="text-gray-900 font-medium tabular-nums">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Running totals */}
            <div className="border-t border-dashed border-gray-200 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-400">
                <span className="line-through">Subtotal</span>
                <span className="tabular-nums line-through">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>Discount (100% off 🎉) — It&apos;s on us!</span>
                <span className="tabular-nums">−${discount.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Tip</span>
                  <span className="tabular-nums">${tipAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Grand total */}
            <div className="flex justify-between items-center border-t border-gray-200 pt-3">
              <span className="font-bold text-[#1e3a5f] text-base">Total</span>
              <span className="text-2xl font-bold text-[#1e3a5f] tabular-nums">${grandTotal.toFixed(2)}</span>
            </div>

            {/* Tip selection */}
            <div className="bg-[#f6e7d7]/60 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-[#1e3a5f]">Add a tip? 🙏 <span className="font-normal text-gray-400">(based on your ${subtotal.toFixed(2)} order)</span></p>
              <div className="grid grid-cols-4 gap-2">
                {TIP_PCTS.map(pct => {
                  const amt = Math.round(subtotal * pct) / 100
                  const selected = tipOption === String(pct)
                  return (
                    <button
                      key={pct}
                      onClick={() => setTipOption(String(pct) as '15' | '18' | '20')}
                      className={`py-2.5 rounded-xl border-2 text-center transition-all ${
                        selected
                          ? 'bg-[#8fafee] border-[#8fafee] text-[#1e3a5f] shadow-sm'
                          : 'border-gray-200 bg-white hover:border-[#8fafee] text-gray-700'
                      }`}
                    >
                      <p className="text-xs font-bold leading-none">{pct}%</p>
                      <p className={`text-xs mt-0.5 leading-none ${selected ? 'text-[#1e3a5f]' : 'text-gray-400'}`}>
                        ${amt.toFixed(2)}
                      </p>
                    </button>
                  )
                })}
                <button
                  onClick={() => setTipOption('none')}
                  className={`py-2.5 rounded-xl border-2 text-center text-xs font-semibold transition-all leading-tight ${
                    tipOption === 'none'
                      ? 'bg-[#8fafee] border-[#8fafee] text-[#1e3a5f] shadow-sm'
                      : 'border-gray-200 bg-white hover:border-[#8fafee] text-gray-500'
                  }`}
                >
                  No tip
                </button>
              </div>

              {/* Custom tip */}
              <div>
                <button
                  onClick={() => setTipOption('custom')}
                  className={`text-xs flex items-center gap-1 transition-colors ${
                    tipOption === 'custom'
                      ? 'text-[#1e3a5f] font-semibold'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  ✏️ Custom amount
                </button>
                {tipOption === 'custom' && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-gray-400 text-sm font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      placeholder="0.00"
                      value={customTipStr}
                      onChange={e => setCustomTipStr(e.target.value)}
                      autoFocus
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8fafee]"
                    />
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400">Tips are split evenly among your hosts 🤍</p>
            </div>

            {/* Ticket code */}
            {placedOrder.ticketCode && (
              <div className="bg-[#d9e8fa] rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1 text-center">Your review ticket code</p>
                <p className="text-3xl font-black text-[#1e3a5f] tracking-[0.5em] text-center">
                  {placedOrder.ticketCode}
                </p>
                <p className="text-xs text-gray-400 text-center mt-1">
                  Save this to leave a review after your meal
                </p>
              </div>
            )}

            {/* Venmo QR */}
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-3">📱 On your phone — scan to open Venmo</p>
              <div className="flex justify-center">
                <QRCodeSVG value={deepLink} size={140} />
              </div>
            </div>

            {/* Pay button */}
            <a
              href={webLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl text-center transition-colors"
            >
              Pay on Venmo.com
            </a>

            <button
              onClick={() => { setPlacedOrder(null); setTipOption(null); setCustomTipStr('') }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 underline py-1"
            >
              Place another order
            </button>
          </div>
        </div>
      </main>
    )
  }

  // Derive review summary for the About section badge
  const reviewAvg = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null

  return (
    <main className="min-h-screen bg-[#f6e7d7]">
      {/* Header */}
      <header className="bg-[#8fafee] px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Lazy Orchard Café" width={52} height={52} priority />
          <p className="text-[#4a6fa8] text-xs font-medium">Order &amp; Pay</p>
        </div>
        <Link href="/orders" className="text-[#4a6fa8] hover:text-[#1e3a5f] text-sm underline underline-offset-2">
          Staff →
        </Link>
      </header>

      {/* About */}
      <div className="bg-white border-b border-[#f6e7d7] px-6 py-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-[#1e3a5f] font-semibold text-sm mb-1">Welcome to Lazy Orchard Café 🍑</p>
          <p className="text-gray-500 text-sm leading-relaxed">
            To celebrate the warmer weather and longer days ahead, we&apos;re bringing the café experience home.
            We&apos;ve been experimenting with new flavors and techniques, and we&apos;d love for you to be our first official tasters.
            This is the first of hopefully many events to come — thanks for being here.
          </p>
          {/* Reviews button */}
          <button
            onClick={() => setShowReviews(true)}
            className="mt-3 flex items-center gap-2 text-sm text-[#1e3a5f] hover:text-[#4a6fa8] transition-colors group"
          >
            <span className="text-[#8fafee]">
              {reviewAvg !== null
                ? `${'★'.repeat(Math.round(reviewAvg))}${'☆'.repeat(5 - Math.round(reviewAvg))}`
                : '★★★★★'}
            </span>
            <span className="font-semibold group-hover:underline">
              {reviews.length > 0
                ? `${reviewAvg!.toFixed(1)} · ${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`
                : 'Write a Review'}
            </span>
            <span className="text-gray-400 text-xs">›</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6">
        <div className="max-w-2xl mx-auto flex gap-6">
          {(['menu', 'rank'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t
                  ? 'border-[#8fafee] text-[#1e3a5f]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'menu' ? 'Menu' : 'Play Beli'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'rank' ? (
        <RankTab ratings={ratings} />
      ) : (
        <>
          <div
            className="max-w-2xl mx-auto px-4 py-8"
            style={{ paddingBottom: cartItems.length > 0 ? '180px' : '2rem' }}
          >
            {CATEGORIES.map(category => (
              <section key={category} className="mb-10">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#4a6fa8] mb-3 px-1">
                  {category}
                </h2>
                <div className="space-y-2">
                  {MENU.filter(item => item.category === category).map(item => {
                    const qty = cart.get(item.id) ?? 0
                    const isExpanded = expandedItem === item.id
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl p-4 shadow-sm cursor-pointer select-none"
                        onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl w-8 text-center flex-shrink-0">{item.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                            <p className="text-xs text-gray-400 truncate">{item.description}</p>
                          </div>
                          <span className="text-[#3a5f9e] font-semibold text-sm flex-shrink-0 flex items-center gap-1">
                            ${item.price.toFixed(2)}
                            <span
                              className="text-[#8fafee] text-xs leading-none transition-transform duration-300"
                              style={{ display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            >
                              ▾
                            </span>
                          </span>
                          <div
                            className="flex items-center gap-2 flex-shrink-0"
                            onClick={e => e.stopPropagation()}
                          >
                            {qty > 0 && (
                              <>
                                <button
                                  onClick={() => updateQty(item.id, -1)}
                                  className="w-7 h-7 rounded-full bg-[#d9e8fa] hover:bg-[#c5d8f6] text-[#1e3a5f] font-bold text-sm flex items-center justify-center transition-colors"
                                >
                                  −
                                </button>
                                <span className="w-4 text-center font-semibold text-sm">{qty}</span>
                              </>
                            )}
                            <button
                              onClick={() => updateQty(item.id, 1)}
                              className="w-7 h-7 rounded-full bg-[#8fafee] hover:bg-[#7a9de6] text-[#1e3a5f] font-bold text-sm flex items-center justify-center transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {/* Star ratings hidden — data/logic preserved, re-enable by removing 'hidden' */}
                        <div
                          className="hidden flex items-center gap-2 mt-2 pl-11"
                          onClick={e => e.stopPropagation()}
                        >
                          <StarRating rating={ratings[item.id] ?? 0} onRate={r => rate(item.id, r)} />
                          {ratings[item.id] > 0 && (
                            <span className="text-xs text-gray-300">
                              {['', 'Not for me', 'It\'s okay', 'Pretty good', 'Really good', 'Obsessed'][ratings[item.id]]}
                            </span>
                          )}
                        </div>
                        {/* Expandable detail panel */}
                        <div
                          style={{
                            maxHeight: isExpanded ? '260px' : '0px',
                            overflow: 'hidden',
                            transition: 'max-height 0.35s ease',
                          }}
                        >
                          <div className="mt-3 pt-3 border-t border-gray-100 pl-11 pr-1 space-y-1.5">
                            {/* Hot / Iced toggle — only for drinks with both options */}
                            {item.tempOptions && item.tempOptions.length > 1 && (
                              <div
                                className="flex gap-1.5 mb-0.5"
                                onClick={e => e.stopPropagation()}
                              >
                                {(['hot', 'iced'] as const).map(temp => {
                                  const selected = getDrinkTemp(item) === temp
                                  const isHot = temp === 'hot'
                                  return (
                                    <button
                                      key={temp}
                                      onClick={() => setDrinkTemp(prev => ({ ...prev, [item.id]: temp }))}
                                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                                        selected
                                          ? isHot
                                            ? 'bg-red-500 text-white border-red-500'
                                            : 'bg-blue-500 text-white border-blue-500'
                                          : isHot
                                          ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                                          : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                                      }`}
                                    >
                                      {isHot ? '☕ Hot' : '🧊 Iced'}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                            {item.calories !== undefined && (
                              <p className="text-xs text-gray-500">
                                🔥 <span className="font-medium">{item.calories} cal</span>
                              </p>
                            )}
                            {item.ingredients && item.ingredients.length > 0 && (
                              <p className="text-xs text-gray-500">
                                🌿 <span className="font-medium">Ingredients:</span>{' '}
                                {item.ingredients.join(', ')}
                              </p>
                            )}
                            {item.allergens && item.allergens.length > 0 && (
                              <p className="text-xs text-gray-500">
                                ⚠️ <span className="font-medium">Allergens:</span>{' '}
                                {item.allergens.join(', ')}
                              </p>
                            )}
                            {item.allergens && item.allergens.length === 0 && (
                              <p className="text-xs text-gray-400">✅ No common allergens</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          {cartItems.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-2xl px-4 py-4">
              <div className="max-w-2xl mx-auto space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Your name *"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8fafee]"
                  />
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8fafee]"
                  />
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <button
                  onClick={handleSubmit}
                  disabled={!customerName.trim() || loading}
                  className="w-full bg-[#8fafee] hover:bg-[#7a9de6] disabled:opacity-40 text-[#1e3a5f] font-semibold py-3 rounded-xl flex items-center justify-between px-5 transition-colors"
                >
                  <span>{loading ? 'Placing order…' : 'Place Order'}</span>
                  <span>${total.toFixed(2)}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review Modal */}
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
