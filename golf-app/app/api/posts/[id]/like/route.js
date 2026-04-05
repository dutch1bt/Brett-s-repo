import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const postId = parseInt(params.id);

  const existing = db
    .prepare('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?')
    .get(postId, session.userId);

  if (existing) {
    db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(postId, session.userId);
  } else {
    db.prepare('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)').run(postId, session.userId);
  }

  const count = db.prepare('SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?').get(postId).n;
  return NextResponse.json({ liked: !existing, count });
}
