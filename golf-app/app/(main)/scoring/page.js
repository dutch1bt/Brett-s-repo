'use client';

import { useState, useEffect, useCallback } from 'react';
import Avatar from '@/components/Avatar';

const PAR = [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4]; // Standard par layout

function scoreColor(score, par) {
  const diff = score - par;
  if (diff <= -2) return 'text-yellow-300 font-bold'; // Eagle
  if (diff === -1) return 'text-green-400 font-bold'; // Birdie
  if (diff === 0) return 'text-white'; // Par
  if (diff === 1) return 'text-red-400'; // Bogey
  if (diff === 2) return 'text-red-500'; // Double
  return 'text-red-600 font-bold'; // Worse
}

function scoreBg(score, par) {
  const diff = score - par;
  if (diff <= -2) return 'bg-yellow-400/20 border-yellow-400/40';
  if (diff === -1) return 'bg-green-400/20 border-green-400/40';
  if (diff === 0) return 'bg-white/10 border-white/20';
  if (diff === 1) return 'bg-red-400/10 border-red-400/20';
  return 'bg-red-500/10 border-red-500/20';
}

export default function ScoringPage() {
  const [activeEvents, setActiveEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myScores, setMyScores] = useState({});
  const [savingHole, setSavingHole] = useState(null);
  const [me, setMe] = useState(null);
  const [view, setView] = useState('leaderboard'); // 'leaderboard' | 'scorecard'
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setMe(d.user));
    fetch('/api/scoring').then((r) => r.json()).then((d) => {
      setActiveEvents(d.activeEvents || []);
      setLoading(false);
    });
  }, []);

  const loadScores = useCallback(async (eventId) => {
    const res = await fetch(`/api/scoring?event_id=${eventId}`);
    const data = await res.json();
    setScoreData(data);
    // Pre-populate my scores
    if (me && data.players) {
      const myData = data.players.find((p) => p.user_id === me.id);
      if (myData) setMyScores(myData.holes);
    }
    setLastRefresh(new Date());
  }, [me]);

  useEffect(() => {
    if (!selectedEvent) return;
    loadScores(selectedEvent.id);
    const interval = setInterval(() => loadScores(selectedEvent.id), 30000);
    return () => clearInterval(interval);
  }, [selectedEvent, loadScores]);

  async function saveScore(hole, score) {
    if (!selectedEvent) return;
    setSavingHole(hole);
    setMyScores((prev) => ({ ...prev, [hole]: score }));
    try {
      await fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: selectedEvent.id, hole, score }),
      });
      await loadScores(selectedEvent.id);
    } finally {
      setSavingHole(null);
    }
  }

  const myTotal = Object.values(myScores).reduce((s, v) => s + v, 0);
  const myHolesPlayed = Object.keys(myScores).length;
  const myTotalPar = PAR.slice(0, myHolesPlayed).reduce((s, v) => s + v, 0);

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-green-950/90 backdrop-blur-md border-b border-green-800/50">
        <div className="px-4 pt-4 pb-3" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center gap-2">
            <div className="live-dot w-2.5 h-2.5 bg-red-500 rounded-full" />
            <h1 className="text-lg font-bold text-white">Live Scoring</h1>
          </div>
          {lastRefresh && (
            <p className="text-green-600 text-xs">Updated {lastRefresh.toLocaleTimeString()}</p>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading && (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-16" />)}
          </div>
        )}

        {!loading && activeEvents.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">⛳</div>
            <h2 className="text-white font-bold text-xl mb-2">No Active Event</h2>
            <p className="text-green-500 text-sm">Live scoring will appear here when a round is in progress.</p>
          </div>
        )}

        {!selectedEvent && activeEvents.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-green-400 text-sm font-semibold">Select Active Event</h2>
            {activeEvents.map((ev) => (
              <button key={ev.id} onClick={() => setSelectedEvent(ev)}
                      className="card w-full p-4 text-left hover:bg-green-800/40 transition-colors">
                <p className="text-white font-bold">{ev.name}</p>
                <p className="text-green-500 text-sm mt-1">{ev.location}</p>
              </button>
            ))}
          </div>
        )}

        {selectedEvent && scoreData && (
          <>
            {/* Event info + back */}
            <div className="flex items-center gap-3">
              <button onClick={() => { setSelectedEvent(null); setScoreData(null); }}
                      className="text-green-400 hover:text-green-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <div>
                <p className="text-white font-bold text-sm">{selectedEvent.name}</p>
                <p className="text-green-500 text-xs">{selectedEvent.location}</p>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex bg-green-900/60 rounded-xl p-1 gap-1">
              {['leaderboard', 'scorecard'].map((v) => (
                <button key={v} onClick={() => setView(v)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          view === v ? 'bg-green-600 text-white' : 'text-green-400'
                        }`}>
                  {v === 'leaderboard' ? 'Leaderboard' : 'My Scorecard'}
                </button>
              ))}
            </div>

            {/* Leaderboard */}
            {view === 'leaderboard' && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-green-800/50">
                  <h2 className="text-white font-bold text-sm">Current Standings</h2>
                </div>
                {scoreData.players?.length === 0 && (
                  <div className="text-center py-8 text-green-600 text-sm">No scores entered yet</div>
                )}
                <div className="divide-y divide-green-800/30">
                  {(scoreData.players || []).map((player, i) => {
                    const scoredPar = PAR.slice(0, player.holesPlayed).reduce((s, v) => s + v, 0);
                    const diff = player.total - scoredPar;
                    return (
                      <div key={player.user_id} className="flex items-center gap-3 px-4 py-3">
                        <span className={`pos-badge ${i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : 'pos-other'}`}>
                          {i + 1}
                        </span>
                        <Avatar name={player.user_name} avatarUrl={player.avatar_url} size="xs" />
                        <div className="flex-1 min-w-0">
                          <p className="text-green-50 text-sm font-semibold truncate">{player.user_name}</p>
                          <p className="text-green-600 text-xs">{player.holesPlayed} holes played</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-lg leading-none ${diff < 0 ? 'text-green-400' : diff === 0 ? 'text-white' : 'text-red-400'}`}>
                            {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
                          </p>
                          <p className="text-green-600 text-xs">{player.total} gross</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* My Scorecard */}
            {view === 'scorecard' && me && (
              <div className="space-y-3">
                {/* My total */}
                <div className="card p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-green-400 text-xs font-semibold uppercase tracking-wide">My Score</p>
                      <p className="text-3xl font-extrabold text-white">{myTotal || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 text-xs">vs Par</p>
                      <p className={`text-2xl font-bold ${myTotal - myTotalPar < 0 ? 'text-green-400' : myTotal - myTotalPar === 0 ? 'text-white' : 'text-red-400'}`}>
                        {myHolesPlayed === 0 ? '—' : myTotal - myTotalPar === 0 ? 'E' : `${myTotal - myTotalPar > 0 ? '+' : ''}${myTotal - myTotalPar}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 text-xs">Holes</p>
                      <p className="text-2xl font-bold text-white">{myHolesPlayed}/18</p>
                    </div>
                  </div>
                </div>

                {/* Hole grid */}
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-green-800/50">
                    <p className="text-white font-bold text-sm">Enter Scores</p>
                    <p className="text-green-500 text-xs">Tap a score to update</p>
                  </div>
                  <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-green-800/30">
                    {PAR.map((par, idx) => {
                      const hole = idx + 1;
                      const score = myScores[hole];
                      const saving = savingHole === hole;
                      return (
                        <div key={hole} className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-green-400 text-xs font-bold">Hole {hole}</p>
                              <p className="text-green-600 text-xs">Par {par}</p>
                            </div>
                            {saving && (
                              <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {[par - 2, par - 1, par, par + 1, par + 2, par + 3].filter((s) => s >= 1 && s <= 12).map((s) => (
                              <button
                                key={s}
                                onClick={() => saveScore(hole, s)}
                                className={`w-8 h-8 rounded-lg text-sm font-bold border transition-all ${
                                  score === s
                                    ? `${scoreBg(s, par)} ${scoreColor(s, par)} scale-110`
                                    : 'bg-green-900/40 border-green-700/30 text-green-400 hover:bg-green-800/50'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
