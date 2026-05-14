'use client'

import { useState, useEffect } from 'react'
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
}

// ── Star Rating ────────────────────────────────────────────────────────────────

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
  const [error, setError] = useState('')
  const [ratings, setRatings] = useState<Record<string, number>>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem('loc-ratings')
      if (saved) setRatings(JSON.parse(saved))
    } catch {}
  }, [])

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
      setPlacedOrder({ id: body.id, total, venmoNote })
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
    const encodedNote = encodeURIComponent(placedOrder.venmoNote)
    const amount = placedOrder.total.toFixed(2)
    const deepLink = `venmo://paycharge?txn=pay&recipients=${venmoUsername}&amount=${amount}&note=${encodedNote}`
    const webLink = `https://venmo.com/${venmoUsername}?txn=pay&amount=${amount}&note=${encodedNote}`

    return (
      <main className="min-h-screen bg-[#f6e7d7] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-lg text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-[#1e3a5f] mb-1">Order placed!</h2>
          <p className="text-gray-500 text-sm mb-6">Complete your payment to confirm.</p>
          <div className="bg-[#f6e7d7] rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-400 mb-1">Total due</p>
            <p className="text-4xl font-bold text-[#1e3a5f]">${amount}</p>
          </div>
          <div className="mb-5">
            <p className="text-xs text-gray-400 mb-3">📱 On your phone — scan to open Venmo</p>
            <div className="flex justify-center">
              <QRCodeSVG value={deepLink} size={160} />
            </div>
          </div>
          <a
            href={webLink}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl mb-6 transition-colors"
          >
            Pay on Venmo.com
          </a>
          <button
            onClick={() => setPlacedOrder(null)}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Place another order
          </button>
        </div>
      </main>
    )
  }

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
              {t === 'menu' ? 'Menu' : 'Stack Rank'}
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
                    return (
                      <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl w-8 text-center flex-shrink-0">{item.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                            <p className="text-xs text-gray-400 truncate">{item.description}</p>
                          </div>
                          <span className="text-[#3a5f9e] font-semibold text-sm flex-shrink-0">
                            ${item.price.toFixed(2)}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
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
                        <div className="flex items-center gap-2 mt-2 pl-11">
                          <StarRating rating={ratings[item.id] ?? 0} onRate={r => rate(item.id, r)} />
                          {ratings[item.id] > 0 && (
                            <span className="text-xs text-gray-300">
                              {['', 'Not for me', 'It\'s okay', 'Pretty good', 'Really good', 'Obsessed'][ratings[item.id]]}
                            </span>
                          )}
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
    </main>
  )
}
