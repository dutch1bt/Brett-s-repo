'use client';
import { useEffect, useState } from 'react';

const STAGE_LABELS = ['Group', 'R32', 'R16', 'QF', 'SF', 'Final', '🏆'];
const RANK_COLORS = ['text-amber-400', 'text-slate-300', 'text-amber-600'];
const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function load() {
    const res = await fetch('/api/leaderboard');
    if (res.ok) {
      const json = await res.json();
      setData(json.leaderboard || []);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="text-green-400 text-lg animate-pulse">Loading leaderboard…</div>
      </div>
    );
  }

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">🏆 Leaderboard</h1>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="live-dot w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {data.length === 0 && (
        <div className="card p-12 text-center text-slate-500">
          No participants yet — be the first to join!
        </div>
      )}

      {/* Podium for top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {top3.map((entry, i) => (
            <div
              key={entry.user_id}
              className={`card p-5 text-center cursor-pointer hover:border-green-700 transition-colors ${
                i === 0 ? 'border-amber-500/50' : i === 1 ? 'border-slate-500/50' : 'border-amber-700/40'
              }`}
              onClick={() => setExpanded(expanded === entry.user_id ? null : entry.user_id)}
            >
              <div className="text-3xl mb-1">{RANK_MEDALS[i]}</div>
              <div className={`text-lg font-bold ${RANK_COLORS[i]}`}>{entry.name}</div>
              <div className="text-3xl font-black text-white my-2">{entry.total_points}</div>
              <div className="text-xs text-slate-400 mb-3">points</div>
              <div className="flex flex-wrap gap-1 justify-center">
                {entry.teams.map((t) => (
                  <span
                    key={t.name}
                    title={`${t.name}: ${t.score} pts`}
                    className={`text-xl ${t.eliminated ? 'opacity-30 grayscale' : ''}`}
                  >
                    {t.flag}
                  </span>
                ))}
              </div>
              {expanded === entry.user_id && (
                <div className="mt-4 text-left space-y-1.5 border-t border-slate-700 pt-4">
                  {entry.teams.map((t) => (
                    <div key={t.name} className="flex items-center justify-between text-sm">
                      <span className={`flex items-center gap-1.5 ${t.eliminated ? 'opacity-40 line-through' : 'text-white'}`}>
                        {t.flag} {t.name}
                      </span>
                      <span className="text-green-400 font-semibold">{t.score} pts</span>
                    </div>
                  ))}
                  {entry.max_stage_order > 0 && (
                    <div className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800">
                      Best stage: {STAGE_LABELS[entry.max_stage_order]}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full table */}
      {data.length > 3 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-green-900/60">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">#</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Player</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">Teams</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium">Pts</th>
                <th className="text-right px-4 py-3 text-slate-400 font-medium hidden sm:table-cell">Best</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry, i) => (
                <>
                  <tr
                    key={entry.user_id}
                    className="border-b border-slate-800/50 hover:bg-green-900/10 cursor-pointer"
                    onClick={() => setExpanded(expanded === entry.user_id ? null : entry.user_id)}
                  >
                    <td className="px-4 py-3">
                      <span className={`font-bold ${i < 3 ? RANK_COLORS[i] : 'text-slate-400'}`}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{entry.name}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex gap-0.5 flex-wrap">
                        {entry.teams.map((t) => (
                          <span key={t.name} title={t.name} className={t.eliminated ? 'opacity-30' : ''}>
                            {t.flag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-400">{entry.total_points}</td>
                    <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">
                      {STAGE_LABELS[entry.max_stage_order]}
                    </td>
                  </tr>
                  {expanded === entry.user_id && (
                    <tr key={`${entry.user_id}-expand`} className="bg-slate-900/50">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {entry.teams.map((t) => (
                            <div
                              key={t.name}
                              className={`flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 text-xs ${
                                t.eliminated ? 'opacity-40' : ''
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                {t.flag}
                                <span className={t.eliminated ? 'line-through' : 'text-white'}>{t.name}</span>
                              </span>
                              <span className="text-green-400 font-bold">{t.score}p</span>
                            </div>
                          ))}
                        </div>
                        {entry.max_stage_order > 0 && (
                          <p className="text-xs text-slate-500 mt-2">
                            Tiebreaker: best team reached {STAGE_LABELS[entry.max_stage_order]}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
