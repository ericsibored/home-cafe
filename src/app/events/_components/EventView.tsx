'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { getSupabase } from '@/lib/supabase'
import { venmoProfileUrl, venmoPayDeepLink, VENMO_HANDLE } from '@/lib/venmo'
import { C, SERIF, SANS } from '@/lib/theme'
import type {
  CafeEvent, MenuItemRow, BuilderOption, BuilderCategory, EventOrderSummary, OrderItemType,
} from '@/types'

function formatEventDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

// The in-progress order the guest is about to place.
type OrderDraft =
  | { type: 'specialty'; name: string; temps: ('hot' | 'iced')[]; quantity: number; addOnOptions: string[]; unitPrice: number | null }
  | { type: 'builder'; base: string; milk: string | null; syrup: string | null; cream: string | null; modifier: string | null; quantity: number; unitPrice: number | null }

// One configured item waiting in the cart. Quantity is kept separate from the
// label so it can be edited at checkout.
type CartLine = {
  key: string
  type: OrderItemType
  label: string
  summary: EventOrderSummary
  quantity: number
  unitPrice: number | null
}

// ── Specialty card ──────────────────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: SANS, fontSize: 10.5, padding: '2px 8px', borderRadius: 999,
      background: C.pale, color: C.navy, fontWeight: 600 }}>
      {children}
    </span>
  )
}

function tempLabel(temp?: ('hot' | 'iced')[]): string | null {
  if (!temp || temp.length === 0) return null
  if (temp.length > 1) return '☕ hot / 🧊 iced'
  return temp[0] === 'iced' ? '🧊 iced only' : '☕ hot only'
}

// Ecommerce-style − / + quantity control, reused on the card and in the modal.
function QtyStepper({ qty, onChange, min = 1, max = 9, size = 34 }: {
  qty: number; onChange: (n: number) => void; min?: number; max?: number; size?: number
}) {
  const btn = (disabled: boolean, onClick: () => void, label: string, glyph: string) => (
    <button onClick={onClick} disabled={disabled} aria-label={label}
      style={{ width: size, height: size, borderRadius: 999, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', background: 'transparent',
        color: disabled ? C.ink3 : C.navy, fontFamily: SANS, fontSize: size * 0.53, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
      {glyph}
    </button>
  )
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', background: C.pale, borderRadius: 999, padding: 3 }}>
      {btn(qty <= min, () => onChange(Math.max(min, qty - 1)), 'Decrease quantity', '−')}
      <span style={{ fontFamily: SANS, fontSize: size * 0.44, fontWeight: 700, color: C.navy,
        minWidth: size, textAlign: 'center' }}>{qty}</span>
      {btn(qty >= max, () => onChange(Math.min(max, qty + 1)), 'Increase quantity', '+')}
    </div>
  )
}

function SpecialtyCard({ item, orderable, onOrder }: {
  item: MenuItemRow; orderable: boolean; onOrder: (item: MenuItemRow, quantity: number) => void
}) {
  const d = item.details ?? {}
  const [qty, setQty] = useState(0)
  const soldOut = item.sold_out
  const temp = tempLabel(d.tempOptions)
  return (
    <div style={{ background: C.card, borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(30,58,95,0.09)', display: 'flex', flexDirection: 'column',
      opacity: soldOut ? 0.6 : 1, position: 'relative' }}>
      {d.image ? (
        <div style={{ width: '100%', aspectRatio: '3/4', overflow: 'hidden', flexShrink: 0,
          position: 'relative', background: C.surface }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.image} alt={item.name}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              objectFit: d.imageFit ?? 'contain',
              objectPosition: d.imagePosition ?? 'center center',
              transform: d.imageTransform,
              filter: soldOut ? 'grayscale(0.7)' : undefined, display: 'block' }} />
          {soldOut && (
            <span style={{ position: 'absolute', top: 10, left: 10, fontFamily: SANS, fontSize: 11,
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: C.card,
              background: C.red, borderRadius: 999, padding: '3px 10px' }}>
              Sold out
            </span>
          )}
        </div>
      ) : (
        <div style={{ width: '100%', aspectRatio: '3/4', background: C.peach, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 60, flexShrink: 0,
          filter: soldOut ? 'grayscale(0.7)' : undefined }}>
          {d.emoji ?? '☕'}
        </div>
      )}
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: C.navy,
              lineHeight: 1.2, letterSpacing: -0.2 }}>{item.name}</span>
            {soldOut && !d.image && (
              <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: 0.5, color: C.card, background: C.red, borderRadius: 999, padding: '2px 8px' }}>
                Sold out
              </span>
            )}
          </div>
          {item.description && (
            <div style={{ fontFamily: SANS, fontSize: 12, color: C.ink2, marginTop: 3, lineHeight: 1.35 }}>
              {item.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {typeof d.price === 'number' && (
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: C.blueDeep }}>
              ${d.price.toFixed(2)}
            </span>
          )}
          {temp && <Tag>{temp}</Tag>}
          {d.milkOptions && d.milkOptions.length > 0 && <Tag>🥛 {d.milkOptions.join(' / ')}</Tag>}
          {d.addOns && d.addOns.map(a => <Tag key={a}>+ {a}</Tag>)}
        </div>
        {item.ingredients && item.ingredients.length > 0 && (
          <div style={{ paddingTop: 8, borderTop: `1px solid ${C.ruleSoft}`,
            fontFamily: SANS, fontSize: 11, color: C.ink2, lineHeight: 1.3 }}>
            {item.ingredients.join(', ')}
          </div>
        )}
        {orderable && !soldOut && (
          <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'center',
            gap: 8, flexWrap: 'wrap' }}>
            <QtyStepper qty={qty} onChange={setQty} min={0} size={32} />
            <button onClick={qty > 0 ? () => onOrder(item, qty) : undefined} disabled={qty === 0} style={{
              flex: 1, minWidth: 84, fontFamily: SANS, fontSize: 13, fontWeight: 700, padding: '9px 14px',
              borderRadius: 999, background: C.navy, color: C.peach, border: 'none',
              cursor: qty === 0 ? 'not-allowed' : 'pointer', opacity: qty === 0 ? 0.45 : 1,
              boxShadow: qty === 0 ? 'none' : '0 2px 8px rgba(30,58,95,0.2)' }}>
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Specialties section ─────────────────────────────────────────────────────
function Specialties({ items, orderable, onOrder }: {
  items: MenuItemRow[]; orderable: boolean; onOrder: (item: MenuItemRow, quantity: number) => void
}) {
  const categories = useMemo(() => [...new Set(items.map(i => i.category ?? ''))], [items])
  const grouped = categories.length > 1 || (categories.length === 1 && categories[0] !== '')

  const grid = (list: MenuItemRow[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
      {list.map(item => <SpecialtyCard key={item.id} item={item} orderable={orderable} onOrder={onOrder} />)}
    </div>
  )

  return (
    <section>
      <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, color: C.navy, marginBottom: 4 }}>
        Specialties
      </h2>
      <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink2, marginBottom: 16 }}>
        The signature drinks & bites for this event.
      </p>
      {grouped ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {categories.map(cat => (
            <div key={cat || 'uncategorized'}>
              {cat && (
                <h3 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, color: C.midBlue, marginBottom: 10 }}>
                  {cat}
                </h3>
              )}
              {grid(items.filter(i => (i.category ?? '') === cat))}
            </div>
          ))}
        </div>
      ) : grid(items)}
    </section>
  )
}

// ── Build Your Own (constrained step picker) ────────────────────────────────
// Flavor-based tints for build-your-own chips (first match wins; order matters
// so e.g. "Oat Milk" hits oat before the generic milk/cream rule).
type Tint = { soft: string; strong: string; border: string; fg: string }
const FLAVOR_TINTS: { match: RegExp; tint: Tint }[] = [
  { match: /passionfruit|passion/i,            tint: { soft: '#fbf0cf', strong: '#f5dd93', border: '#e0b94a', fg: '#6b5212' } },
  { match: /persimmon/i,                        tint: { soft: '#fbe2cc', strong: '#f3c088', border: '#dd8f3f', fg: '#7a3f14' } },
  { match: /matcha/i,                          tint: { soft: '#e4efd6', strong: '#bfe0a0', border: '#8cbf63', fg: '#3c5a20' } },
  { match: /oat/i,                             tint: { soft: '#efe6d2', strong: '#ddc99e', border: '#c0a878', fg: '#5a4a2e' } },
  { match: /espresso|coffee|hojicha|chestnut/i, tint: { soft: '#e9ddd0', strong: '#cdac86', border: '#a9784f', fg: '#5a3a1e' } },
  { match: /blueberry|blue/i,                  tint: { soft: '#dce5f6', strong: '#a9c1ec', border: '#6f8fd0', fg: '#2a3f6e' } },
  { match: /strawberry|rose|lychee/i,          tint: { soft: '#f6dde3', strong: '#eeb0bf', border: '#d97a92', fg: '#7a2a3f' } },
  { match: /brown sugar|caramel|thai/i,        tint: { soft: '#eee0cc', strong: '#dcc094', border: '#bf9c5e', fg: '#5e421e' } },
  { match: /vanilla|cream|whipped|milk|fairlife/i, tint: { soft: '#f3ece0', strong: '#e6d7bd', border: '#cbb896', fg: '#5a4e38' } },
]
function flavorTint(name: string): Tint {
  return FLAVOR_TINTS.find(t => t.match.test(name))?.tint
    ?? { soft: C.pale, strong: C.blue, border: C.blueHover, fg: C.navy }
}

function OptionChip({ name, selected, available, onClick }: {
  name: string; selected: boolean; available: boolean; onClick: () => void
}) {
  const t = flavorTint(name)
  return (
    <button
      onClick={available ? onClick : undefined}
      disabled={!available}
      style={{
        fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 999,
        cursor: available ? 'pointer' : 'not-allowed',
        border: `1.5px solid ${!available ? C.rule : selected ? t.border : 'transparent'}`,
        background: !available ? C.card : selected ? t.strong : t.soft,
        color: available ? t.fg : C.ink3,
        opacity: available ? 1 : 0.5,
        textDecoration: available ? 'none' : 'line-through',
        boxShadow: selected && available ? `0 1px 4px ${t.border}66` : 'none',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
      {name}
      {!available && <span style={{ fontSize: 10, fontWeight: 700 }}>sold out</span>}
    </button>
  )
}

// Every build-your-own drink is the same flat price.
const BUILDER_PRICE = 7.5

function BuildYourOwn({ options, orderable, onOrder }: {
  options: BuilderOption[]
  orderable: boolean
  onOrder: (draft: { base: string; milk: string | null; syrup: string | null; cream: string | null; modifier: string | null; quantity: number }) => void
}) {
  const byCat = (cat: BuilderCategory) => options.filter(o => o.category === cat)
  const bases = byCat('base')
  const milks = byCat('milk')
  const syrups = byCat('syrup')
  const modifiers = byCat('modifier')

  const [base, setBase] = useState<string | null>(null)
  const [milk, setMilk] = useState<string | null>(null)
  const [syrup, setSyrup] = useState<string | null>(null)
  const [modifier, setModifier] = useState<string | null>(null)
  const [qty, setQty] = useState(0)

  const step = (label: string, hint: string, opts: BuilderOption[],
    selected: string | null, onPick: (name: string | null) => void, optional = false) => {
    if (opts.length === 0) return null
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 0.6, color: C.navy }}>{label}</span>
          <span style={{ fontFamily: SANS, fontSize: 11.5, color: C.ink3 }}>{hint}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {opts.map(o => (
            <OptionChip key={o.id} name={o.name} available={o.available}
              selected={selected === o.name}
              onClick={() => onPick(selected === o.name && optional ? null : o.name)} />
          ))}
        </div>
      </div>
    )
  }

  // Only the categories present for this event, numbered in order. Base, milk
  // and syrup (when offered) are required; modifier is always optional.
  const stepDefs = [
    { label: 'Base', hint: 'choose one', opts: bases, sel: base, set: setBase, optional: false },
    { label: 'Milk', hint: 'choose one', opts: milks, sel: milk, set: setMilk, optional: false },
    { label: 'Syrup', hint: 'optional', opts: syrups, sel: syrup, set: setSyrup, optional: true },
    { label: 'Modifier', hint: 'optional', opts: modifiers, sel: modifier, set: setModifier, optional: true },
  ].filter(s => s.opts.length > 0)

  // Base is required; milk too when offered. Syrup / cream / modifier are optional.
  const complete = !!base && (milks.length === 0 || !!milk)
  // Ordering also needs a quantity of at least one.
  const canOrder = complete && qty > 0

  const parts = [base, milk, syrup, modifier].filter(Boolean)

  return (
    <section>
      <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, color: C.navy, marginBottom: 4 }}>
        Build your own
      </h2>
      <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink2, marginBottom: 16 }}>
        Pick a base and build your drink from there.
      </p>
      {/* One distinct item: the whole builder in a white card like the specialties */}
      <div style={{ background: C.card, borderRadius: 18, padding: 18,
        boxShadow: '0 2px 12px rgba(30,58,95,0.09)' }}>
        {/* Steps on the left, anatomy illustration on the right (wraps below on
            narrow screens) so the diagram lines up with the customizations. */}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {stepDefs.map((s, i) => (
              <div key={s.label}>{step(`${i + 1} · ${s.label}`, s.hint, s.opts, s.sel, s.set, s.optional)}</div>
            ))}
          </div>
          <div style={{ flex: '0 1 170px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/latte-anatomy.webp" alt="Anatomy of a home cafe latte: cream top, caffeine shot, milk choice, and syrup base layers"
              style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block' }} />
          </div>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
              color: C.midBlue, marginBottom: 4 }}>Your drink</div>
            <div style={{ fontFamily: SERIF, fontSize: 16, color: complete ? C.navy : C.ink3 }}>
              {complete ? parts.join(' + ') : 'Choose your options to build a drink'}
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: C.blueDeep, marginTop: 4 }}>
              ${BUILDER_PRICE.toFixed(2)}
            </div>
          </div>
          {orderable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <QtyStepper qty={qty} onChange={setQty} min={0} />
              <button
                onClick={canOrder ? () => onOrder({ base: base!, milk, syrup, cream: null, modifier, quantity: qty }) : undefined}
                disabled={!canOrder}
                style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, padding: '10px 18px',
                  borderRadius: 999, background: C.navy, color: C.peach, border: 'none', flexShrink: 0,
                  cursor: canOrder ? 'pointer' : 'not-allowed', opacity: canOrder ? 1 : 0.45,
                  boxShadow: canOrder ? '0 2px 8px rgba(30,58,95,0.2)' : 'none' }}>
                Add to order
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Welcome popup ───────────────────────────────────────────────────────────
const BANANA_BREAD_ANCHOR = 'burnttoast'
const WELCOME_SEEN_KEY = 'lazy-orchard-welcome-seen'

// 'vol-4' -> 'v4'; anything unrecognised just drops the version.
function cafeVersionLabel(slug: string): string {
  const n = /vol-(\d+)/i.exec(slug)?.[1]
  return n ? `Home Cafe v${n}` : 'Home Cafe'
}

function WelcomeModal({ onClose, showLoafLink, cafeLabel }: {
  onClose: () => void; showLoafLink: boolean; cafeLabel: string
}) {
  // Close first so the modal is gone before the page scrolls underneath it.
  const jumpToLoaf = () => {
    onClose()
    setTimeout(() => {
      document.getElementById(BANANA_BREAD_ANCHOR)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Welcome"
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(30,58,95,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.card, width: '100%', maxWidth: 400, maxHeight: '85vh',
          overflowY: 'auto', borderRadius: 24, padding: '24px 22px 26px', position: 'relative',
          boxShadow: '0 12px 40px rgba(30,58,95,0.28)' }}>
        <button onClick={onClose} aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 999,
            border: 'none', background: C.pale, color: C.midBlue, fontSize: 15, cursor: 'pointer',
            lineHeight: 1 }}>
          ✕
        </button>

        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 24, color: C.navy,
          paddingRight: 34, lineHeight: 1.2 }}>
          Welcome to {cafeLabel} ☕
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink2, lineHeight: 1.5, margin: 0 }}>
            <strong style={{ color: C.navy }}>Order whatever you want</strong> — as much as you like.
            Prices are shown on the menu, but everything is discounted at checkout.
          </p>
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink2, lineHeight: 1.5, margin: 0 }}>
            Your <strong style={{ color: C.navy }}>Venmo admission covers our ingredient costs</strong>,
            so there is nothing more to pay.
          </p>
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink2, lineHeight: 1.5, margin: 0 }}>
            We hope you enjoy!
            <br />
            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 16, color: C.navy }}>
              Eric &amp; Minji
            </span>
          </p>
        </div>

        {showLoafLink && (
          <button onClick={jumpToLoaf}
            style={{ marginTop: 16, width: '100%', boxSizing: 'border-box', padding: '12px 14px',
              borderRadius: 14, cursor: 'pointer', textAlign: 'left',
              border: `1.5px solid ${C.rule}`, background: C.surface,
              fontFamily: SANS, fontSize: 13.5, color: C.navy }}>
            🍞 Want to buy a loaf?
            <br />
            <span style={{ fontWeight: 700 }}>Click this bubble ↓</span>
          </button>
        )}

        <button onClick={onClose}
          style={{ marginTop: 16, width: '100%', padding: '13px 0', borderRadius: 999, border: 'none',
            background: C.navy, color: C.peach, fontFamily: SANS, fontSize: 15, fontWeight: 700,
            cursor: 'pointer' }}>
          Got it — let&apos;s order
        </button>
      </div>
    </div>
  )
}

// ── BurntToast's Banana Bread (Vol. 4 one-off: buy direct via Venmo, no cart) ─
const BANANA_BREAD_PRICE = 25.0
const BANANA_BREAD_VENMO_HANDLE = 'rminjic85'

function BananaBreadDrop({ orderable }: { orderable: boolean }) {
  const [qty, setQty] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => { setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) }, [])

  const subtotal = qty * BANANA_BREAD_PRICE
  const note = `Cafe v4 Banana Bread Loaf x ${qty}`
  const canOrder = orderable && qty > 0
  const buttonHref = !canOrder ? undefined
    : isMobile ? venmoPayDeepLink(BANANA_BREAD_VENMO_HANDLE, subtotal, note)
    : venmoProfileUrl(BANANA_BREAD_VENMO_HANDLE)
  const anchorProps = isMobile ? {} : { target: '_blank', rel: 'noopener noreferrer' }

  return (
    <section id={BANANA_BREAD_ANCHOR} style={{ scrollMarginTop: 16 }}>
      <h2 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, color: C.navy, marginBottom: 4 }}>
        Minji&apos;s Banana Bread
      </h2>
      <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink2, marginBottom: 16 }}>
        @burnttoast.nyc — sold separately from the menu, pay directly on Venmo.
      </p>
      <div style={{ background: C.card, borderRadius: 18, padding: 18,
        boxShadow: '0 2px 12px rgba(30,58,95,0.09)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderRadius: 12,
          background: C.surface }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/menu/banana-bread.webp" alt="BurntToast's Banana Bread loaf, sliced"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: C.navy }}>
            Minji&apos;s Banana Bread
          </div>
          <div style={{ fontFamily: SANS, fontSize: 12, color: C.ink2, marginTop: 3, lineHeight: 1.35 }}>
            Sticky toffee pudding meets banana bread, made with imported French butter
            and vanilla.
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: C.blueDeep, marginTop: 8 }}>
            ${BANANA_BREAD_PRICE.toFixed(2)} / loaf
          </div>
        </div>
        <div style={{ paddingTop: 14, borderTop: `1px solid ${C.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
              color: C.midBlue, marginBottom: 4 }}>Loaves</div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 14, color: C.navy }}>
              {qty > 0 ? `Subtotal $${subtotal.toFixed(2)}` : 'Choose a quantity'}
            </div>
          </div>
          {orderable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <QtyStepper qty={qty} onChange={setQty} min={0} />
              <a href={buttonHref} {...(canOrder ? anchorProps : {})}
                aria-disabled={!canOrder}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: SANS, fontSize: 13, fontWeight: 700, padding: '10px 18px',
                  borderRadius: 999, background: canOrder ? C.venmo : C.rule,
                  color: canOrder ? '#ffffff' : C.ink3, textDecoration: 'none', flexShrink: 0,
                  pointerEvents: canOrder ? 'auto' : 'none',
                  boxShadow: canOrder ? '0 2px 8px rgba(61,149,206,0.35)' : 'none' }}>
                Pay on venmo
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Item modal (configure, then add to the cart) ─────────────────────────────
function ItemModal({ draft, onClose, onAdd }: {
  draft: OrderDraft
  onClose: () => void
  onAdd: (temp: 'hot' | 'iced' | null, quantity: number, addOns: string[]) => void
}) {
  const [qty, setQty] = useState(Math.max(1, draft.quantity))
  const [addOns, setAddOns] = useState<string[]>([])
  const addOnOptions = draft.type === 'specialty' ? draft.addOnOptions : []
  const toggleAddOn = (a: string) =>
    setAddOns(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  const multiTemp = draft.type === 'specialty' && draft.temps.length > 1
  const [temp, setTemp] = useState<'hot' | 'iced'>(
    draft.type === 'specialty' ? (draft.temps[0] ?? 'iced') : 'iced'
  )

  const title = draft.type === 'specialty'
    ? draft.name
    : [draft.base, draft.milk, draft.syrup, draft.cream, draft.modifier].filter(Boolean).join(' + ')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(30,58,95,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: '100%', maxWidth: 460,
        borderRadius: 24, padding: '22px 20px 28px',
        boxShadow: '0 12px 40px rgba(30,58,95,0.25)' }}>
        <div style={{ fontFamily: SANS, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
          color: C.midBlue }}>Add to order</div>
        <div style={{ fontFamily: SERIF, fontSize: 22, color: C.navy, marginTop: 4 }}>{title}</div>

        {multiTemp && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.midBlue, marginBottom: 6 }}>
              Temperature
            </div>
            <div style={{ display: 'inline-flex', background: C.pale, borderRadius: 999, padding: 3 }}>
              {(draft as { temps: ('hot' | 'iced')[] }).temps.map(t => (
                <button key={t} onClick={() => setTemp(t)} style={{
                  padding: '5px 14px', borderRadius: 999, fontFamily: SANS, fontSize: 12.5, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  color: temp === t ? C.navy : C.midBlue,
                  background: temp === t ? C.card : 'transparent',
                }}>{t === 'hot' ? '☕ hot' : '🧊 iced'}</button>
              ))}
            </div>
          </div>
        )}

        {addOnOptions.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.midBlue, marginBottom: 6 }}>
              Add-ons <span style={{ fontWeight: 400, color: C.ink3 }}>· optional</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {addOnOptions.map(a => {
                const on = addOns.includes(a)
                const t = flavorTint(a)
                return (
                  <button key={a} onClick={() => toggleAddOn(a)} style={{
                    fontFamily: SANS, fontSize: 13, fontWeight: 600, padding: '7px 13px', borderRadius: 999,
                    cursor: 'pointer', border: `1.5px solid ${on ? t.border : 'transparent'}`,
                    background: on ? t.strong : t.soft, color: t.fg,
                    boxShadow: on ? `0 1px 4px ${t.border}66` : 'none' }}>
                    {on ? '✓ ' : '+ '}{a}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.midBlue, marginBottom: 6 }}>
            Quantity
          </div>
          <QtyStepper qty={qty} onChange={setQty} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 999,
            border: `1px solid ${C.rule}`, background: 'transparent', fontFamily: SANS, fontSize: 14,
            fontWeight: 600, color: C.midBlue, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => onAdd(multiTemp ? temp : (draft.type === 'specialty' ? (draft.temps[0] ?? null) : null), qty, addOns)}
            style={{ flex: 2, padding: '12px 0', borderRadius: 999, border: 'none',
              background: C.navy, color: C.peach, fontFamily: SANS, fontSize: 14, fontWeight: 700,
              cursor: 'pointer' }}>
            Add to order
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tip card (prominent, on the confirmation screen) ────────────────────────
function TipCard({ amount, note }: { amount?: number | null; note?: string }) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => { setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) }, [])

  // Mobile → open the Venmo app pay screen; desktop → web profile fallback.
  const buttonHref = isMobile
    ? venmoPayDeepLink(VENMO_HANDLE, amount ?? undefined, note)
    : venmoProfileUrl()
  const anchorProps = isMobile ? {} : { target: '_blank', rel: 'noopener noreferrer' }

  return (
    <div style={{ marginTop: 24, background: C.card, borderRadius: 22, padding: '22px 20px',
      boxShadow: '0 6px 20px rgba(30,58,95,0.12)', maxWidth: 380, width: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, color: C.navy, textAlign: 'center' }}>
        Tips help fund and support home cafe R&amp;D ☕
      </div>
      <a href={buttonHref} {...anchorProps} style={{ display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
        padding: '15px 22px', borderRadius: 999, background: C.venmo, color: '#ffffff',
        fontFamily: SANS, fontWeight: 700, fontSize: 16, textDecoration: 'none',
        boxShadow: '0 4px 14px rgba(61,149,206,0.35)' }}>
        Tip{amount ? ` $${amount.toFixed(2)}` : ''} on{' '}
        <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 20 }}>venmo</span>
      </a>
      <div style={{ fontFamily: SANS, fontSize: 12, color: C.ink3 }}>or scan to tip</div>
      <div style={{ background: '#ffffff', padding: 10, borderRadius: 14,
        boxShadow: `inset 0 0 0 1px ${C.rule}` }}>
        <QRCodeSVG value={venmoProfileUrl()} size={132} level="M" fgColor={C.navy} bgColor="#ffffff" />
      </div>
      <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.midBlue }}>@{VENMO_HANDLE}</div>
    </div>
  )
}

// ── Cart ────────────────────────────────────────────────────────────────────
function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + (l.unitPrice ?? 0) * l.quantity, 0)
}

// Sticky bar that appears once something is in the cart.
function CartBar({ lines, onReview }: { lines: CartLine[]; onReview: () => void }) {
  const count = lines.reduce((n, l) => n + l.quantity, 0)
  return (
    <div style={{ position: 'sticky', bottom: 0, zIndex: 30, padding: '10px 18px 14px',
      background: 'linear-gradient(to top, rgba(253,238,228,0.98) 60%, rgba(253,238,228,0))' }}>
      <button onClick={onReview} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, width: '100%', maxWidth: 640, margin: '0 auto', padding: '14px 20px', borderRadius: 999,
        border: 'none', background: C.navy, color: C.peach, cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(30,58,95,0.28)' }}>
        <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700 }}>
          🛒 {count} item{count === 1 ? '' : 's'}
        </span>
        <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700 }}>
          ${cartTotal(lines).toFixed(2)} · Review →
        </span>
      </button>
    </div>
  )
}

function CheckoutModal({ lines, onClose, onChangeQty, onRemove, onPlace, placing, error }: {
  lines: CartLine[]
  onClose: () => void
  onChangeQty: (key: string, quantity: number) => void
  onRemove: (key: string) => void
  onPlace: (guestName: string) => void
  placing: boolean
  error: string
}) {
  const [name, setName] = useState('')
  const ready = !!name.trim() && lines.length > 0 && !placing

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(30,58,95,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: '100%', maxWidth: 460,
        maxHeight: '85vh', overflowY: 'auto', borderRadius: 24, padding: '22px 20px 28px',
        boxShadow: '0 12px 40px rgba(30,58,95,0.25)' }}>
        <div style={{ fontFamily: SANS, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
          color: C.midBlue }}>Your order</div>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, color: C.navy, marginTop: 4 }}>
          Review &amp; check out
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lines.length === 0 && (
            <p style={{ fontFamily: SANS, fontSize: 13, color: C.ink3 }}>Your order is empty.</p>
          )}
          {lines.map(l => (
            <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 10,
              paddingBottom: 12, borderBottom: `1px solid ${C.ruleSoft}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SERIF, fontSize: 15, color: C.navy }}>{l.label}</div>
                {l.unitPrice !== null && (
                  <div style={{ fontFamily: SANS, fontSize: 12, color: C.ink3, marginTop: 2 }}>
                    ${(l.unitPrice * l.quantity).toFixed(2)}
                  </div>
                )}
              </div>
              <QtyStepper qty={l.quantity} onChange={n => onChangeQty(l.key, n)} size={30} />
              <button onClick={() => onRemove(l.key)} aria-label={`Remove ${l.label}`}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.ink3,
                  fontSize: 16, padding: 4 }}>✕</button>
            </div>
          ))}
        </div>

        {lines.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.midBlue }}>Total</span>
            <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: C.blueDeep }}>
              ${cartTotal(lines).toFixed(2)}
            </span>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <label style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.midBlue,
            display: 'block', marginBottom: 6 }}>Your name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Sam"
            onKeyDown={e => { if (e.key === 'Enter' && ready) onPlace(name.trim()) }}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: SANS, fontSize: 15,
              padding: '11px 14px', borderRadius: 12, border: `1px solid ${C.rule}`, outline: 'none' }} />
        </div>

        {error && <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.red, marginTop: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 999,
            border: `1px solid ${C.rule}`, background: 'transparent', fontFamily: SANS, fontSize: 14,
            fontWeight: 600, color: C.midBlue, cursor: 'pointer' }}>Keep browsing</button>
          <button onClick={() => onPlace(name.trim())} disabled={!ready}
            style={{ flex: 2, padding: '12px 0', borderRadius: 999, border: 'none',
              background: C.navy, color: C.peach, fontFamily: SANS, fontSize: 14, fontWeight: 700,
              cursor: ready ? 'pointer' : 'not-allowed', opacity: ready ? 1 : 0.5 }}>
            {placing ? 'Placing…' : 'Place order'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confirmation screen (novelty receipt — everything is on the house) ───────
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const TIP_PCTS = [15, 20, 25] as const

function ReceiptRow({ left, right, muted, strong }: {
  left: React.ReactNode; right: React.ReactNode; muted?: boolean; strong?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline',
      fontFamily: MONO, fontSize: strong ? 14 : 12.5,
      fontWeight: strong ? 700 : 400, color: muted ? C.ink3 : C.navy }}>
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{left}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  )
}

function Confirmation({ lines, guest, eventName, onDone }: {
  lines: CartLine[]; guest: string; eventName: string; onDone: () => void
}) {
  const subtotal = cartTotal(lines)
  const [tipPct, setTipPct] = useState<number>(20)
  const tipAmount = subtotal * (tipPct / 100)
  const dashed = `1px dashed ${C.rule}`

  return (
    <main style={{ minHeight: '100vh', background: C.peach, display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '40px 24px 48px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 999, background: C.green, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 32, color: C.card }}>✓</div>
      <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 28, color: C.navy, marginTop: 16 }}>
        Order placed!
      </h1>
      <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink2, marginTop: 8 }}>
        We&apos;re making it now ☕ — listen for your name.
      </p>

      {/* Receipt */}
      <div style={{ marginTop: 22, background: C.card, borderRadius: 6, padding: '22px 20px',
        boxShadow: '0 4px 16px rgba(30,58,95,0.12)', maxWidth: 340, width: '100%', textAlign: 'left' }}>
        <div style={{ textAlign: 'center', paddingBottom: 12, borderBottom: dashed }}>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, color: C.navy }}>
            Lazy Orchard Café
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.ink3, marginTop: 3 }}>
            {eventName.toUpperCase()}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.ink3, marginTop: 2 }}>
            {guest} · {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 0',
          borderBottom: dashed }}>
          {lines.map(l => (
            <ReceiptRow key={l.key}
              left={`${l.quantity}× ${l.label}`}
              right={l.unitPrice !== null ? `$${(l.unitPrice * l.quantity).toFixed(2)}` : '—'} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 0',
          borderBottom: dashed }}>
          <ReceiptRow left="Subtotal" right={`$${subtotal.toFixed(2)}`} />
          <ReceiptRow left={'Friends & family discount'} right={`-$${subtotal.toFixed(2)}`} muted />
        </div>

        <div style={{ padding: '12px 0 4px' }}>
          <ReceiptRow left="TOTAL" right="$0.00" strong />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.ink3, textAlign: 'center', marginTop: 10 }}>
          *** ON THE HOUSE — THANK YOU ***
        </div>
      </div>

      {/* Tip suggestions, calculated off the pre-discount subtotal */}
      <div style={{ marginTop: 24, maxWidth: 340, width: '100%' }}>
        <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink2, marginBottom: 10 }}>
          Tips help fund and support home cafe R&amp;D ☕
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {TIP_PCTS.map(p => {
            const on = p === tipPct
            return (
              <button key={p} onClick={() => setTipPct(p)} style={{
                flex: 1, padding: '10px 0', borderRadius: 14, cursor: 'pointer',
                border: `1.5px solid ${on ? C.navy : C.rule}`,
                background: on ? C.navy : C.card, color: on ? C.peach : C.navy,
                fontFamily: SANS, fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
                <div>{p}%</div>
                <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>
                  ${(subtotal * (p / 100)).toFixed(2)}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <TipCard amount={tipAmount} note={`Lazy Orchard Café — ${guest}`} />

      <button onClick={onDone} style={{ marginTop: 24, padding: '12px 28px', borderRadius: 999,
        background: 'transparent', color: C.midBlue, border: `1px solid ${C.rule}`, fontFamily: SANS,
        fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        Back to menu
      </button>
    </main>
  )
}

// ── Main view ───────────────────────────────────────────────────────────────
export function EventView({
  event, menuItems: initialItems, builderOptions: initialOptions, home = false,
}: {
  event: CafeEvent
  menuItems: MenuItemRow[]
  builderOptions: BuilderOption[]
  home?: boolean
}) {
  const [menuItems, setMenuItems] = useState(initialItems)
  const [builderOptions, setBuilderOptions] = useState(initialOptions)

  // Ordering flow state: configure an item → cart → checkout.
  const [draft, setDraft] = useState<OrderDraft | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [checkingOut, setCheckingOut] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState('')
  const [placed, setPlaced] = useState<{ lines: CartLine[]; guest: string } | null>(null)

  // Welcome popup: shown once per browser session, and only while ordering is
  // open. Deferred to an effect so the server and first client render match.
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  useEffect(() => {
    if (!event.is_active) return
    let seen = false
    try { seen = !!sessionStorage.getItem(WELCOME_SEEN_KEY) } catch {}
    if (seen) return
    // One frame late, so the menu paints behind the popup rather than after it.
    const id = requestAnimationFrame(() => setWelcomeOpen(true))
    return () => cancelAnimationFrame(id)
  }, [event.is_active])
  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false)
    try { sessionStorage.setItem(WELCOME_SEEN_KEY, '1') } catch {}
  }, [])

  const refetch = useCallback(async () => {
    const supa = getSupabase()
    const [mi, bo] = await Promise.all([
      supa.from('menu_items').select('*').eq('event_id', event.id)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supa.from('builder_options').select('*').eq('event_id', event.id)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    ])
    if (mi.data) setMenuItems(mi.data as MenuItemRow[])
    if (bo.data) setBuilderOptions(bo.data as BuilderOption[])
  }, [event.id])

  // Live updates for the active event: realtime + refetch on focus.
  useEffect(() => {
    if (!event.is_active) return
    const supa = getSupabase()
    const channel = supa
      .channel(`event-${event.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items', filter: `event_id=eq.${event.id}` }, refetch)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'builder_options', filter: `event_id=eq.${event.id}` }, refetch)
      .subscribe()

    const onFocus = () => { if (document.visibilityState !== 'hidden') refetch() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)

    return () => {
      supa.removeChannel(channel)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [event.id, event.is_active, refetch])

  const orderSpecialty = (item: MenuItemRow, quantity: number) => {
    setPlaceError('')
    setDraft({ type: 'specialty', name: item.name, temps: item.details?.tempOptions ?? [], quantity,
      addOnOptions: item.details?.addOns ?? [], unitPrice: item.details?.price ?? null })
  }
  const orderBuilder = (d: { base: string; milk: string | null; syrup: string | null; cream: string | null; modifier: string | null; quantity: number }) => {
    setPlaceError('')
    setDraft({ type: 'builder', ...d, unitPrice: BUILDER_PRICE })
  }

  // Turn the configured draft into a cart line.
  const addToCart = (temp: 'hot' | 'iced' | null, quantity: number, addOns: string[]) => {
    if (!draft) return
    let summary: EventOrderSummary
    let label: string
    if (draft.type === 'specialty') {
      summary = { name: draft.name, ...(temp ? { temp } : {}), ...(addOns.length ? { addOns } : {}) }
      label = `${draft.name}${temp ? ` (${temp})` : ''}`
        + (addOns.length ? ` + ${addOns.join(' + ')}` : '')
    } else {
      summary = {
        base: draft.base,
        ...(draft.milk ? { milk: draft.milk } : {}),
        ...(draft.syrup ? { syrup: draft.syrup } : {}),
        ...(draft.cream ? { cream: draft.cream } : {}),
        ...(draft.modifier ? { modifier: draft.modifier } : {}),
      }
      label = [draft.base, draft.milk, draft.syrup, draft.cream, draft.modifier].filter(Boolean).join(' + ')
    }
    setCart(prev => [...prev, {
      key: `${Date.now()}-${prev.length}`,
      type: draft.type, label, summary, quantity, unitPrice: draft.unitPrice,
    }])
    setDraft(null)
  }

  const changeQty = (key: string, quantity: number) =>
    setCart(prev => prev.map(l => l.key === key ? { ...l, quantity } : l))
  const removeLine = (key: string) =>
    setCart(prev => prev.filter(l => l.key !== key))

  // One row per cart line, inserted together.
  const placeOrder = async (guestName: string) => {
    if (!guestName || cart.length === 0) return
    setPlacing(true)
    setPlaceError('')

    const rows = cart.map(l => ({
      event_id: event.id,
      item_type: l.type,
      item_summary: { ...l.summary, ...(l.quantity > 1 ? { quantity: l.quantity } : {}) },
      label: l.quantity > 1 ? `${l.label} × ${l.quantity}` : l.label,
      guest_name: guestName,
    }))

    // anon INSERT only — no .select() (guests can't read the orders table).
    const { error } = await getSupabase().from('event_orders').insert(rows)
    setPlacing(false)
    if (error) { setPlaceError('Could not place your order. Please try again.'); return }
    setPlaced({ lines: cart, guest: guestName })
    setCart([])
    setCheckingOut(false)
  }

  if (placed) {
    return <Confirmation lines={placed.lines} guest={placed.guest} eventName={event.name}
      onDone={() => setPlaced(null)} />
  }

  const orderable = event.is_active
  const hasBuilder = builderOptions.length > 0
  const past = !event.is_active

  return (
    <main style={{ minHeight: '100vh', background: C.peach, paddingBottom: 8,
      display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '16px 18px 8px', maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <Link href="/events" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: SANS, fontSize: 13, color: C.midBlue, textDecoration: 'none' }}>
              {home ? 'Past events →' : '← All events'}
            </Link>
            {/* Password-gated — the link is public but the queue is not. */}
            <Link href="/orders" style={{ fontFamily: SANS, fontSize: 13, color: C.ink3, textDecoration: 'none' }}>
              Staff 🔒
            </Link>
          </div>
          <Link href="/wall" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.navy, background: C.card,
            borderRadius: 999, padding: '6px 14px', textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(30,58,95,0.1), inset 0 0 0 1px rgba(30,58,95,0.06)' }}>
            📸 Photo wall
          </Link>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 11, textTransform: 'uppercase',
          letterSpacing: 0.8, color: C.midBlue }}>
          {formatEventDate(event.date)}{past ? ' · Past event' : ' · Now serving'}
        </div>
        <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 30, letterSpacing: -0.4,
          color: C.navy, marginTop: 4 }}>{event.name}</h1>
        {event.description && (
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink2, marginTop: 6, lineHeight: 1.4 }}>
            {event.description}
          </p>
        )}
        {past && (
          <div style={{ marginTop: 12, fontFamily: SANS, fontSize: 12, color: C.ink3,
            background: C.card, borderRadius: 999, padding: '6px 12px', display: 'inline-block',
            boxShadow: `inset 0 0 0 1px ${C.rule}` }}>
            📖 Archived menu — a record of what was served, not an ordering page.
          </div>
        )}
      </header>

      {/* Body */}
      <div style={{ padding: '20px 18px 0', maxWidth: 640, margin: '0 auto', width: '100%', flex: 1,
        display: 'flex', flexDirection: 'column', gap: 36 }}>
        {menuItems.length > 0 ? (
          <Specialties items={menuItems} orderable={orderable} onOrder={orderSpecialty} />
        ) : (
          <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink3, textAlign: 'center', padding: '48px 0' }}>
            No menu was recorded for this event.
          </p>
        )}
        {hasBuilder && <BuildYourOwn options={builderOptions} orderable={orderable} onOrder={orderBuilder} />}
        {event.slug === 'vol-4' && <BananaBreadDrop orderable={orderable} />}
      </div>

      {/* Footer — subtle tip link + photo wall */}
      <footer style={{ marginTop: 32, padding: '20px 18px 28px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={venmoProfileUrl()} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: SANS, fontSize: 13, color: C.venmo, textDecoration: 'none' }}>
            Leave a tip on Venmo ☕
          </a>
          <Link href="/wall" style={{ fontFamily: SANS, fontSize: 13, color: C.midBlue, textDecoration: 'none' }}>
            Photo wall 📸
          </Link>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 13, color: C.ink3, marginTop: 10 }}>
          Lazy Orchard Café
        </div>
      </footer>

      {welcomeOpen && (
        <WelcomeModal onClose={closeWelcome} showLoafLink={event.slug === 'vol-4'}
          cafeLabel={cafeVersionLabel(event.slug)} />
      )}

      {orderable && cart.length > 0 && (
        <CartBar lines={cart} onReview={() => { setPlaceError(''); setCheckingOut(true) }} />
      )}

      {draft && (
        <ItemModal draft={draft} onClose={() => setDraft(null)} onAdd={addToCart} />
      )}

      {checkingOut && (
        <CheckoutModal lines={cart} onClose={() => setCheckingOut(false)}
          onChangeQty={changeQty} onRemove={removeLine} onPlace={placeOrder}
          placing={placing} error={placeError} />
      )}
    </main>
  )
}
