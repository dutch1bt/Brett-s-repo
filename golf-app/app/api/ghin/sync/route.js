import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncUserRounds, syncAllUsers } from '@/lib/syncRounds';
import { getDb } from '@/lib/db';

// POST /api/ghin/sync              — sync the logged-in user's rounds
// POST /api/ghin/sync?all=1        — sync all users (admin only)
// GET  /api/ghin/sync              — cron/health endpoint (no auth required, uses secret)
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const all = searchParams.get('all') === '1';

  if (all) {
    // Admin only
    const db = getDb();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId);
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }
    const result = await syncAllUsers();
    return NextResponse.json(result);
  }

  // Sync the logged-in user
  const db = getDb();
  const user = db.prepare('SELECT ghin_number FROM users WHERE id = ?').get(session.userId);
  if (!user?.ghin_number) {
    return NextResponse.json({ error: 'No GHIN number on file — add it in Edit Profile' }, { status: 400 });
  }

  const result = await syncUserRounds(session.userId, user.ghin_number);
  return NextResponse.json(result);
}

// GET — cron endpoint. Railway can call this hourly via a cron job.
// Protect with CRON_SECRET env var.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await syncAllUsers();
  return NextResponse.json({ ok: true, ...result });
}
