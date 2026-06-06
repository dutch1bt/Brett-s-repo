import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = getDb();

    // Get all users
    const users = db.prepare('SELECT id, name FROM users WHERE role != ?').all('admin');

    const leaderboard = users.map((user) => {
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
      const max_stage_order = picks.reduce((max, t) => Math.max(max, t.stage_order || 0), 0);

      return {
        user_id: user.id,
        name: user.name,
        total_points,
        max_stage_order,
        teams: picks.map((t) => ({
          name: t.name,
          flag: t.flag,
          score: t.score,
          stage_order: t.stage_order,
          eliminated: t.eliminated,
          group_wins: t.group_wins,
          knockout_wins: t.knockout_wins,
          price: t.price,
        })),
      };
    });

    // Sort by total_points desc, then max_stage_order desc (tiebreaker)
    leaderboard.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return b.max_stage_order - a.max_stage_order;
    });

    // Add ranks
    let rank = 1;
    for (let i = 0; i < leaderboard.length; i++) {
      if (i > 0 &&
        leaderboard[i].total_points === leaderboard[i - 1].total_points &&
        leaderboard[i].max_stage_order === leaderboard[i - 1].max_stage_order) {
        leaderboard[i].rank = leaderboard[i - 1].rank;
      } else {
        leaderboard[i].rank = rank;
      }
      rank++;
    }

    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
