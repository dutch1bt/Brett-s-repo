import { NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  const db = getDb();
  const tournaments = db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all();
  return NextResponse.json({ tournaments });
}

export async function POST(request) {
  const body = await request.json();
  const { name, espn_event_id, buy_in = 20 } = body;

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const db = getDb();
  const result = db
    .prepare('INSERT INTO tournaments (name, espn_event_id, buy_in, status) VALUES (?, ?, ?, ?)')
    .run(name, espn_event_id || null, buy_in, 'upcoming');

  // Insert default scoring rules
  const defaultPayouts = [
    { place: 1, percent: 0.70 },
    { place: 2, percent: 0.20 },
    { place: 3, percent: 0.10 },
  ];
  const insertPayout = db.prepare('INSERT INTO payouts (tournament_id, place, percent) VALUES (?, ?, ?)');
  for (const p of defaultPayouts) {
    insertPayout.run(result.lastInsertRowid, p.place, p.percent);
  }

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}

export async function PATCH(request) {
  const body = await request.json();
  const { id, name, espn_event_id, buy_in, status } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getDb();
  db.prepare(
    'UPDATE tournaments SET name=COALESCE(?,name), espn_event_id=COALESCE(?,espn_event_id), buy_in=COALESCE(?,buy_in), status=COALESCE(?,status) WHERE id=?'
  ).run(name, espn_event_id, buy_in, status, id);

  return NextResponse.json({ ok: true });
}
