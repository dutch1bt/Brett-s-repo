import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = getDb();
    const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC').all();

    const participants = users.map((user) => {
      const picks = db.prepare(`
        SELECT t.id, t.name, t.flag, t.price, t.group_wins, t.knockout_wins,
               t.eliminated, t.stage_order,
               (t.group_wins * 1 + t.knockout_wins * 2) AS score
        FROM user_picks up
        JOIN teams t ON t.id = up.team_id
        WHERE up.user_id = ?
        ORDER BY t.price DESC, t.name ASC
      `).all(user.id);

      const total_points = picks.reduce((sum, t) => sum + (t.score || 0), 0);
      const total_spend = picks.reduce((sum, t) => sum + (t.price || 0), 0);
      const max_stage_order = picks.reduce((max, t) => Math.max(max, t.stage_order || 0), 0);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        total_points,
        total_spend,
        max_stage_order,
        teams: picks.map((t) => ({
          id: t.id,
          name: t.name,
          flag: t.flag,
          price: t.price,
          score: t.score,
          stage_order: t.stage_order,
          eliminated: t.eliminated,
          group_wins: t.group_wins,
          knockout_wins: t.knockout_wins,
        })),
      };
    });

    return NextResponse.json({ participants });
  } catch (err) {
    console.error('Admin participants error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
