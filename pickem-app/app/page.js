'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const RANK_COLORS = {
  1: 'text-yellow-400 font-bold',
  2: 'text-gray-300 font-semibold',
  3: 'text-amber-600 font-semibold',
};

export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetch('/api/admin/tournaments')
      .then((r) => r.json())
      .then((d) => {
        setTournaments(d.tournaments || []);
        if (d.tournaments?.length) setSelected(d.tournaments[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadScores();
  }, [selected]);

  async function loadScores() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scores?tournamentId=${selected}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const paidCount = data?.results?.filter((r) => r.paymentStatus === 'paid').length || 0;

  return (
    <div>
      {/* Tournament selector */}
      {tournaments.length > 1 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {tournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                selected === t.id
                  ? 'bg-masters-green border-masters-yellow text-masters-yellow'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-masters-green'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-masters-yellow">{data.leaderboard.eventName}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
              <span>Status: <span className="text-white">{data.leaderboard.status}</span></span>
              <span>Entries: <span className="text-white">{data.results.length}</span></span>
              <span>Pot: <span className="text-green-400 font-semibold">${data.totalPot}</span></span>
              {lastUpdated && (
                <span>Updated: <span className="text-white">{lastUpdated.toLocaleTimeString()}</span></span>
              )}
            </div>

            {/* Payouts */}
            <div className="flex gap-3 mt-3 flex-wrap">
              {data.payouts.map((p) => (
                <div key={p.place} className="bg-gray-800 rounded-lg px-3 py-2 text-center">
                  <div className="text-xs text-gray-400">{ordinal(p.place)} Place</div>
                  <div className="text-green-400 font-bold">${p.amount}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">Scoreboard</h2>
            <button
              onClick={loadScores}
              disabled={loading}
              className="text-sm bg-masters-green hover:bg-masters-dark px-3 py-1 rounded text-masters-yellow disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Scoring legend */}
          <div className="mb-4 flex flex-wrap gap-2 text-xs text-gray-400">
            <span className="bg-gray-800 rounded px-2 py-1">1st: 25pts</span>
            <span className="bg-gray-800 rounded px-2 py-1">2nd: 15pts</span>
            <span className="bg-gray-800 rounded px-2 py-1">3rd: 12pts</span>
            <span className="bg-gray-800 rounded px-2 py-1">Top 10: 8pts</span>
            <span className="bg-gray-800 rounded px-2 py-1">Top 25: 5pts</span>
            <span className="bg-gray-800 rounded px-2 py-1">Cut: 3pts</span>
            <span className="bg-gray-800 rounded px-2 py-1">Missed: -2pts</span>
            <span className="bg-gray-800 rounded px-2 py-1">Low Rnd: +2pts</span>
          </div>

          <div className="space-y-2">
            {data.results.map((team) => (
              <Link
                key={team.teamId}
                href={`/team/${team.teamId}?tournamentId=${selected}`}
                className="block bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-masters-green rounded-xl p-4 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg w-8 text-center ${RANK_COLORS[team.rank] || 'text-gray-400'}`}>
                      {team.rank === 1 ? '🏆' : team.rank === 2 ? '🥈' : team.rank === 3 ? '🥉' : `#${team.rank}`}
                    </span>
                    <div>
                      <div className="font-semibold text-white">{team.teamName}</div>
                      <div className="text-xs text-gray-400">{team.ownerName}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-masters-yellow">{team.totalPoints}</div>
                    <div className="text-xs text-gray-500">pts</div>
                  </div>
                </div>

                {/* Mini picks summary */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {team.breakdown.map((pick, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        pick.status === 'CUT'
                          ? 'border-red-800 text-red-400 bg-red-950'
                          : pick.total > 0
                          ? 'border-green-700 text-green-300 bg-green-950'
                          : pick.total < 0
                          ? 'border-red-700 text-red-300 bg-red-950'
                          : 'border-gray-700 text-gray-400 bg-gray-900'
                      }`}
                    >
                      {pick.player} {pick.position ? `(${pick.position})` : ''} {pick.total > 0 ? `+${pick.total}` : pick.total}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="text-red-400 bg-red-950 border border-red-800 rounded p-4">{error}</div>
      )}

      {!data && !loading && !error && tournaments.length === 0 && (
        <div className="text-center text-gray-400 py-20">
          <p className="text-xl mb-4">No tournaments yet.</p>
          <Link href="/admin" className="bg-masters-green text-masters-yellow px-6 py-3 rounded-lg font-semibold">
            Go to Admin to create one
          </Link>
        </div>
      )}

      {loading && !data && (
        <div className="text-center text-gray-400 py-20 animate-pulse">Loading scores...</div>
      )}
    </div>
  );
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
