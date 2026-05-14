import { getSupabase } from '@/lib/supabase-server'

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('reviews')
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
    const { reviewer_name, rating, comment, ticket_code, item_id } = await request.json()

    if (!reviewer_name?.trim()) {
      return Response.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!rating || rating < 1 || rating > 5) {
      return Response.json({ error: 'Rating must be 1–5' }, { status: 400 })
    }

    const { data, error } = await getSupabase()
      .from('reviews')
      .insert([{
        reviewer_name: reviewer_name.trim(),
        rating: Number(rating),
        comment: comment?.trim() || null,
        ticket_code: ticket_code || null,
        item_id: item_id || null,
      }])
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json(data, { status: 201 })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
