/**
 * Beli-style community rankings API
 *
 * Supabase table required:
 *
 * CREATE TABLE beli_rankings (
 *   id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   player_name  text NOT NULL,
 *   item_id      text NOT NULL,
 *   score        float NOT NULL,          -- 0.0 to 10.0 (wins/appearances * 10)
 *   wins         int  NOT NULL DEFAULT 0,
 *   appearances  int  NOT NULL DEFAULT 0,
 *   created_at   timestamptz DEFAULT now()
 * );
 */

import { getSupabase } from '@/lib/supabase-server'

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('beli_rankings')
      .select('item_id, score, player_name, created_at')
      .order('created_at', { ascending: false })

    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Aggregate: per item — average score, count of raters, list of player names
    const agg: Record<string, { total: number; count: number; players: string[] }> = {}
    for (const row of data ?? []) {
      if (!agg[row.item_id]) agg[row.item_id] = { total: 0, count: 0, players: [] }
      agg[row.item_id].total += row.score
      agg[row.item_id].count += 1
      if (!agg[row.item_id].players.includes(row.player_name)) {
        agg[row.item_id].players.push(row.player_name)
      }
    }

    const result = Object.entries(agg).map(([item_id, { total, count, players }]) => ({
      item_id,
      avg_score: Math.round((total / count) * 10) / 10,
      submission_count: count,
      players,
    }))

    return Response.json(result)
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { player_name, scores } = await request.json()

    if (!player_name?.trim()) {
      return Response.json({ error: 'Name required' }, { status: 400 })
    }
    if (!Array.isArray(scores) || scores.length === 0) {
      return Response.json({ error: 'Scores required' }, { status: 400 })
    }

    const rows = scores.map((s: { item_id: string; score: number; wins: number; appearances: number }) => ({
      player_name: player_name.trim(),
      item_id: s.item_id,
      score: Number(s.score),
      wins: Number(s.wins),
      appearances: Number(s.appearances),
    }))

    const { error } = await getSupabase()
      .from('beli_rankings')
      .insert(rows)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true }, { status: 201 })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
