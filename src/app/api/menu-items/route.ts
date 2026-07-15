import { getSupabase } from '@/lib/supabase-server'
import { isStaff } from '@/lib/staff'

// Staff-only toggle of a menu item's sold_out flag.
export async function PATCH(req: Request) {
  if (!isStaff(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id, sold_out } = await req.json()
    if (!id || typeof sold_out !== 'boolean') {
      return Response.json({ error: 'Bad request' }, { status: 400 })
    }
    const { error } = await getSupabase().from('menu_items').update({ sold_out }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
