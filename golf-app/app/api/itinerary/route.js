import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const items = db.prepare(`
    SELECT * FROM itinerary_items ORDER BY date ASC, time ASC
  `).all();

  return NextResponse.json({ items });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, date, time, location, description, type, notes } = await request.json();
  if (!title || !date) return NextResponse.json({ error: 'title and date required' }, { status: 400 });

  const db = getDb();
  const result = db
    .prepare('INSERT INTO itinerary_items (title, date, time, location, description, type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(title, date, time || '', location || '', description || '', type || 'event', notes || '');

  const item = db.prepare('SELECT * FROM itinerary_items WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json({ item }, { status: 201 });
}

export async function DELETE(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await request.json();
  const db = getDb();
  db.prepare('DELETE FROM itinerary_items WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}
