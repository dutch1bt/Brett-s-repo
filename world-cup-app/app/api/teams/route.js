import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = getDb();
    const teams = db.prepare(`
      SELECT id, name, flag, confederation, price, group_wins, knockout_wins, eliminated, stage_order,
             (group_wins * 1 + knockout_wins * 2) AS score
      FROM teams
      WHERE active = 1
      ORDER BY price DESC, name ASC
    `).all();

    return NextResponse.json({ teams });
  } catch (err) {
    console.error('Teams error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
