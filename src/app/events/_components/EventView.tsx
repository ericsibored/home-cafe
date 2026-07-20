'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { getSupabase } from '@/lib/supabase'
import { venmoProfileUrl, venmoPayDeepLink, VENMO_HANDLE } from '@/lib/venmo'
import { C, SERIF, SANS } from '@/lib/theme'
import type {
  CafeEvent, MenuItemRow, BuilderOption, BuilderCategory, EventOrderSummary,
} from '@/types'

function formatEventDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

// The in-progress order the guest is about to place.
type OrderDraft =
  | { type: 'specialty'; name: string; temps: ('hot' | 'iced')[]; quantity: number }
  | { type: 'builder'; base: string; milk: string | null; syrup: string | null; cream: string | null; modifier: string | null; quantity: number }

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
  const hasAllergens = !!d.allergens && d.allergens.length > 0
  return (
    <div style={{ background: C.card, borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(30,58,95,0.09)', display: 'flex', flexDirection: 'column',
      opacity: soldOut ? 0.6 : 1, position: 'relative' }}>
      {d.image ? (
        <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', flexShrink: 0,
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
        <div style={{ width: '100%', height: 100, background: C.peach, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 48, flexShrink: 0,
          filter: soldOut ? 'grayscale(0.7)' : undefined }}>
          {d.emoji ?? '☕'}
        </div>
      )}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
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
        {(item.ingredients?.length || d.allergens) && (
          <div style={{ marginTop: 2, paddingTop: 10, borderTop: `1px solid ${C.ruleSoft}`,
            display: 'flex', flexDirection: 'column', gap: 6 }}>
            {item.ingredients && item.ingredients.length > 0 && (
              <div style={{ display: 'flex', gap: 8, fontFamily: SANS, fontSize: 11.5, color: C.ink2 }}>
                <span>🌿</span><span>Ingredients: {item.ingredients.join(', ')}</span>
              </div>
            )}
            {d.allergens && (
              <div style={{ display: 'flex', gap: 8, fontFamily: SANS, fontSize: 11.5,
                color: hasAllergens ? C.ink2 : C.green }}>
                <span>{hasAllergens ? '⚠️' : '✅'}</span>
                <span>{hasAllergens ? `Allergens: ${d.allergens.join(', ')}` : 'No common allergens'}</span>
              </div>
            )}
          </div>
        )}
        {orderable && !soldOut && (
          <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', alignItems: 'center',
            gap: 8, flexWrap: 'wrap' }}>
            <QtyStepper qty={qty} onChange={setQty} min={0} size={32} />
            <button onClick={qty > 0 ? () => onOrder(item, qty) : undefined} disabled={qty === 0} style={{
              flex: 1, minWidth: 84, fontFamily: SANS, fontSize: 13, fontWeight: 700, padding: '9px 14px',
              borderRadius: 999, background: C.navy, color: C.peach, border: 'none',
              cursor: qty === 0 ? 'not-allowed' : 'pointer', opacity: qty === 0 ? 0.45 : 1,
              boxShadow: qty === 0 ? 'none' : '0 2px 8px rgba(30,58,95,0.2)' }}>
              Order
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
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

function BuildYourOwn({ options, orderable, onOrder }: {
  options: BuilderOption[]
  orderable: boolean
  onOrder: (draft: { base: string; milk: string | null; syrup: string | null; cream: string | null; modifier: string | null; quantity: number }) => void
}) {
  const byCat = (cat: BuilderCategory) => options.filter(o => o.category === cat)
  const bases = byCat('base')
  const milks = byCat('milk')
  const syrups = byCat('syrup')
  const creams = byCat('cream')
  const modifiers = byCat('modifier')

  const [base, setBase] = useState<string | null>(null)
  const [milk, setMilk] = useState<string | null>(null)
  const [syrup, setSyrup] = useState<string | null>(null)
  const [cream, setCream] = useState<string | null>(null)
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
    { label: 'Cream top', hint: 'optional', opts: creams, sel: cream, set: setCream, optional: true },
    { label: 'Modifier', hint: 'optional', opts: modifiers, sel: modifier, set: setModifier, optional: true },
  ].filter(s => s.opts.length > 0)

  // Base is required; milk too when offered. Syrup / cream / modifier are optional.
  const complete = !!base && (milks.length === 0 || !!milk)
  // Ordering also needs a quantity of at least one.
  const canOrder = complete && qty > 0

  const parts = [base, milk, syrup, cream, modifier].filter(Boolean)

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
          </div>
          {orderable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <QtyStepper qty={qty} onChange={setQty} min={0} />
              <button
                onClick={canOrder ? () => onOrder({ base: base!, milk, syrup, cream, modifier, quantity: qty }) : undefined}
                disabled={!canOrder}
                style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, padding: '10px 18px',
                  borderRadius: 999, background: C.navy, color: C.peach, border: 'none', flexShrink: 0,
                  cursor: canOrder ? 'pointer' : 'not-allowed', opacity: canOrder ? 1 : 0.45,
                  boxShadow: canOrder ? '0 2px 8px rgba(30,58,95,0.2)' : 'none' }}>
                Order this drink
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Order modal ─────────────────────────────────────────────────────────────
function OrderModal({ draft, onClose, onPlace, placing, error }: {
  draft: OrderDraft
  onClose: () => void
  onPlace: (guestName: string, temp: 'hot' | 'iced' | null, quantity: number) => void
  placing: boolean
  error: string
}) {
  const [name, setName] = useState('')
  const [qty, setQty] = useState(draft.quantity)
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
          color: C.midBlue }}>Order</div>
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

        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.midBlue, marginBottom: 6 }}>
            Quantity
          </div>
          <QtyStepper qty={qty} onChange={setQty} />
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: C.midBlue,
            display: 'block', marginBottom: 6 }}>Your name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Sam"
            onKeyDown={e => { if (e.key === 'Enter' && name.trim() && !placing) onPlace(name.trim(), multiTemp ? temp : (draft.type === 'specialty' ? (draft.temps[0] ?? null) : null), qty) }}
            style={{ width: '100%', boxSizing: 'border-box', fontFamily: SANS, fontSize: 15,
              padding: '11px 14px', borderRadius: 12, border: `1px solid ${C.rule}`, outline: 'none' }} />
        </div>

        {error && <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.red, marginTop: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 999,
            border: `1px solid ${C.rule}`, background: 'transparent', fontFamily: SANS, fontSize: 14,
            fontWeight: 600, color: C.midBlue, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => onPlace(name.trim(), multiTemp ? temp : (draft.type === 'specialty' ? (draft.temps[0] ?? null) : null), qty)}
            disabled={!name.trim() || placing}
            style={{ flex: 2, padding: '12px 0', borderRadius: 999, border: 'none',
              background: C.navy, color: C.peach, fontFamily: SANS, fontSize: 14, fontWeight: 700,
              cursor: !name.trim() || placing ? 'not-allowed' : 'pointer',
              opacity: !name.trim() || placing ? 0.5 : 1 }}>
            {placing ? 'Placing…' : 'Place order'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tip card (prominent, on the confirmation screen) ────────────────────────
function TipCard() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => { setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) }, [])

  // Mobile → open the Venmo app pay screen; desktop → web profile fallback.
  const buttonHref = isMobile ? venmoPayDeepLink() : venmoProfileUrl()
  const anchorProps = isMobile ? {} : { target: '_blank', rel: 'noopener noreferrer' }

  return (
    <div style={{ marginTop: 24, background: C.card, borderRadius: 22, padding: '22px 20px',
      boxShadow: '0 6px 20px rgba(30,58,95,0.12)', maxWidth: 380, width: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, color: C.navy, textAlign: 'center' }}>
        Tips fund the next syrup experiment ☕
      </div>
      <a href={buttonHref} {...anchorProps} style={{ display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
        padding: '15px 22px', borderRadius: 999, background: C.venmo, color: '#ffffff',
        fontFamily: SANS, fontWeight: 700, fontSize: 16, textDecoration: 'none',
        boxShadow: '0 4px 14px rgba(61,149,206,0.35)' }}>
        Tip on <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 20 }}>venmo</span>
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

// ── Confirmation screen ─────────────────────────────────────────────────────
function Confirmation({ label, guest, onDone }: { label: string; guest: string; onDone: () => void }) {
  return (
    <main style={{ minHeight: '100vh', background: C.peach, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 999, background: C.green, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 32, color: C.card }}>✓</div>
      <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 28, color: C.navy, marginTop: 16 }}>
        Order placed!
      </h1>
      <div style={{ marginTop: 16, background: C.card, borderRadius: 18, padding: '18px 22px',
        boxShadow: '0 2px 12px rgba(30,58,95,0.09)', maxWidth: 380, width: '100%' }}>
        <div style={{ fontFamily: SANS, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
          color: C.midBlue }}>Your drink</div>
        <div style={{ fontFamily: SERIF, fontSize: 19, color: C.navy, marginTop: 4 }}>{label}</div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: C.ink2, marginTop: 8 }}>for {guest}</div>
      </div>
      <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink2, marginTop: 18 }}>
        We&apos;re making it now ☕ — listen for your name.
      </p>

      {/* Prominent tip card */}
      <TipCard />

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

  // Ordering flow state
  const [draft, setDraft] = useState<OrderDraft | null>(null)
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState('')
  const [placed, setPlaced] = useState<{ label: string; guest: string } | null>(null)

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
    setDraft({ type: 'specialty', name: item.name, temps: item.details?.tempOptions ?? [], quantity })
  }
  const orderBuilder = (d: { base: string; milk: string | null; syrup: string | null; cream: string | null; modifier: string | null; quantity: number }) => {
    setPlaceError('')
    setDraft({ type: 'builder', ...d })
  }

  const placeOrder = async (guestName: string, temp: 'hot' | 'iced' | null, quantity: number) => {
    if (!draft || !guestName) return
    setPlacing(true)
    setPlaceError('')

    let item_summary: EventOrderSummary
    let label: string
    if (draft.type === 'specialty') {
      item_summary = { name: draft.name, ...(temp ? { temp } : {}) }
      label = `${draft.name}${temp ? ` (${temp})` : ''}`
    } else {
      item_summary = {
        base: draft.base,
        ...(draft.milk ? { milk: draft.milk } : {}),
        ...(draft.syrup ? { syrup: draft.syrup } : {}),
        ...(draft.cream ? { cream: draft.cream } : {}),
        ...(draft.modifier ? { modifier: draft.modifier } : {}),
      }
      label = [draft.base, draft.milk, draft.syrup, draft.cream, draft.modifier].filter(Boolean).join(' + ')
    }
    if (quantity > 1) {
      item_summary.quantity = quantity
      label = `${label} × ${quantity}`
    }

    // anon INSERT only — no .select() (guests can't read the orders table).
    const { error } = await getSupabase().from('event_orders').insert({
      event_id: event.id,
      item_type: draft.type,
      item_summary,
      label,
      guest_name: guestName,
    })
    setPlacing(false)
    if (error) { setPlaceError('Could not place your order. Please try again.'); return }
    setDraft(null)
    setPlaced({ label, guest: guestName })
  }

  if (placed) {
    return <Confirmation label={placed.label} guest={placed.guest} onDone={() => setPlaced(null)} />
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

      {draft && (
        <OrderModal draft={draft} onClose={() => setDraft(null)} onPlace={placeOrder}
          placing={placing} error={placeError} />
      )}
    </main>
  )
}
