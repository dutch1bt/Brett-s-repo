import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

// POST /api/admin/set-role  { user_id, role: 'admin' | 'member' }
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId);
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { user_id, role } = await request.json();
  if (!user_id || !['admin', 'member'].includes(role)) {
    return NextResponse.json({ error: 'user_id and role (admin|member) required' }, { status: 400 });
  }
  // Prevent self-demotion
  if (user_id === session.userId && role !== 'admin') {
    return NextResponse.json({ error: "You can't demote yourself" }, { status: 400 });
  }

  const target = db.prepare('SELECT id, name FROM users WHERE id = ?').get(user_id);
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user_id);
  return NextResponse.json({ ok: true, message: `${target.name} is now ${role}` });
}
