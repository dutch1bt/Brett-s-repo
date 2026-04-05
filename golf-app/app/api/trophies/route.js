import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const trophies = db.prepare(`
    SELECT t.*, u.name AS winner_name, u.avatar_url AS winner_avatar, e.name AS event_name
    FROM trophies t
    LEFT JOIN users u ON u.id = t.winner_id
    LEFT JOIN events e ON e.id = t.event_id
    ORDER BY t.year DESC, t.id ASC
  `).all();

  // Leaderboard: total trophy wins per user
  const leaderboard = db.prepare(`
    SELECT u.id, u.name, u.avatar_url, COUNT(t.id) AS total_wins,
      GROUP_CONCAT(t.image_emoji) AS emojis
    FROM trophies t
    JOIN users u ON u.id = t.winner_id
    GROUP BY u.id
    ORDER BY total_wins DESC
  `).all();

  return NextResponse.json({ trophies, leaderboard });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, description, year, event_id, winner_id, image_emoji } = await request.json();
  if (!name || !year) return NextResponse.json({ error: 'name and year required' }, { status: 400 });

  const db = getDb();
  const result = db
    .prepare('INSERT INTO trophies (name, description, year, event_id, winner_id, image_emoji) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, description || '', year, event_id || null, winner_id || null, image_emoji || '🏆');

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
