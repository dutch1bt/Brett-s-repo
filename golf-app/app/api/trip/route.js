import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

function isAdmin(session, db) {
  if (!session) return false;
  return db.prepare('SELECT role FROM users WHERE id = ?').get(session.userId)?.role === 'admin';
}

// GET /api/trip — return the active trip with all sub-data
export async function GET() {
  const db = getDb();
  const trip = db.prepare("SELECT * FROM trips WHERE status = 'active' ORDER BY created_at DESC LIMIT 1").get();
  if (!trip) return NextResponse.json({ trip: null });

  const itinerary = db.prepare('SELECT * FROM trip_itinerary WHERE trip_id = ? ORDER BY day, sort_order, time').all(trip.id);
  const teeTimes  = db.prepare('SELECT * FROM trip_tee_times WHERE trip_id = ? ORDER BY day, tee_time').all(trip.id);
  const rooms     = db.prepare('SELECT * FROM trip_rooms WHERE trip_id = ? ORDER BY room_name, sort_order').all(trip.id);
  const players   = db.prepare('SELECT * FROM trip_players WHERE trip_id = ? ORDER BY handicap').all(trip.id);
  const payments  = db.prepare('SELECT * FROM trip_payments WHERE trip_id = ? ORDER BY player_name, item').all(trip.id);

  return NextResponse.json({
    trip,
    itinerary,
    teeTimes: teeTimes.map((t) => ({ ...t, players: JSON.parse(t.players || '[]') })),
    rooms,
    players,
    payments,
  });
}

// POST /api/trip — create a new active trip (admin only)
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  if (!isAdmin(session, db)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { name, year, location, dates_text, hotel, notes } = await request.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  // Archive any existing active trip
  db.prepare("UPDATE trips SET status = 'archived' WHERE status = 'active'").run();

  const { lastInsertRowid: tripId } = db.prepare(
    'INSERT INTO trips (name, year, location, dates_text, hotel, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, year || new Date().getFullYear(), location || null, dates_text || null, hotel || null, notes || null);

  return NextResponse.json({ trip: db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId) });
}

// PATCH /api/trip — update active trip info or sub-resources (admin only)
export async function PATCH(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  if (!isAdmin(session, db)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const trip = db.prepare("SELECT * FROM trips WHERE status = 'active' LIMIT 1").get();
  if (!trip) return NextResponse.json({ error: 'No active trip' }, { status: 404 });

  const body = await request.json();
  const { resource, action, data } = body;

  // Update trip header
  if (resource === 'trip') {
    const { name, location, dates_text, hotel, notes } = data;
    db.prepare('UPDATE trips SET name=COALESCE(?,name), location=COALESCE(?,location), dates_text=COALESCE(?,dates_text), hotel=COALESCE(?,hotel), notes=COALESCE(?,notes) WHERE id=?')
      .run(name ?? null, location ?? null, dates_text ?? null, hotel ?? null, notes ?? null, trip.id);
    return NextResponse.json({ ok: true });
  }

  // Bulk replace itinerary
  if (resource === 'itinerary' && action === 'replace') {
    db.prepare('DELETE FROM trip_itinerary WHERE trip_id = ?').run(trip.id);
    const ins = db.prepare('INSERT INTO trip_itinerary (trip_id, day, sort_order, time, description, location, type) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const [i, item] of (data || []).entries()) {
      ins.run(trip.id, item.day, item.sort_order ?? i, item.time ?? null, item.description, item.location ?? null, item.type ?? 'activity');
    }
    return NextResponse.json({ ok: true });
  }

  // Add/update single itinerary item
  if (resource === 'itinerary' && action === 'upsert') {
    const { id, day, time, description, location, type, sort_order } = data;
    if (id) {
      db.prepare('UPDATE trip_itinerary SET day=?,time=?,description=?,location=?,type=?,sort_order=? WHERE id=?')
        .run(day, time ?? null, description, location ?? null, type ?? 'activity', sort_order ?? 0, id);
    } else {
      db.prepare('INSERT INTO trip_itinerary (trip_id, day, time, description, location, type, sort_order) VALUES (?,?,?,?,?,?,?)')
        .run(trip.id, day, time ?? null, description, location ?? null, type ?? 'activity', sort_order ?? 0);
    }
    return NextResponse.json({ ok: true });
  }

  if (resource === 'itinerary' && action === 'delete') {
    db.prepare('DELETE FROM trip_itinerary WHERE id = ? AND trip_id = ?').run(data.id, trip.id);
    return NextResponse.json({ ok: true });
  }

  // Bulk replace tee times
  if (resource === 'tee_times' && action === 'replace') {
    db.prepare('DELETE FROM trip_tee_times WHERE trip_id = ?').run(trip.id);
    const ins = db.prepare('INSERT INTO trip_tee_times (trip_id, day, round_name, course, tee_time, players) VALUES (?, ?, ?, ?, ?, ?)');
    for (const t of (data || [])) ins.run(trip.id, t.day, t.round_name, t.course ?? null, t.tee_time, JSON.stringify(t.players || []));
    return NextResponse.json({ ok: true });
  }

  // Bulk replace rooms
  if (resource === 'rooms' && action === 'replace') {
    db.prepare('DELETE FROM trip_rooms WHERE trip_id = ?').run(trip.id);
    const ins = db.prepare('INSERT INTO trip_rooms (trip_id, room_name, player_name, sort_order) VALUES (?, ?, ?, ?)');
    for (const [i, r] of (data || []).entries()) ins.run(trip.id, r.room_name, r.player_name, r.sort_order ?? i);
    return NextResponse.json({ ok: true });
  }

  // Bulk replace players
  if (resource === 'players' && action === 'replace') {
    db.prepare('DELETE FROM trip_players WHERE trip_id = ?').run(trip.id);
    const ins = db.prepare('INSERT INTO trip_players (trip_id, name, handicap, hcp_80, hcp_100, hcp_9hole, team, sort_order) VALUES (?,?,?,?,?,?,?,?)');
    for (const [i, p] of (data || []).entries()) ins.run(trip.id, p.name, p.handicap ?? null, p.hcp_80 ?? null, p.hcp_100 ?? null, p.hcp_9hole ?? null, p.team ?? null, i);
    return NextResponse.json({ ok: true });
  }

  // Toggle single payment paid status
  if (resource === 'payment' && action === 'toggle') {
    const { player_name, item, amount, venmo_to } = data;
    const existing = db.prepare('SELECT * FROM trip_payments WHERE trip_id=? AND player_name=? AND item=?').get(trip.id, player_name, item);
    if (existing) {
      db.prepare('UPDATE trip_payments SET paid = ? WHERE id = ?').run(existing.paid ? 0 : 1, existing.id);
    } else {
      db.prepare('INSERT INTO trip_payments (trip_id, player_name, item, amount, paid, venmo_to) VALUES (?,?,?,?,1,?)').run(trip.id, player_name, item, amount ?? null, venmo_to ?? null);
    }
    return NextResponse.json({ ok: true });
  }

  // Bulk replace payments
  if (resource === 'payments' && action === 'replace') {
    db.prepare('DELETE FROM trip_payments WHERE trip_id = ?').run(trip.id);
    const ins = db.prepare('INSERT INTO trip_payments (trip_id, player_name, item, amount, paid, venmo_to) VALUES (?,?,?,?,?,?)');
    for (const p of (data || [])) ins.run(trip.id, p.player_name, p.item, p.amount ?? null, p.paid ? 1 : 0, p.venmo_to ?? null);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown resource/action' }, { status: 400 });
}
