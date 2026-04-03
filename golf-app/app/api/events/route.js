import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const events = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_results WHERE event_id = e.id) AS participant_count
    FROM events e
    ORDER BY e.date DESC
  `).all();

  return NextResponse.json({ events });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, date, location, description, type, format } = await request.json();
  if (!name || !date || !location) {
    return NextResponse.json({ error: 'name, date, and location are required' }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare('INSERT INTO events (name, date, location, description, type, format) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, date, location, description || '', type || 'tournament', format || '');

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json({ event }, { status: 201 });
}
