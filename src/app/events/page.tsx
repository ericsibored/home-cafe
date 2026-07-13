import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllEvents } from '@/lib/events'
import { C, SERIF, SANS } from '@/lib/theme'

// Reflects live DB state (active flags, newly archived events) on each request.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Past events · Lazy Orchard Café',
  description: 'A record of past Lazy Orchard Café pop-ups and their menus.',
}

function formatEventDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

export default async function EventsArchivePage() {
  const events = await getAllEvents()

  return (
    <main style={{ minHeight: '100vh', background: C.peach, paddingBottom: 40 }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 18px 0' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: SANS, fontSize: 13, color: C.midBlue, textDecoration: 'none', marginBottom: 16 }}>
          ← Home
        </Link>
        <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 30, letterSpacing: -0.4,
          color: C.navy }}>Past events</h1>
        <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink2, marginTop: 6 }}>
          A little archive of Lazy Orchard Café pop-ups.
        </p>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.length === 0 ? (
            <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink3, textAlign: 'center', padding: '48px 0' }}>
              No events archived yet.
            </p>
          ) : (
            events.map(event => {
              const itemCount = event.menu_snapshot?.items?.length ?? 0
              return (
                <Link key={event.id} href={`/events/${event.slug}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: C.card, borderRadius: 18, padding: '18px 20px',
                    boxShadow: '0 2px 12px rgba(30,58,95,0.08)', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 18, color: C.navy }}>
                          {event.name}
                        </span>
                        {event.is_active && (
                          <span style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: 0.5, color: C.green,
                            background: 'rgba(62,155,107,0.12)', borderRadius: 999, padding: '2px 8px' }}>
                            Active
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.midBlue, marginTop: 3 }}>
                        {formatEventDate(event.date)}
                        {itemCount > 0 && ` · ${itemCount} item${itemCount === 1 ? '' : 's'}`}
                      </div>
                      {event.description && (
                        <div style={{ fontFamily: SANS, fontSize: 12.5, color: C.ink3, marginTop: 4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {event.description}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 20, color: C.midBlue, flexShrink: 0 }}>→</span>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}
