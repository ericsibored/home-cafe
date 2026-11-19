import { getSupabase } from '@/lib/supabase-server'

/** Site-wide cap on new photo-wall entries per rolling hour. */
const UPLOADS_PER_HOUR = 100

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('collage_entries')
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
    const { photoBase64, note, guestName, eventId } = await request.json()

    if (!guestName?.trim()) {
      return Response.json({ error: 'Guest name is required' }, { status: 400 })
    }
    if (!photoBase64) {
      return Response.json({ error: 'Photo is required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Rate limit: the wall is open to anyone who can reach the site, and this
    // route uploads whatever base64 it is handed. Cap new entries site-wide so
    // a bad actor (or a loop) cannot fill the storage bucket. Counted from the
    // table rather than memory, so the cap holds across serverless instances.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await supabase
      .from('collage_entries')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)

    if (countError) {
      return Response.json({ error: countError.message }, { status: 500 })
    }
    if ((count ?? 0) >= UPLOADS_PER_HOUR) {
      return Response.json(
        { error: 'The photo wall is busy right now — please try again in a little while.' },
        { status: 429, headers: { 'Retry-After': '600' } },
      )
    }

    // Strip the data URL prefix and decode base64 → Buffer
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('collage-photos')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      return Response.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('collage-photos')
      .getPublicUrl(fileName)

    const photoUrl = urlData.publicUrl

    // Insert row into collage_entries
    const { data, error: insertError } = await supabase
      .from('collage_entries')
      .insert([{
        photo_url: photoUrl,
        note: note?.trim() || null,
        guest_name: guestName.trim(),
        event_id: eventId ?? null,
      }])
      .select()
      .single()

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 })
    }

    return Response.json(data, { status: 201 })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
