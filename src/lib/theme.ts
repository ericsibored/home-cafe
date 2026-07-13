// Shared brand tokens & font stacks for the Lazy Orchard Café site.
// Mirrors the palette originally defined inline in src/app/page.tsx so that
// new surfaces (event archive, future shared menu rendering) stay on-brand
// without duplicating hex values.

export const C = {
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

export const SERIF = 'var(--font-newsreader), Georgia, serif'
export const SANS  = 'var(--font-geist-sans), system-ui, sans-serif'
export const MONO  = 'var(--font-geist-mono), monospace'
