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

    // Name lookup: GET /api/orders?name=Eric
    const name = searchParams.get('name')
    if (name) {
      const { data, error } = await getSupabase()
        .from('orders')
        .select('ticket_code, customer_name, created_at, items')
        .ilike('customer_name', `%${name.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json(data ?? [])
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

    // Generate sequential 4-digit ticket code (0000, 0001, 0002, ...)
    let ticket_code: string
    if (providedCode) {
      ticket_code = providedCode
    } else {
      const { count } = await getSupabase()
        .from('orders')
        .select('*', { count: 'exact', head: true })
      ticket_code = String(count ?? 0).padStart(4, '0')
    }

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
