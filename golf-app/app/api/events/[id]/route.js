import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(parseInt(params.id));
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const results = db.prepare(`
    SELECT er.*, u.name AS user_name, u.handicap, u.avatar_url
    FROM event_results er
    JOIN users u ON u.id = er.user_id
    WHERE er.event_id = ?
    ORDER BY er.position ASC
  `).all(parseInt(params.id));

  return NextResponse.json({ event, results });
}

export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { results } = await request.json();
  if (!Array.isArray(results)) {
    return NextResponse.json({ error: 'results array required' }, { status: 400 });
  }

  const db = getDb();
  const eventId = parseInt(params.id);

  const upsert = db.prepare(`
    INSERT INTO event_results (event_id, user_id, position, gross_score, net_score, points, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO UPDATE SET
      position = excluded.position,
      gross_score = excluded.gross_score,
      net_score = excluded.net_score,
      points = excluded.points,
      notes = excluded.notes
  `);

  db.transaction(() => {
    for (const r of results) {
      upsert.run(eventId, r.user_id, r.position, r.gross_score, r.net_score, r.points || 0, r.notes || '');
    }
  })();

  return NextResponse.json({ success: true });
}
