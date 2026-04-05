'use client';

import { useState, useEffect } from 'react';
import Avatar from '@/components/Avatar';

export default function TrophiesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/trophies')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-4 page-enter">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-20" />
          ))}
        </div>
      </div>
    );
  }

  const { trophies = [], leaderboard = [] } = data || {};

  // Group trophies by year
  const years = [...new Set(trophies.map((t) => t.year))].sort((a, b) => b - a);

  // filter by year
  const filtered = filter === 'all' ? trophies : trophies.filter((t) => t.year === parseInt(filter));

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="bg-gradient-to-b from-amber-950/80 to-green-950 border-b border-amber-800/30">
        <div className="px-4 pt-4 pb-5" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
          <div className="text-4xl mb-1">🏆</div>
          <h1 className="text-2xl font-extrabold text-white">Trophy Room</h1>
          <p className="text-amber-400 text-xs mt-1 font-medium">Hall of Champions</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* All-time champion leaderboard */}
        {leaderboard.length > 0 && (
          <div className="card-gold p-4">
            <h2 className="text-amber-400 font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>👑</span> All-Time Champion Rankings
            </h2>
            <div className="space-y-3">
              {leaderboard.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className={`pos-badge ${i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : 'pos-other'} text-base`}>
                    {i === 0 ? '👑' : i + 1}
                  </span>
                  <Avatar name={m.name} avatarUrl={m.avatar_url} size="xs" />
                  <div className="flex-1 min-w-0">
                    <p className="text-green-50 text-sm font-semibold truncate">{m.name}</p>
                    <p className="text-green-600 text-xs">{m.emojis?.split(',').slice(0, 4).join(' ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-bold text-lg leading-none">{m.total_wins}</p>
                    <p className="text-green-600 text-xs">trophies</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Year filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-amber-500 text-amber-950' : 'bg-green-900 text-green-400 hover:bg-green-800'}`}>
            All Years
          </button>
          {years.map((y) => (
            <button key={y} onClick={() => setFilter(y)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filter === y ? 'bg-amber-500 text-amber-950' : 'bg-green-900 text-green-400 hover:bg-green-800'}`}>
              {y}
            </button>
          ))}
        </div>

        {/* Trophy list */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-green-600">
              <div className="text-4xl mb-3">🏆</div>
              <p>No trophies for this year</p>
            </div>
          )}

          {/* Group by year */}
          {[...new Set(filtered.map((t) => t.year))].sort((a, b) => b - a).map((year) => (
            <div key={year}>
              <h3 className="text-green-500 text-xs font-bold uppercase tracking-widest mb-2 px-1">{year}</h3>
              <div className="space-y-2">
                {filtered.filter((t) => t.year === year).map((trophy) => (
                  <div key={trophy.id}
                       className="card trophy-shimmer p-4 flex items-center gap-4 border border-amber-700/20">
                    <div className="text-3xl flex-shrink-0">{trophy.image_emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-amber-300 text-sm">{trophy.name}</p>
                      {trophy.event_name && (
                        <p className="text-green-500 text-xs mt-0.5">{trophy.event_name}</p>
                      )}
                      <p className="text-green-400 text-xs mt-0.5 italic">{trophy.description}</p>
                    </div>
                    {trophy.winner_name && (
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <Avatar name={trophy.winner_name} avatarUrl={trophy.winner_avatar} size="sm" />
                        <p className="text-xs text-amber-400 font-semibold text-center leading-tight max-w-[5rem] truncate">
                          {trophy.winner_name.split(' ')[0]}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
