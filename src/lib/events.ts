import { getSupabase } from '@/lib/supabase-server'
import type { CafeEvent, MenuItemRow, BuilderOption } from '@/types'

// Server-side data access for events. Uses the server Supabase client
// (service role when available), so these must only run on the server.

const EVENT_COLUMNS = 'id, slug, name, date, description, is_active, menu_snapshot, created_at'

/** All events, newest first — used by the archive index. */
export async function getAllEvents(): Promise<CafeEvent[]> {
  const { data, error } = await getSupabase()
    .from('events')
    .select(EVENT_COLUMNS)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to load events: ${error.message}`)
  return (data ?? []) as CafeEvent[]
}

/** A single event by its URL slug, or null if not found. */
export async function getEventBySlug(slug: string): Promise<CafeEvent | null> {
  const { data, error } = await getSupabase()
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(`Failed to load event "${slug}": ${error.message}`)
  return (data as CafeEvent | null) ?? null
}

/**
 * The active event: is_active = true, else the most recent by date.
 * (Homepage uses this in a later phase; exported here so the data layer
 * has a single source of truth.)
 */
export async function getActiveEvent(): Promise<CafeEvent | null> {
  const { data: active, error: activeErr } = await getSupabase()
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('is_active', true)
    .maybeSingle()

  if (activeErr) throw new Error(`Failed to load active event: ${activeErr.message}`)
  if (active) return active as CafeEvent

  const { data: latest, error: latestErr } = await getSupabase()
    .from('events')
    .select(EVENT_COLUMNS)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestErr) throw new Error(`Failed to load latest event: ${latestErr.message}`)
  return (latest as CafeEvent | null) ?? null
}

/** The "Specialties" menu items for an event, in display order. */
export async function getMenuItems(eventId: string): Promise<MenuItemRow[]> {
  const { data, error } = await getSupabase()
    .from('menu_items')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to load menu items: ${error.message}`)
  return (data ?? []) as MenuItemRow[]
}

/** The "Build Your Own" options for an event, in display order. */
export async function getBuilderOptions(eventId: string): Promise<BuilderOption[]> {
  const { data, error } = await getSupabase()
    .from('builder_options')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to load builder options: ${error.message}`)
  return (data ?? []) as BuilderOption[]
}
