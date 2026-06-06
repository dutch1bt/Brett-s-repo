import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = getDb();
    const teams = db.prepare(`
      SELECT id, name, flag, confederation, price, group_wins, knockout_wins,
             eliminated, stage_order, active,
             (group_wins * 1 + knockout_wins * 2) AS score
      FROM teams
      ORDER BY price DESC, name ASC
    `).all();

    return NextResponse.json({ teams });
  } catch (err) {
    console.error('Admin GET teams error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id, price, active, eliminated, stage_order } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Team id is required' }, { status: 400 });
    }

    const db = getDb();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const updates = [];
    const values = [];

    if (price !== undefined) { updates.push('price = ?'); values.push(parseInt(price)); }
    if (active !== undefined) { updates.push('active = ?'); values.push(active ? 1 : 0); }
    if (eliminated !== undefined) { updates.push('eliminated = ?'); values.push(eliminated ? 1 : 0); }
    if (stage_order !== undefined) { updates.push('stage_order = ?'); values.push(parseInt(stage_order)); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    db.prepare(`UPDATE teams SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare(`
      SELECT id, name, flag, confederation, price, group_wins, knockout_wins,
             eliminated, stage_order, active,
             (group_wins * 1 + knockout_wins * 2) AS score
      FROM teams WHERE id = ?
    `).get(id);

    return NextResponse.json({ success: true, team: updated });
  } catch (err) {
    console.error('Admin PUT teams error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
