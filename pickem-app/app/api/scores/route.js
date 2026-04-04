import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { fetchLeaderboard } from '@/lib/espn';
import { buildPlayerMap, scoreTeam } from '@/lib/scoring';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');

  if (!tournamentId) {
    return NextResponse.json({ error: 'tournamentId required' }, { status: 400 });
  }

  const db = getDb();
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

  const teams = db.prepare('SELECT * FROM teams WHERE tournament_id = ? ORDER BY team_name').all(tournamentId);
  const allPicks = db.prepare('SELECT * FROM picks WHERE tournament_id = ?').all(tournamentId);

  // Fetch live ESPN data
  let playerMap = {};
  let leaderboard = { players: [], eventName: tournament.name, status: 'unknown' };
  try {
    leaderboard = await fetchLeaderboard(tournament.espn_event_id);
    playerMap = buildPlayerMap(leaderboard.players);
  } catch {
    // ESPN fetch failed - score with empty map (all 0)
  }

  const results = teams.map((team) => {
    const picks = allPicks.filter((p) => p.team_id === team.id);
    const { total, breakdown } = scoreTeam(picks, playerMap);
    return {
      teamId: team.id,
      teamName: team.team_name,
      ownerName: team.owner_name,
      paymentStatus: team.payment_status,
      totalPoints: total,
      breakdown,
    };
  });

  results.sort((a, b) => b.totalPoints - a.totalPoints);

  // Add rank with ties
  let rank = 1;
  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].totalPoints < results[i - 1].totalPoints) rank = i + 1;
    results[i].rank = rank;
  }

  const payouts = db.prepare('SELECT * FROM payouts WHERE tournament_id = ? ORDER BY place').all(tournamentId);
  const totalPot = teams.filter((t) => t.payment_status === 'paid').length * tournament.buy_in;

  return NextResponse.json({
    tournament,
    leaderboard: { eventName: leaderboard.eventName, status: leaderboard.status },
    results,
    payouts: payouts.map((p) => ({
      place: p.place,
      amount: Math.round(totalPot * p.percent),
      percent: p.percent,
    })),
    totalPot,
    lastUpdated: new Date().toISOString(),
  });
}
