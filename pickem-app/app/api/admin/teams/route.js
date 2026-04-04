import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function POST(request) {
  const body = await request.json();
  const { tournament_id, team_name, owner_name, payment_status = 'unpaid', picks = [] } = body;

  if (!tournament_id || !team_name || !owner_name) {
    return NextResponse.json({ error: 'tournament_id, team_name, owner_name required' }, { status: 400 });
  }

  const db = getDb();
  const teamId = db
    .prepare('INSERT INTO teams (tournament_id, team_name, owner_name, payment_status) VALUES (?, ?, ?, ?)')
    .run(tournament_id, team_name, owner_name, payment_status).lastInsertRowid;

  const insertPick = db.prepare('INSERT INTO picks (team_id, tournament_id, tier_number, player_name) VALUES (?, ?, ?, ?)');
  for (const pick of picks) {
    insertPick.run(teamId, tournament_id, pick.tier_number, pick.player_name);
  }

  return NextResponse.json({ id: teamId }, { status: 201 });
}

export async function PATCH(request) {
  const body = await request.json();
  const { id, payment_status, team_name, owner_name } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getDb();
  db.prepare(
    'UPDATE teams SET payment_status=COALESCE(?,payment_status), team_name=COALESCE(?,team_name), owner_name=COALESCE(?,owner_name) WHERE id=?'
  ).run(payment_status, team_name, owner_name, id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getDb();
  db.prepare('DELETE FROM teams WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}
