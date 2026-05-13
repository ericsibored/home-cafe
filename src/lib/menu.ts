import type { MenuItem } from '@/types'

export const MENU: MenuItem[] = [
  // Coffee
  { id: 'espresso', name: 'Espresso', description: 'Double shot, rich and bold', price: 3.00, category: 'Coffee', emoji: '☕' },
  { id: 'latte', name: 'Latte', description: 'Espresso with steamed milk', price: 5.00, category: 'Coffee', emoji: '☕' },
  { id: 'cappuccino', name: 'Cappuccino', description: 'Espresso with silky foam', price: 4.50, category: 'Coffee', emoji: '☕' },
  { id: 'americano', name: 'Americano', description: 'Espresso with hot water', price: 3.50, category: 'Coffee', emoji: '☕' },
  { id: 'cold-brew', name: 'Cold Brew', description: '12-hour steep over ice', price: 5.50, category: 'Coffee', emoji: '🧊' },
  // Specialty
  { id: 'matcha', name: 'Matcha Latte', description: 'Ceremonial grade, oat milk', price: 5.50, category: 'Specialty', emoji: '🍵' },
  { id: 'chai', name: 'Chai Latte', description: 'House spice blend', price: 5.00, category: 'Specialty', emoji: '🍵' },
  { id: 'lavender-latte', name: 'Lavender Latte', description: 'House lavender syrup', price: 5.50, category: 'Specialty', emoji: '💜' },
  // Food
  { id: 'avocado-toast', name: 'Avocado Toast', description: 'Sourdough, avocado, everything seasoning', price: 9.00, category: 'Food', emoji: '🥑' },
  { id: 'croissant', name: 'Butter Croissant', description: 'Freshly baked, flaky', price: 4.00, category: 'Food', emoji: '🥐' },
  { id: 'banana-bread', name: 'Banana Bread', description: 'Walnut, brown butter glaze', price: 3.50, category: 'Food', emoji: '🍞' },
  { id: 'granola-bowl', name: 'Granola Bowl', description: 'House granola, Greek yogurt, honey', price: 7.00, category: 'Food', emoji: '🥣' },
  // Drinks
  { id: 'sparkling-water', name: 'Sparkling Water', description: 'Served with citrus', price: 2.00, category: 'Drinks', emoji: '💧' },
  { id: 'fresh-oj', name: 'Fresh OJ', description: 'Freshly squeezed orange juice', price: 4.00, category: 'Drinks', emoji: '🍊' },
]

export const CATEGORIES = [...new Set(MENU.map(item => item.category))]
