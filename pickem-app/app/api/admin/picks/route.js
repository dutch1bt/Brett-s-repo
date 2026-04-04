import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('teamId');
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

  const db = getDb();
  const picks = db.prepare('SELECT * FROM picks WHERE team_id = ? ORDER BY tier_number').all(teamId);
  return NextResponse.json({ picks });
}

export async function PUT(request) {
  // Replace all picks for a team
  const body = await request.json();
  const { team_id, tournament_id, picks = [] } = body;

  if (!team_id || !tournament_id) {
    return NextResponse.json({ error: 'team_id and tournament_id required' }, { status: 400 });
  }

  const db = getDb();
  db.prepare('DELETE FROM picks WHERE team_id = ?').run(team_id);

  const insertPick = db.prepare('INSERT INTO picks (team_id, tournament_id, tier_number, player_name) VALUES (?, ?, ?, ?)');
  for (const pick of picks) {
    insertPick.run(team_id, tournament_id, pick.tier_number, pick.player_name);
  }

  return NextResponse.json({ ok: true });
}
