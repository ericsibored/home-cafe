export type OrderStatus = 'pending' | 'paid' | 'completed' | 'cancelled'

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  emoji: string
  calories?: number
  allergens?: string[]
  ingredients?: string[]
  tempOptions?: ('hot' | 'iced')[]
  image?: string
  imagePosition?: string
  imageFit?: 'cover' | 'contain'
  imageTransform?: string
  addOns?: string[]
  milkOptions?: string[]
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
  ticket_code?: string
  created_at: string
}

// A verbatim capture of the menu as it was served at an event.
export interface MenuSnapshot {
  items: MenuItem[]
}

export interface CafeEvent {
  id: string
  slug: string
  name: string
  date: string          // ISO date (YYYY-MM-DD)
  description: string | null
  is_active: boolean
  menu_snapshot: MenuSnapshot | null
  created_at: string
}

// Optional presentational payload stored alongside a menu item.
export interface MenuItemDetails {
  price?: number
  image?: string
  emoji?: string
  calories?: number
  allergens?: string[]
  tempOptions?: ('hot' | 'iced')[]
  milkOptions?: string[]
  addOns?: string[]
  imagePosition?: string
  imageFit?: 'cover' | 'contain'
  imageTransform?: string
}

// A row in menu_items — the hero "Specialties" for an event.
export interface MenuItemRow {
  id: string
  event_id: string
  name: string
  description: string | null
  ingredients: string[] | null
  sold_out: boolean
  category: string | null
  sort_order: number
  details: MenuItemDetails | null
  created_at: string
}

export type OrderItemType = 'specialty' | 'builder'
export type EventOrderStatus = 'pending' | 'made'

export interface EventOrderSummary {
  name?: string          // specialty
  temp?: 'hot' | 'iced'  // specialty
  base?: string          // builder
  milk?: string          // builder
  syrup?: string         // builder
  modifier?: string      // builder
}

export interface EventOrder {
  id: string
  event_id: string
  item_type: OrderItemType
  item_summary: EventOrderSummary
  label: string
  guest_name: string
  status: EventOrderStatus
  created_at: string
}

export interface CollageEntry {
  id: string
  photo_url: string
  note: string | null
  guest_name: string
  event_id: string | null
  created_at: string
}

export type BuilderCategory = 'base' | 'milk' | 'syrup' | 'modifier'

// A row in builder_options — one choice in the "Build Your Own" matrix.
export interface BuilderOption {
  id: string
  event_id: string
  category: BuilderCategory
  name: string
  available: boolean
  sort_order: number
  created_at: string
}
