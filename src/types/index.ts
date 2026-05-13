export type OrderStatus = 'pending' | 'paid' | 'completed' | 'cancelled'

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  emoji: string
}

export interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  customer_name: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  note?: string
  created_at: string
}
