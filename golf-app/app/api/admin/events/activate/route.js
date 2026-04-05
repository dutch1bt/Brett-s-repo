import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { event_id, active } = await request.json();
  const db = getDb();

  if (active) {
    // Deactivate all, then activate selected
    db.prepare('UPDATE events SET is_active = 0').run();
    db.prepare('UPDATE events SET is_active = 1 WHERE id = ?').run(event_id);
  } else {
    db.prepare('UPDATE events SET is_active = 0 WHERE id = ?').run(event_id);
  }

  return NextResponse.json({ success: true });
}
