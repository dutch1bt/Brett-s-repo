import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

// POST /api/pool/[id]/entries — add a new team entry (admin only)
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId);
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const poolId = parseInt(params.id);
  const { team_name, participant_name, payment_status, picks } = await request.json();

  if (!team_name || !participant_name) {
    return NextResponse.json({ error: 'team_name and participant_name required' }, { status: 400 });
  }

  const { lastInsertRowid: entryId } = db.prepare(
    'INSERT INTO pool_entries (pool_id, team_name, participant_name, payment_status) VALUES (?, ?, ?, ?)'
  ).run(poolId, team_name, participant_name, payment_status || 'unpaid');

  if (picks && Array.isArray(picks)) {
    const insertPick = db.prepare('INSERT OR REPLACE INTO pool_picks (entry_id, tier_number, golfer_name) VALUES (?, ?, ?)');
    for (const p of picks) insertPick.run(entryId, p.tier, p.golfer);
  }

  return NextResponse.json({ ok: true, entryId });
}

// PATCH /api/pool/[id]/entries — update entry (payment status, picks, etc.) — admin only
export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId);
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { entry_id, team_name, participant_name, payment_status, picks } = await request.json();
  if (!entry_id) return NextResponse.json({ error: 'entry_id required' }, { status: 400 });

  if (team_name || participant_name || payment_status) {
    db.prepare('UPDATE pool_entries SET team_name=COALESCE(?,team_name), participant_name=COALESCE(?,participant_name), payment_status=COALESCE(?,payment_status) WHERE id=?')
      .run(team_name ?? null, participant_name ?? null, payment_status ?? null, entry_id);
  }

  if (picks && Array.isArray(picks)) {
    const insertPick = db.prepare('INSERT OR REPLACE INTO pool_picks (entry_id, tier_number, golfer_name) VALUES (?, ?, ?)');
    for (const p of picks) insertPick.run(entry_id, p.tier, p.golfer);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/pool/[id]/entries?entry_id=X — remove entry (admin only)
export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId);
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const entryId = parseInt(searchParams.get('entry_id'));
  if (!entryId) return NextResponse.json({ error: 'entry_id required' }, { status: 400 });

  db.prepare('DELETE FROM pool_entries WHERE id = ?').run(entryId);
  return NextResponse.json({ ok: true });
}
