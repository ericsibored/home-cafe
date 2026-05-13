import { supabase } from '@/lib/supabase'

export async function PATCH(req: Request, ctx: RouteContext<'/api/orders/[id]'>) {
  const { id } = await ctx.params
  const { status } = await req.json()

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
