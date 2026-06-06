import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = getDb();
    const picks = db.prepare(`
      SELECT t.id, t.name, t.flag, t.confederation, t.price, t.group_wins, t.knockout_wins,
             t.eliminated, t.stage_order,
             (t.group_wins * 1 + t.knockout_wins * 2) AS score
      FROM user_picks up
      JOIN teams t ON t.id = up.team_id
      WHERE up.user_id = ?
      ORDER BY t.price DESC, t.name ASC
    `).all(session.id);

    return NextResponse.json({ picks });
  } catch (err) {
    console.error('GET picks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = getDb();

    // Check if picks are locked
    const lockedSetting = db.prepare("SELECT value FROM settings WHERE key = 'picks_locked'").get();
    if (lockedSetting?.value === '1') {
      return NextResponse.json({ error: 'Picks are currently locked' }, { status: 403 });
    }

    const budgetSetting = db.prepare("SELECT value FROM settings WHERE key = 'budget'").get();
    const minTeamsSetting = db.prepare("SELECT value FROM settings WHERE key = 'min_teams'").get();
    const maxTeamsSetting = db.prepare("SELECT value FROM settings WHERE key = 'max_teams'").get();

    const budget = parseInt(budgetSetting?.value || '14');
    const minTeams = parseInt(minTeamsSetting?.value || '2');
    const maxTeams = parseInt(maxTeamsSetting?.value || '7');

    const { teamIds } = await request.json();

    if (!Array.isArray(teamIds)) {
      return NextResponse.json({ error: 'teamIds must be an array' }, { status: 400 });
    }

    if (teamIds.length < minTeams || teamIds.length > maxTeams) {
      return NextResponse.json({ error: `Must pick between ${minTeams} and ${maxTeams} teams` }, { status: 400 });
    }

    // Validate teams exist and calculate total price
    let totalPrice = 0;
    for (const teamId of teamIds) {
      const team = db.prepare('SELECT id, price, active FROM teams WHERE id = ?').get(teamId);
      if (!team || !team.active) {
        return NextResponse.json({ error: `Invalid team ID: ${teamId}` }, { status: 400 });
      }
      totalPrice += team.price;
    }

    if (totalPrice > budget) {
      return NextResponse.json({ error: `Total price $${totalPrice} exceeds budget of $${budget}` }, { status: 400 });
    }

    // Atomically replace all picks
    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare('DELETE FROM user_picks WHERE user_id = ?').run(session.id);
      const insertPick = db.prepare('INSERT INTO user_picks (user_id, team_id) VALUES (?, ?)');
      for (const teamId of teamIds) {
        insertPick.run(session.id, teamId);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return NextResponse.json({ success: true, message: 'Picks saved successfully' });
  } catch (err) {
    console.error('POST picks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
