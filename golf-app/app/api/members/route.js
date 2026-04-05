import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const members = db.prepare(`
    SELECT
      u.id, u.name, u.role, u.handicap, u.ghin_number, u.avatar_url, u.bio,
      COUNT(DISTINCT er.event_id) AS events_played,
      SUM(er.points) AS total_points,
      COUNT(CASE WHEN er.position = 1 THEN 1 END) AS wins,
      (SELECT COUNT(*) FROM trophies WHERE winner_id = u.id) AS trophy_count
    FROM users u
    LEFT JOIN event_results er ON er.user_id = u.id
    GROUP BY u.id
    ORDER BY total_points DESC
  `).all();

  return NextResponse.json({ members });
}
