import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { lookupGolfer, getHandicapHistory } from '@/lib/ghin';

// GET /api/ghin?ghin=1234567  — lookup any GHIN number
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ghinNumber = searchParams.get('ghin');
  if (!ghinNumber) return NextResponse.json({ error: 'ghin param required' }, { status: 400 });

  const [golfer, history] = await Promise.all([
    lookupGolfer(ghinNumber),
    getHandicapHistory(ghinNumber),
  ]);

  if (!golfer) {
    return NextResponse.json({ error: 'GHIN number not found' }, { status: 404 });
  }

  return NextResponse.json({ golfer, history });
}

// POST /api/ghin — sync the logged-in user's handicap from GHIN
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ghin_number } = await request.json();
  if (!ghin_number) return NextResponse.json({ error: 'ghin_number required' }, { status: 400 });

  const golfer = await lookupGolfer(ghin_number);
  if (!golfer) {
    return NextResponse.json({ error: 'GHIN number not found — double-check it at ghin.com' }, { status: 404 });
  }

  const db = getDb();
  db.prepare('UPDATE users SET ghin_number = ?, handicap = ? WHERE id = ?').run(
    ghin_number,
    golfer.handicapIndex,
    session.userId
  );

  return NextResponse.json({ golfer });
}
