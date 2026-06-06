import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { teamId, winType } = await request.json();

    if (!teamId || !['group', 'knockout'].includes(winType)) {
      return NextResponse.json({ error: 'Invalid teamId or winType' }, { status: 400 });
    }

    const db = getDb();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const points = winType === 'group' ? 1 : 2;

    db.exec('BEGIN TRANSACTION');
    try {
      if (winType === 'group') {
        db.prepare('UPDATE teams SET group_wins = group_wins + 1 WHERE id = ?').run(teamId);
      } else {
        db.prepare('UPDATE teams SET knockout_wins = knockout_wins + 1 WHERE id = ?').run(teamId);
      }

      db.prepare(
        'INSERT INTO match_log (team_id, win_type, points_awarded) VALUES (?, ?, ?)'
      ).run(teamId, winType, points);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const updatedTeam = db.prepare(`
      SELECT id, name, flag, confederation, price, group_wins, knockout_wins, eliminated, stage_order,
             (group_wins * 1 + knockout_wins * 2) AS score
      FROM teams WHERE id = ?
    `).get(teamId);

    return NextResponse.json({ success: true, team: updatedTeam });
  } catch (err) {
    console.error('Admin results POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = getDb();
    const logs = db.prepare(`
      SELECT ml.id, ml.win_type, ml.points_awarded, ml.logged_at,
             t.id AS team_id, t.name AS team_name, t.flag AS team_flag
      FROM match_log ml
      JOIN teams t ON t.id = ml.team_id
      ORDER BY ml.logged_at DESC
      LIMIT 50
    `).all();

    return NextResponse.json({ logs });
  } catch (err) {
    console.error('Admin results GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
