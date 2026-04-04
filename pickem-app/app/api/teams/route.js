import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');
  const teamId = searchParams.get('teamId');

  const db = getDb();

  if (teamId) {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    const picks = db.prepare('SELECT * FROM picks WHERE team_id = ? ORDER BY tier_number').all(teamId);
    return NextResponse.json({ team, picks });
  }

  if (!tournamentId) return NextResponse.json({ error: 'tournamentId required' }, { status: 400 });
  const teams = db.prepare('SELECT * FROM teams WHERE tournament_id = ? ORDER BY team_name').all(tournamentId);
  return NextResponse.json({ teams });
}
