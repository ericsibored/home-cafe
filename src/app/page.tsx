import Link from 'next/link'
import { getActiveEvent, getMenuItems, getBuilderOptions } from '@/lib/events'
import { EventView } from './events/_components/EventView'
import { C, SERIF, SANS } from '@/lib/theme'

// Homepage shows the active event (is_active = true, else most recent by date).
// Rendered per-request so it always reflects the current active event & live state.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const event = await getActiveEvent()

  if (!event) {
    return (
      <main style={{ minHeight: '100vh', background: C.peach, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <h1 style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 30, color: C.navy }}>
          Lazy Orchard Café
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 14, color: C.ink2 }}>
          No event is live right now — check back soon.
        </p>
        <Link href="/events" style={{ fontFamily: SANS, fontSize: 13, color: C.midBlue }}>
          Browse past events →
        </Link>
      </main>
    )
  }

  const [menuItems, builderOptions] = await Promise.all([
    getMenuItems(event.id),
    getBuilderOptions(event.id),
  ])

  return <EventView event={event} menuItems={menuItems} builderOptions={builderOptions} home />
}
