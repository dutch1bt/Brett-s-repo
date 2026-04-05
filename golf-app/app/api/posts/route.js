import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const posts = db.prepare(`
    SELECT
      p.id, p.content, p.image_url, p.created_at,
      u.id AS user_id, u.name AS user_name, u.avatar_url,
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) AS user_liked
    FROM posts p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all(session.userId);

  return NextResponse.json({ posts });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const content = formData.get('content')?.toString().trim();
    const imageFile = formData.get('image');

    if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });

    let imageUrl = null;
    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadDir, { recursive: true });
      const fileName = `${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      await writeFile(path.join(uploadDir, fileName), buffer);
      imageUrl = `/uploads/${fileName}`;
    }

    const result = db
      .prepare('INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)')
      .run(session.userId, content, imageUrl);

    const post = db.prepare(`
      SELECT p.id, p.content, p.image_url, p.created_at,
        u.id AS user_id, u.name AS user_name, u.avatar_url,
        0 AS like_count, 0 AS comment_count, 0 AS user_liked
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    return NextResponse.json({ post }, { status: 201 });
  }

  const { content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });

  const result = db
    .prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)')
    .run(session.userId, content.trim());

  const post = db.prepare(`
    SELECT p.id, p.content, p.image_url, p.created_at,
      u.id AS user_id, u.name AS user_name, u.avatar_url,
      0 AS like_count, 0 AS comment_count, 0 AS user_liked
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(result.lastInsertRowid);

  return NextResponse.json({ post }, { status: 201 });
}
