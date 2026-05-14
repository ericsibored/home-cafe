import type { MenuItem } from '@/types'

export const MENU: MenuItem[] = [
  // Drinks
  { id: 'banana-milk-coffee', name: 'Banana Milk Coffee Latte', description: 'Espresso, banana milk, caramel', price: 4.00, category: 'Drinks', emoji: '🍌' },
  { id: 'hojicha-persimmon', name: 'Hojicha Persimmon Latte', description: 'Roasted hojicha, persimmon purée, oat milk', price: 4.00, category: 'Drinks', emoji: '🍂' },
  { id: 'matcha-cherry-spritz', name: 'Matcha Cherry Spritz', description: 'Ceremonial matcha, cherry syrup, sparkling water', price: 4.00, category: 'Drinks', emoji: '🍒' },
  { id: 'lychee-matcha', name: 'Lychee Matcha Latte', description: 'Ceremonial matcha, lychee, oat milk', price: 4.00, category: 'Drinks', emoji: '🌸' },
  // Food
  { id: 'scallion-pancake-croissant', name: 'Scallion Pancake Croissant', description: 'Flaky croissant layered with scallion pancake', price: 2.50, category: 'Food', emoji: '🥐' },
  { id: 'jasmine-grape-cake', name: 'Jasmine Green Grape Cream Cake', description: 'Jasmine sponge, green grape, diplomat cream', price: 2.50, category: 'Food', emoji: '🍰' },
  { id: 'strawberry-earl-grey-cookies', name: 'Strawberry & Earl Grey Cookies', description: 'Buttery shortbread, earl grey, strawberry jam', price: 2.50, category: 'Food', emoji: '🍓' },
  { id: 'black-sesame-coconut-cookies', name: 'Black Sesame Coconut Cookies', description: 'Toasted black sesame, coconut flakes', price: 2.50, category: 'Food', emoji: '🍪' },
]

export const CATEGORIES = [...new Set(MENU.map(item => item.category))]
