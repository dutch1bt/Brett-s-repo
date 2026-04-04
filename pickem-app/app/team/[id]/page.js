'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const TIER_LABELS = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3', 4: 'Tier 4' };
const TIER_COLORS = {
  1: 'border-yellow-500 bg-yellow-950',
  2: 'border-blue-500 bg-blue-950',
  3: 'border-purple-500 bg-purple-950',
  4: 'border-gray-500 bg-gray-900',
};

export default function TeamPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get('tournamentId');

  const [team, setTeam] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !tournamentId) return;

    Promise.all([
      fetch(`/api/teams?teamId=${id}`).then((r) => r.json()),
      fetch(`/api/scores?tournamentId=${tournamentId}`).then((r) => r.json()),
    ]).then(([teamData, scores]) => {
      setTeam(teamData.team);
      const teamScore = scores.results?.find((r) => r.teamId === parseInt(id));
      setScoreData({ ...teamScore, leaderboard: scores.leaderboard, payouts: scores.payouts, totalPot: scores.totalPot });
      setLoading(false);
    });
  }, [id, tournamentId]);

  if (loading) return <div className="text-center text-gray-400 py-20 animate-pulse">Loading...</div>;
  if (!team || !scoreData) return <div className="text-center text-gray-400 py-20">Team not found.</div>;

  const payout = scoreData.payouts?.find((p) => p.place === scoreData.rank);

  return (
    <div>
      <Link href="/" className="text-masters-green hover:text-green-300 text-sm mb-4 inline-block">
        ← Back to Scoreboard
      </Link>

      <div className="bg-gray-900 border border-masters-green rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-masters-yellow">{team.team_name}</h1>
            <p className="text-gray-400 mt-1">{team.owner_name}</p>
            <span
              className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full ${
                team.payment_status === 'paid'
                  ? 'bg-green-900 text-green-300'
                  : 'bg-red-900 text-red-300'
              }`}
            >
              {team.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
            </span>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-masters-yellow">{scoreData.totalPoints}</div>
            <div className="text-gray-400 text-sm">total points</div>
            <div className="text-lg font-semibold mt-1">
              {scoreData.rank === 1 ? '🏆' : scoreData.rank === 2 ? '🥈' : scoreData.rank === 3 ? '🥉' : ''}{' '}
              #{scoreData.rank} Place
            </div>
            {payout && (
              <div className="text-green-400 text-sm font-semibold mt-1">
                Wins ${payout.amount}!
              </div>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Picks Breakdown</h2>
      <div className="space-y-3">
        {scoreData.breakdown?.map((pick, i) => (
          <div
            key={i}
            className={`border rounded-xl p-4 ${TIER_COLORS[pick.tier] || 'border-gray-700 bg-gray-900'}`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  {TIER_LABELS[pick.tier]}
                </span>
                <div className="text-lg font-semibold text-white mt-0.5">{pick.player}</div>
                <div className="text-sm text-gray-300 mt-0.5">
                  {pick.status === 'CUT' ? (
                    <span className="text-red-400">Missed Cut</span>
                  ) : pick.position ? (
                    <span>Position: <strong>{pick.position}</strong></span>
                  ) : (
                    <span className="text-gray-500">Pending</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${pick.total > 0 ? 'text-green-400' : pick.total < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {pick.total > 0 ? `+${pick.total}` : pick.total}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {pick.posPoints !== 0 && <span>Pos: {pick.posPoints > 0 ? `+${pick.posPoints}` : pick.posPoints}</span>}
                  {pick.lowRoundPts > 0 && <span className="ml-2 text-blue-400">Low Rnd: +{pick.lowRoundPts}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Scoring legend */}
      <div className="mt-8 bg-gray-900 border border-gray-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Scoring Rules</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
          <div>🥇 1st Place: <strong className="text-white">25 pts</strong></div>
          <div>🥈 2nd Place: <strong className="text-white">15 pts</strong></div>
          <div>🥉 3rd Place: <strong className="text-white">12 pts</strong></div>
          <div>Top 10: <strong className="text-white">8 pts</strong></div>
          <div>Top 25: <strong className="text-white">5 pts</strong></div>
          <div>Made Cut: <strong className="text-white">3 pts</strong></div>
          <div>Missed Cut: <strong className="text-red-400">-2 pts</strong></div>
          <div>Low Round: <strong className="text-blue-400">+2 pts</strong></div>
        </div>
      </div>
    </div>
  );
}
