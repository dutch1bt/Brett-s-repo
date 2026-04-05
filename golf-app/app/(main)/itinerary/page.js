'use client';

import { useState, useEffect } from 'react';

const TYPE_CONFIG = {
  tournament: { emoji: '🏆', color: 'border-amber-500/50 bg-amber-500/10', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', label: 'Tournament' },
  scramble:   { emoji: '🤝', color: 'border-blue-500/50 bg-blue-500/10', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30', label: 'Scramble' },
  trip:       { emoji: '✈️', color: 'border-purple-500/50 bg-purple-500/10', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30', label: 'Trip' },
  social:     { emoji: '🍺', color: 'border-green-500/50 bg-green-500/10', badge: 'bg-green-500/20 text-green-300 border-green-500/30', label: 'Social' },
  event:      { emoji: '📅', color: 'border-green-700/50 bg-green-800/20', badge: 'bg-green-700/20 text-green-400 border-green-700/30', label: 'Event' },
};

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    full: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    short: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    dayNum: d.getDate(),
    isUpcoming: d >= new Date(),
    isPast: d < new Date(new Date().setHours(0,0,0,0)),
  };
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00'); target.setHours(0,0,0,0);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return 'Today!';
  if (diff === 1) return 'Tomorrow!';
  if (diff < 0) return null;
  if (diff < 7) return `${diff} days away`;
  if (diff < 30) return `${Math.round(diff / 7)} weeks away`;
  return `${Math.round(diff / 30)} months away`;
}

export default function ItineraryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    fetch('/api/itinerary')
      .then((r) => r.json())
      .then((d) => { setItems(d.items || []); setLoading(false); });
  }, []);

  const today = new Date(); today.setHours(0,0,0,0);
  const filtered = items.filter((item) => {
    const d = new Date(item.date + 'T00:00:00');
    if (filter === 'upcoming') return d >= today;
    if (filter === 'past') return d < today;
    return true;
  });

  // Next upcoming event
  const nextEvent = items.find((i) => new Date(i.date + 'T00:00:00') >= today);

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-green-950/90 backdrop-blur-md border-b border-green-800/50">
        <div className="px-4 pt-4 pb-3" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
          <h1 className="text-lg font-bold text-white">2026 Schedule</h1>
          <p className="text-green-500 text-xs">Full year itinerary</p>
          <div className="flex gap-2 mt-3">
            {['upcoming', 'all', 'past'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        filter === f ? 'bg-green-600 text-white' : 'bg-green-900 text-green-400 hover:bg-green-800'
                      }`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Next event countdown */}
        {nextEvent && filter !== 'past' && (
          <div className="card-gold p-4">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">Next Up</p>
            <div className="flex items-center gap-3">
              <div className="text-3xl">{TYPE_CONFIG[nextEvent.type]?.emoji || '📅'}</div>
              <div className="flex-1">
                <p className="text-white font-bold">{nextEvent.title}</p>
                <p className="text-green-400 text-xs">{formatDate(nextEvent.date).full}</p>
                {nextEvent.time && <p className="text-green-500 text-xs">🕐 {nextEvent.time}</p>}
              </div>
              <div className="text-right">
                <p className="text-amber-400 font-bold text-sm">{daysUntil(nextEvent.date)}</p>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-24" />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-green-600">
            <div className="text-4xl mb-3">📅</div>
            <p>No events for this filter</p>
          </div>
        )}

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[2.1rem] top-0 bottom-0 w-0.5 bg-green-800/50" />

          <div className="space-y-4">
            {filtered.map((item) => {
              const df = formatDate(item.date);
              const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.event;
              const isExpanded = expanded === item.id;
              const countdown = daysUntil(item.date);
              const isPast = df.isPast;

              return (
                <div key={item.id} className="flex gap-4">
                  {/* Date bubble */}
                  <div className={`flex-shrink-0 w-[4.2rem] flex flex-col items-center z-10 ${isPast ? 'opacity-50' : ''}`}>
                    <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center border-2 ${isPast ? 'bg-green-950 border-green-800' : 'bg-green-900 border-green-600'}`}>
                      <p className="text-green-400 text-xs font-bold leading-none">{df.month}</p>
                      <p className={`text-xl font-extrabold leading-none ${isPast ? 'text-green-600' : 'text-white'}`}>{df.dayNum}</p>
                    </div>
                    <p className="text-green-600 text-xs mt-1">{df.day}</p>
                  </div>

                  {/* Card */}
                  <div className={`flex-1 card border-l-4 ${cfg.color} ${isPast ? 'opacity-60' : ''} overflow-hidden`}>
                    <button
                      className="w-full text-left p-4 pb-3"
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white text-sm leading-tight">{item.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.badge}`}>
                              {cfg.label}
                            </span>
                          </div>
                          {item.time && (
                            <p className="text-green-400 text-xs mt-1">🕐 {item.time}</p>
                          )}
                          {item.location && (
                            <p className="text-green-500 text-xs mt-0.5 flex items-center gap-1">
                              📍 {item.location}
                            </p>
                          )}
                          {countdown && !isPast && (
                            <p className="text-amber-400 text-xs font-semibold mt-1">{countdown}</p>
                          )}
                        </div>
                        <svg className={`w-4 h-4 text-green-600 mt-0.5 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2 border-t border-green-800/40 pt-3">
                        {item.description && (
                          <p className="text-green-200 text-sm leading-relaxed">{item.description}</p>
                        )}
                        {item.notes && (
                          <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-3">
                            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide mb-1">📋 Notes</p>
                            <p className="text-amber-200 text-sm leading-relaxed">{item.notes}</p>
                          </div>
                        )}
                        <p className="text-green-600 text-xs">{df.full}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
