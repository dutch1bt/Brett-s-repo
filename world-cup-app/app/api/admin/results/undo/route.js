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

    const { logId } = await request.json();

    if (!logId) {
      return NextResponse.json({ error: 'logId is required' }, { status: 400 });
    }

    const db = getDb();
    const log = db.prepare('SELECT * FROM match_log WHERE id = ?').get(logId);
    if (!log) {
      return NextResponse.json({ error: 'Log entry not found' }, { status: 404 });
    }

    db.exec('BEGIN TRANSACTION');
    try {
      if (log.win_type === 'group') {
        db.prepare('UPDATE teams SET group_wins = MAX(0, group_wins - 1) WHERE id = ?').run(log.team_id);
      } else {
        db.prepare('UPDATE teams SET knockout_wins = MAX(0, knockout_wins - 1) WHERE id = ?').run(log.team_id);
      }

      db.prepare('DELETE FROM match_log WHERE id = ?').run(logId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin results undo error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
