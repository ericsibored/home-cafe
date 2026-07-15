import { getSupabase } from '@/lib/supabase-server'
import { isStaff } from '@/lib/staff'

// Staff-only toggle of a builder option's availability.
export async function PATCH(req: Request) {
  if (!isStaff(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id, available } = await req.json()
    if (!id || typeof available !== 'boolean') {
      return Response.json({ error: 'Bad request' }, { status: 400 })
    }
    const { error } = await getSupabase().from('builder_options').update({ available }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
