import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signToken, setAuthCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), email.toLowerCase().trim(), password_hash, 'member');

    const userId = result.lastInsertRowid;
    const token = await signToken({ id: userId, email: email.toLowerCase().trim(), name: name.trim(), role: 'member' });
    const response = NextResponse.json({ success: true, user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), role: 'member' } }, { status: 201 });
    setAuthCookie(response, token);
    return response;
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
