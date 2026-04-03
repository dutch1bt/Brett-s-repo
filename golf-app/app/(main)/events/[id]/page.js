'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

const MEDAL_COLORS = ['text-amber-400', 'text-gray-300', 'text-amber-600'];
const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 space-y-4 page-enter">
        <button onClick={() => router.back()} className="text-green-400 flex items-center gap-1 text-sm mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-64 bg-green-800 rounded" />
          <div className="h-4 w-40 bg-green-800 rounded" />
        </div>
      </div>
    );
  }

  if (!data?.event) return null;
  const { event, results } = data;

  return (
    <div className="page-enter" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Header Image / Banner */}
      <div className="relative bg-gradient-to-b from-green-800 to-green-950 px-4 pt-4 pb-6">
        <button onClick={() => router.back()}
                className="flex items-center gap-1 text-green-300 text-sm mb-4 hover:text-white">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Events
        </button>

        <div className="text-4xl mb-2">
          {event.type === 'tournament' ? '🏆' : event.type === 'scramble' ? '🤝' : event.type === 'trip' ? '✈️' : '⛳'}
        </div>
        <h1 className="text-2xl font-extrabold text-white">{event.name}</h1>
        <p className="text-green-400 text-sm mt-1">{formatDate(event.date)}</p>
        <p className="text-green-500 text-xs mt-1 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {event.location}
        </p>
        {event.format && (
          <span className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {event.format}
          </span>
        )}
        {event.description && (
          <p className="mt-3 text-green-300 text-sm leading-relaxed">{event.description}</p>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Podium (top 3) */}
        {results.length >= 3 && (
          <div className="card-gold p-4">
            <h2 className="text-amber-400 font-bold text-sm uppercase tracking-wide mb-4">Podium</h2>
            <div className="flex items-end justify-center gap-3">
              {/* 2nd */}
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <Avatar name={results[1]?.user_name} size="sm" />
                <span className="text-xl">🥈</span>
                <p className="text-xs text-gray-300 font-semibold text-center leading-tight">{results[1]?.user_name?.split(' ')[0]}</p>
                <div className="w-full bg-gray-400/30 rounded-t-lg h-12 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-300">{results[1]?.net_score}</span>
                </div>
              </div>
              {/* 1st */}
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <Avatar name={results[0]?.user_name} size="md" />
                <span className="text-2xl">🥇</span>
                <p className="text-xs text-amber-300 font-bold text-center leading-tight">{results[0]?.user_name?.split(' ')[0]}</p>
                <div className="w-full bg-amber-400/30 rounded-t-lg h-20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-amber-400">{results[0]?.net_score}</span>
                </div>
              </div>
              {/* 3rd */}
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <Avatar name={results[2]?.user_name} size="sm" />
                <span className="text-xl">🥉</span>
                <p className="text-xs text-amber-600 font-semibold text-center leading-tight">{results[2]?.user_name?.split(' ')[0]}</p>
                <div className="w-full bg-amber-800/30 rounded-t-lg h-8 flex items-center justify-center">
                  <span className="text-base font-bold text-amber-600">{results[2]?.net_score}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full Leaderboard */}
        {results.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-green-800/50">
              <h2 className="text-white font-bold text-sm">Full Results</h2>
            </div>
            <div className="divide-y divide-green-800/30">
              {/* Table header */}
              <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem] gap-2 px-4 py-2 text-green-600 text-xs font-semibold uppercase tracking-wide">
                <span>#</span>
                <span>Player</span>
                <span className="text-center">Gross</span>
                <span className="text-center">Net</span>
                <span className="text-center">Pts</span>
              </div>
              {results.map((r, i) => (
                <div key={r.id || i}
                     className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem] gap-2 px-4 py-3 items-center hover:bg-green-800/20">
                  <span className={`pos-badge ${i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : 'pos-other'}`}>
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={r.user_name} avatarUrl={r.avatar_url} size="xs" />
                    <div className="min-w-0">
                      <p className="text-green-50 text-sm font-medium truncate">{r.user_name}</p>
                      <p className="text-green-600 text-xs">HCP {r.handicap?.toFixed(1) || '—'}</p>
                    </div>
                  </div>
                  <span className="text-center text-green-300 text-sm font-medium">{r.gross_score || '—'}</span>
                  <span className={`text-center text-sm font-bold ${i < 3 ? MEDAL_COLORS[i] : 'text-green-200'}`}>
                    {r.net_score || '—'}
                  </span>
                  <span className="text-center text-green-500 text-sm">{r.points || 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {results.length === 0 && (
          <div className="text-center py-12 text-green-600">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium">No results recorded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
