'use client'

import { useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { MENU, CATEGORIES } from '@/lib/menu'
import type { OrderItem } from '@/types'

interface PlacedOrder {
  id: string
  total: number
  venmoNote: string
}

export default function MenuPage() {
  const [cart, setCart] = useState<Map<string, number>>(new Map())
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null)
  const [error, setError] = useState('')

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
      <header className="bg-[#8fafee] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1e3a5f]">Lazy Orchard Caf&#233;</h1>
          <p className="text-[#4a6fa8] text-xs">Order &amp; Pay</p>
        </div>
        <Link href="/orders" className="text-[#4a6fa8] hover:text-[#1e3a5f] text-sm underline underline-offset-2">
          Staff →
        </Link>
      </header>

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
                  <div key={item.id} className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm">
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
    </main>
  )
}
