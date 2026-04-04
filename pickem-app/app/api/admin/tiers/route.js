import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json({ error: 'tournamentId required' }, { status: 400 });

  const db = getDb();
  const tiers = db.prepare('SELECT * FROM tiers WHERE tournament_id = ? ORDER BY tier_number, player_name').all(tournamentId);
  return NextResponse.json({ tiers });
}

export async function PUT(request) {
  // Replace all tiers for a tournament
  const body = await request.json();
  const { tournament_id, tiers = [] } = body;

  if (!tournament_id) return NextResponse.json({ error: 'tournament_id required' }, { status: 400 });

  const db = getDb();
  db.prepare('DELETE FROM tiers WHERE tournament_id = ?').run(tournament_id);

  const insert = db.prepare('INSERT INTO tiers (tournament_id, tier_number, player_name) VALUES (?, ?, ?)');
  for (const t of tiers) {
    insert.run(tournament_id, t.tier_number, t.player_name);
  }

  return NextResponse.json({ ok: true });
}
