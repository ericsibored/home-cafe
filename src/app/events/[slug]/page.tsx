import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getEventBySlug, getMenuItems, getBuilderOptions } from '@/lib/events'
import { EventView } from '../_components/EventView'

// Rendered per-request so archived-menu edits / sold-out toggles show without a redeploy.
export const dynamic = 'force-dynamic'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) return { title: 'Event not found · Lazy Orchard Café' }
  return {
    title: `${event.name} · Lazy Orchard Café`,
    description: event.description ?? undefined,
  }
}

export default async function EventPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) notFound()

  const [menuItems, builderOptions] = await Promise.all([
    getMenuItems(event.id),
    getBuilderOptions(event.id),
  ])

  return <EventView event={event} menuItems={menuItems} builderOptions={builderOptions} />
}
