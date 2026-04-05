import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';
import { signToken, setAuthCookie } from '@/lib/auth';

export async function POST(request) {
  try {
    const { name, email, password, invite_code } = await request.json();

    // Validate invite code
    const validCode = process.env.INVITE_CODE || 'sandbaggers';
    if (!invite_code || invite_code.trim().toLowerCase() !== validCode.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid invite code — ask Brett for the link' }, { status: 403 });
    }

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name.trim(), email.toLowerCase().trim(), hash, 'member');

    const userId = result.lastInsertRowid;
    const token = await signToken({ userId, email: email.toLowerCase().trim(), name: name.trim(), role: 'member' });

    const response = NextResponse.json({
      user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), role: 'member' },
    });
    setAuthCookie(response, token);
    return response;
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
