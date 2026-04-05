import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

const DEFAULT_SCORING = [
  { label: '1st',        points: 25 },
  { label: '2nd',        points: 15 },
  { label: '3rd',        points: 12 },
  { label: 'Top 10',     points: 8  },
  { label: 'Top 25',     points: 5  },
  { label: 'Made Cut',   points: 3  },
  { label: 'Missed Cut', points: -2 },
  { label: 'Low Round',  points: 2  },
];

// GET /api/pool — return the active pool with full data
export async function GET() {
  const db = getDb();
  const pool = db.prepare("SELECT * FROM pools WHERE status = 'active' ORDER BY created_at DESC LIMIT 1").get();
  if (!pool) return NextResponse.json({ pool: null });

  const tiers = db.prepare('SELECT * FROM pool_tiers WHERE pool_id = ? ORDER BY tier_number').all(pool.id);
  const entries = db.prepare('SELECT * FROM pool_entries WHERE pool_id = ? ORDER BY created_at').all(pool.id);
  const picks = db.prepare(`
    SELECT pp.*, pe.pool_id FROM pool_picks pp
    JOIN pool_entries pe ON pe.id = pp.entry_id
    WHERE pe.pool_id = ?
  `).all(pool.id);
  const results = db.prepare('SELECT * FROM pool_golfer_results WHERE pool_id = ?').all(pool.id);
  const scoring = db.prepare('SELECT * FROM pool_scoring_rules WHERE pool_id = ? ORDER BY points DESC').all(pool.id);

  // Build result map for quick lookup
  const resultMap = {};
  for (const r of results) resultMap[r.golfer_name.toLowerCase()] = r;

  // Calculate points for each entry
  const entriesWithPoints = entries.map((entry) => {
    const entryPicks = picks.filter((p) => p.entry_id === entry.id);
    let totalPoints = 0;
    const pickDetails = entryPicks.map((p) => {
      const res = resultMap[p.golfer_name.toLowerCase()];
      const pts = res?.points ?? null;
      if (pts != null) totalPoints += pts;
      return { tier: p.tier_number, golfer: p.golfer_name, position: res?.position ?? null, score: res?.score ?? null, points: pts, madeCut: res?.made_cut ?? null };
    }).sort((a, b) => a.tier - b.tier);
    return { ...entry, picks: pickDetails, totalPoints };
  });

  // Sort leaderboard by points desc
  const leaderboard = [...entriesWithPoints].sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json({
    pool,
    tiers: tiers.map((t) => ({ ...t, golfers: JSON.parse(t.golfers || '[]') })),
    leaderboard,
    results,
    scoring: scoring.length ? scoring : DEFAULT_SCORING,
  });
}

// POST /api/pool — create a new pool (admin only)
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId);
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { name, tournament, year, buy_in, draft_deadline, venmo, notes, tiers } = await request.json();

  // Archive any existing active pools
  db.prepare("UPDATE pools SET status = 'archived' WHERE status = 'active'").run();

  const { lastInsertRowid: poolId } = db.prepare(
    'INSERT INTO pools (name, tournament, year, buy_in, draft_deadline, venmo, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(name, tournament, year || new Date().getFullYear(), buy_in || 20, draft_deadline || null, venmo || null, notes || null);

  // Insert default scoring rules
  const insertRule = db.prepare('INSERT INTO pool_scoring_rules (pool_id, label, points) VALUES (?, ?, ?)');
  for (const rule of DEFAULT_SCORING) insertRule.run(poolId, rule.label, rule.points);

  // Insert tiers if provided
  if (tiers && Array.isArray(tiers)) {
    const insertTier = db.prepare('INSERT OR REPLACE INTO pool_tiers (pool_id, tier_number, golfers) VALUES (?, ?, ?)');
    for (const t of tiers) insertTier.run(poolId, t.tier_number, JSON.stringify(t.golfers || []));
  }

  const pool = db.prepare('SELECT * FROM pools WHERE id = ?').get(poolId);
  return NextResponse.json({ pool });
}

// PATCH /api/pool — update active pool settings (admin only)
export async function PATCH(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId);
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const pool = db.prepare("SELECT * FROM pools WHERE status = 'active' LIMIT 1").get();
  if (!pool) return NextResponse.json({ error: 'No active pool' }, { status: 404 });

  const { name, tournament, buy_in, draft_deadline, venmo, notes, tiers } = await request.json();

  db.prepare('UPDATE pools SET name=?, tournament=?, buy_in=?, draft_deadline=?, venmo=?, notes=? WHERE id=?')
    .run(name ?? pool.name, tournament ?? pool.tournament, buy_in ?? pool.buy_in, draft_deadline ?? pool.draft_deadline, venmo ?? pool.venmo, notes ?? pool.notes, pool.id);

  if (tiers) {
    const insertTier = db.prepare('INSERT OR REPLACE INTO pool_tiers (pool_id, tier_number, golfers) VALUES (?, ?, ?)');
    for (const t of tiers) insertTier.run(pool.id, t.tier_number, JSON.stringify(t.golfers || []));
  }

  return NextResponse.json({ ok: true });
}
