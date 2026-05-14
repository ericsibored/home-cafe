import { getSupabase } from '@/lib/supabase-server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    // Ticket lookup: GET /api/orders?code=XXXX
    if (code) {
      const { data, error } = await getSupabase()
        .from('orders')
        .select('*')
        .eq('ticket_code', code)
        .single()

      if (error || !data) return Response.json({ error: 'Order not found' }, { status: 404 })
      return Response.json(data)
    }

    // Staff view: return all orders
    const { data, error } = await getSupabase()
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data)
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customer_name, items, total, note, ticketCode: providedCode } = body

    // Generate a random 4-digit code if not provided
    const ticket_code = providedCode ?? Math.floor(1000 + Math.random() * 9000).toString()

    const { data, error } = await getSupabase()
      .from('orders')
      .insert([{ customer_name, items, total, note: note || null, status: 'pending', ticket_code }])
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data, { status: 201 })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
