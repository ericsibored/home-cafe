'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import type { Order, OrderStatus } from '@/types'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Awaiting Payment',
  paid: 'Paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

type Filter = OrderStatus | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Awaiting Payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => {
        setOrders(data ?? [])
        setLoading(false)
      })

    const channel = getSupabase()
      .channel('orders-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        payload => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => [payload.new as Order, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev =>
              prev.map(o => (o.id === (payload.new as Order).id ? (payload.new as Order) : o))
            )
          }
        }
      )
      .subscribe()

    return () => { getSupabase().removeChannel(channel) }
  }, [])

  const updateStatus = async (id: string, status: OrderStatus) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const activeCounts = {
    pending: orders.filter(o => o.status === 'pending').length,
    paid: orders.filter(o => o.status === 'paid').length,
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-amber-900 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Orders Dashboard</h1>
          <p className="text-amber-300 text-xs">
            {activeCounts.pending > 0 && `${activeCounts.pending} awaiting payment · `}
            {activeCounts.paid > 0 && `${activeCounts.paid} to prepare`}
            {activeCounts.pending === 0 && activeCounts.paid === 0 && 'All clear'}
          </p>
        </div>
        <Link href="/" className="text-amber-300 hover:text-white text-sm underline underline-offset-2">
          ← Menu
        </Link>
      </header>

      <div className="px-4 pt-4 flex gap-2 flex-wrap max-w-4xl mx-auto">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f.value
                ? 'bg-amber-800 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {f.label}
            {f.value !== 'all' && orders.filter(o => o.status === f.value).length > 0 && (
              <span className="ml-1 opacity-70">
                ({orders.filter(o => o.status === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
        {loading && (
          <div className="text-center text-gray-400 py-20 text-sm">Loading orders…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-gray-400 py-20 text-sm">No orders</div>
        )}
        {filtered.map(order => (
          <div key={order.id} className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{order.customer_name}</h3>
                <p className="text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>

            <ul className="space-y-1 mb-3 border-t border-gray-50 pt-3">
              {order.items.map((item, i) => (
                <li key={i} className="flex justify-between text-sm text-gray-700">
                  <span>
                    <span className="font-medium">{item.quantity}×</span> {item.name}
                  </span>
                  <span className="text-gray-400">${(item.price * item.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>

            {order.note && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                📝 {order.note}
              </p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <span className="font-bold text-amber-900">${order.total.toFixed(2)}</span>
              <div className="flex gap-2">
                {order.status === 'pending' && (
                  <>
                    <button
                      onClick={() => updateStatus(order.id, 'paid')}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Mark Paid
                    </button>
                    <button
                      onClick={() => updateStatus(order.id, 'cancelled')}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {order.status === 'paid' && (
                  <button
                    onClick={() => updateStatus(order.id, 'completed')}
                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Complete ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
