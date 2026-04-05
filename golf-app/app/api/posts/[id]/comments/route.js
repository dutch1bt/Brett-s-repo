import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const comments = db.prepare(`
    SELECT c.id, c.content, c.created_at, u.id AS user_id, u.name AS user_name, u.avatar_url
    FROM post_comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(parseInt(params.id));

  return NextResponse.json({ comments });
}

export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });

  const db = getDb();
  const result = db
    .prepare('INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)')
    .run(parseInt(params.id), session.userId, content.trim());

  const comment = db.prepare(`
    SELECT c.id, c.content, c.created_at, u.id AS user_id, u.name AS user_name, u.avatar_url
    FROM post_comments c JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  return NextResponse.json({ comment }, { status: 201 });
}
