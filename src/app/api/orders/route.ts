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

    if (!customer_name?.trim() || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    // Rate limit: reject if same name placed an order in the last 10 minutes
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count: recentCount } = await getSupabase()
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .ilike('customer_name', customer_name.trim())
      .gte('created_at', tenMinsAgo)

    if ((recentCount ?? 0) > 0) {
      return Response.json(
        { error: 'An order with this name was placed recently. Check your ticket number or ask a staff member.' },
        { status: 429 }
      )
    }

    // Generate sequential ticket code from highest existing code
    let ticket_code: string
    if (providedCode) {
      ticket_code = providedCode
    } else {
      const { data: latest } = await getSupabase()
        .from('orders')
        .select('ticket_code')
        .order('ticket_code', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextCode = latest?.ticket_code != null ? parseInt(latest.ticket_code, 10) + 1 : 0
      ticket_code = String(nextCode).padStart(4, '0')
    }

    const { data, error } = await getSupabase()
      .from('orders')
      .insert([{ customer_name: customer_name.trim(), items, total, note: note || null, status: 'pending', ticket_code }])
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data, { status: 201 })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
