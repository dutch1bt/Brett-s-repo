'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const TYPE_ICONS = {
  tournament: '🏆',
  scramble: '🤝',
  trip: '✈️',
  social: '🍺',
};

const TYPE_COLORS = {
  tournament: 'text-amber-400 bg-amber-400/10 border-amber-500/30',
  scramble: 'text-blue-400 bg-blue-400/10 border-blue-500/30',
  trip: 'text-purple-400 bg-purple-400/10 border-purple-500/30',
  social: 'text-green-400 bg-green-400/10 border-green-500/30',
};

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((d) => { setEvents(d.events || []); setLoading(false); });
  }, []);

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter);

  // Group by year
  const grouped = {};
  for (const e of filtered) {
    const year = e.date.slice(0, 4);
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(e);
  }
  const years = Object.keys(grouped).sort((a, b) => b - a);

  // Compute all-time leaderboard from events
  const [leaderboard, setLeaderboard] = useState([]);
  useEffect(() => {
    // We'll fetch stats via members API
    fetch('/api/members')
      .then((r) => r.json())
      .then((d) => setLeaderboard(d.members || []));
  }, []);

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-green-950/90 backdrop-blur-md border-b border-green-800/50">
        <div className="px-4 pt-4 pb-3" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">Event History</h1>
              <p className="text-green-500 text-xs">All tournaments & results</p>
            </div>
            <Link href="/scoring"
                  className="flex items-center gap-1.5 bg-green-700/30 border border-green-600/40 text-green-300 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-green-700/50 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Live
            </Link>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {['all', 'tournament', 'scramble', 'trip'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === f
                    ? 'bg-green-600 text-white'
                    : 'bg-green-900 text-green-400 hover:bg-green-800'
                }`}
              >
                {f === 'all' ? 'All Events' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* All-time leaderboard */}
        {leaderboard.length > 0 && (
          <div className="card-gold p-4">
            <h2 className="text-amber-400 font-bold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
              <span>🏅</span> All-Time Standings
            </h2>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((m, i) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className={`pos-badge ${i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : 'pos-other'}`}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-green-100 font-medium truncate">{m.name}</span>
                  <div className="text-right">
                    <span className="text-amber-400 font-bold text-sm">{Math.round(m.total_points || 0)} pts</span>
                    <span className="text-green-600 text-xs ml-2">{m.wins}W</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse space-y-2">
              <div className="h-4 w-48 bg-green-800 rounded" />
              <div className="h-3 w-32 bg-green-800 rounded" />
            </div>
          ))
        ) : (
          years.map((year) => (
            <div key={year}>
              <h2 className="text-green-500 text-xs font-bold uppercase tracking-widest mb-2 px-1">{year}</h2>
              <div className="space-y-3">
                {grouped[year].map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`}>
                    <div className="card p-4 hover:bg-green-800/40 transition-colors active:scale-[0.99]">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">{TYPE_ICONS[event.type] || '⛳'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-white text-sm leading-tight">{event.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[event.type]}`}>
                              {event.format || event.type}
                            </span>
                          </div>
                          <p className="text-green-400 text-xs mt-1">{formatDate(event.date)}</p>
                          <p className="text-green-500 text-xs mt-0.5 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            {event.location}
                          </p>
                          {event.participant_count > 0 && (
                            <p className="text-green-600 text-xs mt-1">{event.participant_count} players</p>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
