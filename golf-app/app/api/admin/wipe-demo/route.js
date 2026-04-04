import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

// POST /api/admin/wipe-demo
// Deletes all fake/seed data: demo users, all posts, fake event results & trophies.
// Keeps: the admin user, events, itinerary.
// Admin only.
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId);
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  // Delete all posts (fake feed content)
  const { changes: postsDeleted } = db.prepare('DELETE FROM posts').run();

  // Delete all post likes and comments (cascade would handle it but be explicit)
  db.prepare('DELETE FROM post_likes').run();
  db.prepare('DELETE FROM post_comments').run();

  // Delete all event results (fake scores)
  const { changes: resultsDeleted } = db.prepare('DELETE FROM event_results').run();

  // Delete all trophies assigned to non-admin users
  const { changes: trophiesDeleted } = db
    .prepare(`DELETE FROM trophies WHERE winner_id IN (
      SELECT id FROM users WHERE role != 'admin'
    )`)
    .run();

  // Delete all non-admin users
  const { changes: usersDeleted } = db
    .prepare("DELETE FROM users WHERE role != 'admin'")
    .run();

  // Also clear ghin_synced_rounds for cleanliness
  db.prepare('DELETE FROM ghin_synced_rounds').run();

  return NextResponse.json({
    ok: true,
    deleted: {
      users: usersDeleted,
      posts: postsDeleted,
      eventResults: resultsDeleted,
      trophies: trophiesDeleted,
    },
    message: 'Demo data wiped. Only admin accounts and event/itinerary structure remain.',
  });
}
