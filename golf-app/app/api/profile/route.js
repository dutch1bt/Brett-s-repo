import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = parseInt(searchParams.get('id') || session.userId);

  const db = getDb();
  const user = db
    .prepare('SELECT id, name, email, role, ghin_number, handicap, avatar_url, bio, created_at FROM users WHERE id = ?')
    .get(userId);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Stats
  const stats = db.prepare(`
    SELECT
      COUNT(DISTINCT er.event_id) AS events_played,
      MIN(er.position) AS best_finish,
      COUNT(CASE WHEN er.position = 1 THEN 1 END) AS wins,
      AVG(er.gross_score) AS avg_gross,
      MIN(er.gross_score) AS best_gross,
      SUM(er.points) AS total_points
    FROM event_results er
    WHERE er.user_id = ?
  `).get(userId);

  const trophyCount = db
    .prepare('SELECT COUNT(*) AS n FROM trophies WHERE winner_id = ?')
    .get(userId).n;

  const recentResults = db.prepare(`
    SELECT er.position, er.gross_score, er.net_score, er.points, e.id AS event_id, e.name AS event_name, e.date, e.location
    FROM event_results er
    JOIN events e ON e.id = er.event_id
    WHERE er.user_id = ?
    ORDER BY e.date DESC
    LIMIT 10
  `).all(userId);

  const posts = db.prepare(`
    SELECT p.id, p.content, p.image_url, p.created_at,
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count
    FROM posts p WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 10
  `).all(userId);

  return NextResponse.json({ user, stats, trophyCount, recentResults, posts });
}

export async function PATCH(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { bio, ghin_number, handicap, avatar_url } = await request.json();

  const db = getDb();
  let sql = 'UPDATE users SET bio = ?, ghin_number = ?';
  const params = [bio || '', ghin_number || null];

  // Only update handicap from confirmed GHIN sync — no manual overrides
  if (handicap != null) { sql += ', handicap = ?'; params.push(handicap); }
  // Avatar stored as data URL (client-resized to 256×256 JPEG)
  if (avatar_url != null) { sql += ', avatar_url = ?'; params.push(avatar_url); }

  sql += ' WHERE id = ?';
  params.push(session.userId);
  db.prepare(sql).run(...params);

  const user = db
    .prepare('SELECT id, name, email, role, ghin_number, handicap, avatar_url, bio FROM users WHERE id = ?')
    .get(session.userId);
  return NextResponse.json({ user });
}
