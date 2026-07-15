import { getSupabase } from '@/lib/supabase-server'
import { isStaff } from '@/lib/staff'

// Staff-only (password-gated) access to event_orders via the service role,
// so the order queue works behind a simple password without making orders
// readable by anon clients.

async function activeEvent() {
  const supa = getSupabase()
  const { data: active } = await supa.from('events')
    .select('id, name, date, is_active').eq('is_active', true).maybeSingle()
  if (active) return active
  const { data: latest } = await supa.from('events')
    .select('id, name, date, is_active').order('date', { ascending: false }).limit(1).maybeSingle()
  return latest ?? null
}

export async function GET(req: Request) {
  if (!isStaff(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const ev = await activeEvent()
    if (!ev) return Response.json({ event: null, orders: [] })
    const { data, error } = await getSupabase().from('event_orders')
      .select('*').eq('event_id', ev.id).order('created_at', { ascending: false })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ event: ev, orders: data ?? [] })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  if (!isStaff(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id, status } = await req.json()
    if (!id || (status !== 'pending' && status !== 'made')) {
      return Response.json({ error: 'Bad request' }, { status: 400 })
    }
    const { error } = await getSupabase().from('event_orders').update({ status }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
