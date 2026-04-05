import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

// POST /api/admin/reset-password
// Body: { user_id, new_password }
// Admin only — lets Brett reset any member's password.
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId);
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { user_id, new_password } = await request.json();
  if (!user_id || !new_password) {
    return NextResponse.json({ error: 'user_id and new_password required' }, { status: 400 });
  }
  if (new_password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const target = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(user_id);
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user_id);

  return NextResponse.json({ ok: true, message: `Password reset for ${target.name}` });
}
