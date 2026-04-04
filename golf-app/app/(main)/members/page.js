'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('handicap');
  const [me, setMe] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/members').then((r) => r.json()),
      fetch('/api/profile').then((r) => r.json()),
    ]).then(([membersData, profileData]) => {
      setMembers(membersData.members || []);
      setMe(profileData.user);
      setLoading(false);
    });
  }, []);

  // Sort copies
  const byHandicap = [...members]
    .filter((m) => m.ghin_number && m.handicap != null)
    .sort((a, b) => a.handicap - b.handicap)
    .concat(members.filter((m) => !m.ghin_number || m.handicap == null));

  const byPoints = [...members].sort((a, b) => (b.total_points || 0) - (a.total_points || 0));

  const ranked = tab === 'handicap' ? byHandicap : byPoints;

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="bg-gradient-to-b from-green-800 to-green-950 pb-4 px-4 pt-4"
           style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <h1 className="text-2xl font-extrabold text-white">Members</h1>
        <p className="text-green-400 text-sm mt-0.5">{members.length} Sandbaggers</p>

        {/* Tab switcher */}
        <div className="flex gap-2 mt-4">
          {[
            { key: 'handicap', label: 'Handicap' },
            { key: 'points', label: 'Season Points' },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      tab === t.key
                        ? 'bg-green-600 text-white'
                        : 'bg-green-900/40 text-green-400 border border-green-800/50'
                    }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-green-900/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {/* Legend */}
          <p className="text-green-600 text-xs px-1 mb-1">
            {tab === 'handicap'
              ? 'Lower handicap = better rank · Members without GHIN shown at bottom'
              : 'Total points earned across all group events'}
          </p>

          {ranked.map((m, i) => {
            const isMe = m.id === me?.id;
            const noGhin = !m.ghin_number || m.handicap == null;

            return (
              <Link key={m.id} href={isMe ? '/profile' : `/members/${m.id}`}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${
                      isMe
                        ? 'bg-green-800/30 border-green-600/50'
                        : 'bg-green-900/20 border-green-800/30 hover:bg-green-800/30'
                    }`}>

                {/* Rank badge */}
                {tab === 'handicap' && !noGhin ? (
                  <span className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-extrabold ${
                    i === 0 ? 'bg-amber-500 text-black' :
                    i === 1 ? 'bg-slate-400 text-black' :
                    i === 2 ? 'bg-amber-700 text-white' :
                    'bg-green-900 text-green-400'
                  }`}>
                    {i + 1}
                  </span>
                ) : tab === 'points' ? (
                  <span className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-extrabold ${
                    i === 0 ? 'bg-amber-500 text-black' :
                    i === 1 ? 'bg-slate-400 text-black' :
                    i === 2 ? 'bg-amber-700 text-white' :
                    'bg-green-900 text-green-400'
                  }`}>
                    {i + 1}
                  </span>
                ) : (
                  <span className="w-8 h-8 flex-shrink-0 rounded-full bg-green-900/40 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-red-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  </span>
                )}

                <Avatar name={m.name} avatarUrl={m.avatar_url} size="sm" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${isMe ? 'text-green-300' : 'text-white'}`}>
                      {m.name}{isMe ? ' (you)' : ''}
                    </span>
                    {noGhin && (
                      <span className="text-[10px] bg-red-900/40 border border-red-700/40 text-red-400 px-1.5 py-0.5 rounded-full">
                        No GHIN
                      </span>
                    )}
                  </div>
                  {tab === 'handicap'
                    ? <p className="text-green-600 text-xs">{m.ghin_number ? `GHIN #${m.ghin_number}` : 'Not connected'}</p>
                    : <p className="text-green-600 text-xs">{m.wins} wins · {m.events_played} events</p>
                  }
                </div>

                {/* Right value */}
                {tab === 'handicap' ? (
                  m.handicap != null ? (
                    <div className="text-right">
                      <p className="text-white font-extrabold text-lg leading-none">{m.handicap.toFixed(1)}</p>
                      <p className="text-green-600 text-xs">HCP</p>
                    </div>
                  ) : (
                    <span className="text-green-700 text-sm">—</span>
                  )
                ) : (
                  <div className="text-right">
                    <p className="text-amber-400 font-extrabold text-lg leading-none">{Math.round(m.total_points || 0)}</p>
                    <p className="text-green-600 text-xs">pts</p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
