'use client';
import { useEffect, useState } from 'react';

const STAGE_LABELS = ['Group Stage', 'R32', 'R16', 'QF', 'SF', 'Final', '🏆 Champion'];

const PRICE_TIERS = [
  { label: '⭐ Favorites', price: 7, color: 'border-amber-400 bg-amber-400/10', badge: 'bg-amber-400 text-black' },
  { label: 'Strong', price: 5, color: 'border-sky-400 bg-sky-400/10', badge: 'bg-sky-400 text-black' },
  { label: 'Good Value', price: 3, color: 'border-orange-400 bg-orange-400/10', badge: 'bg-orange-400 text-black' },
  { label: 'Value', price: 2, color: 'border-slate-400 bg-slate-400/10', badge: 'bg-slate-400 text-black' },
  { label: 'Budget Picks', price: 1, color: 'border-slate-600 bg-slate-600/10', badge: 'bg-slate-600 text-white' },
];

export default function PicksPage() {
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [settings, setSettings] = useState({ budget: 14, min_teams: 2, max_teams: 7, picks_locked: false });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/teams').then((r) => r.json()),
      fetch('/api/picks').then((r) => r.json()),
      fetch('/api/settings').then((r) => (r.ok ? r.json() : {})),
    ]).then(([teamsData, picksData, settingsData]) => {
      setTeams(teamsData.teams || []);
      const pickedIds = new Set((picksData.picks || []).map((p) => p.id));
      setSelected(pickedIds);
      if (settingsData.settings) {
        const s = settingsData.settings;
        setSettings({
          budget: parseInt(s.budget || '14'),
          min_teams: parseInt(s.min_teams || '2'),
          max_teams: parseInt(s.max_teams || '7'),
          picks_locked: s.picks_locked === '1',
        });
      }
      setLoading(false);
    });
  }, []);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function toggle(team) {
    if (settings.picks_locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(team.id)) {
        next.delete(team.id);
      } else {
        if (next.size >= settings.max_teams) return prev;
        const newSpend = spend + team.price;
        if (newSpend > settings.budget) return prev;
        next.add(team.id);
      }
      return next;
    });
  }

  async function savePicks() {
    setSaving(true);
    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIds: [...selected] }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Picks saved!', true);
      } else {
        showToast(data.error || 'Failed to save', false);
      }
    } catch {
      showToast('Network error', false);
    } finally {
      setSaving(false);
    }
  }

  const spend = teams.filter((t) => selected.has(t.id)).reduce((s, t) => s + t.price, 0);
  const remaining = settings.budget - spend;
  const count = selected.size;
  const canSave = count >= settings.min_teams && count <= settings.max_teams && spend <= settings.budget && !settings.picks_locked;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="text-green-400 text-lg animate-pulse">Loading teams…</div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl font-medium shadow-xl text-sm ${
            toast.ok ? 'bg-green-700 text-white' : 'bg-red-800 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">My Picks</h1>

        {settings.picks_locked && (
          <div className="bg-amber-900/50 border border-amber-600 text-amber-300 rounded-xl px-4 py-3 mb-4 text-sm font-medium">
            🔒 Picks are locked — the tournament has started!
          </div>
        )}

        {/* Budget tracker */}
        <div className="card p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${remaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
              ${remaining}
            </span>
            <span className="text-slate-400">remaining of ${settings.budget}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{count}</div>
              <div className="text-xs text-slate-400">teams</div>
            </div>
            <div className="text-slate-600">|</div>
            <div className="text-center">
              <div className="text-sm text-slate-300">min {settings.min_teams} – max {settings.max_teams}</div>
              <div className="text-xs text-slate-500">teams allowed</div>
            </div>
            <button
              onClick={savePicks}
              disabled={!canSave || saving}
              className="btn-primary px-6"
            >
              {saving ? 'Saving…' : 'Save Picks'}
            </button>
          </div>
        </div>
      </div>

      {/* Teams by tier */}
      {PRICE_TIERS.map((tier) => {
        const tierTeams = teams.filter((t) => t.price === tier.price);
        if (tierTeams.length === 0) return null;
        return (
          <div key={tier.price} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-semibold text-slate-300">{tier.label}</h2>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.badge}`}>${tier.price}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {tierTeams.map((team) => {
                const isSelected = selected.has(team.id);
                const wouldExceed = !isSelected && (spend + team.price > settings.budget);
                const atMax = !isSelected && count >= settings.max_teams;
                const disabled = settings.picks_locked || wouldExceed || atMax || team.eliminated;
                return (
                  <button
                    key={team.id}
                    onClick={() => toggle(team)}
                    disabled={disabled}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 text-center
                      transition-all duration-150
                      ${isSelected
                        ? 'border-green-500 bg-green-500/20 scale-[1.02]'
                        : disabled
                          ? 'border-slate-800 bg-slate-900/30 opacity-40 cursor-not-allowed'
                          : `${tier.color} cursor-pointer hover:scale-[1.02]`
                      }
                    `}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 text-green-400 text-xs">✓</span>
                    )}
                    {team.eliminated && (
                      <span className="absolute top-1.5 left-1.5 text-xs">❌</span>
                    )}
                    <span className="text-3xl leading-none">{team.flag}</span>
                    <span className="text-xs font-semibold text-white leading-tight">{team.name}</span>
                    {team.score > 0 && (
                      <span className="text-xs text-green-400 font-bold">{team.score} pts</span>
                    )}
                    {team.stage_order > 0 && (
                      <span className="text-[10px] text-slate-400">{STAGE_LABELS[team.stage_order]}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Save button at bottom on mobile */}
      <div className="sticky bottom-4 flex justify-center mt-4 sm:hidden">
        <button
          onClick={savePicks}
          disabled={!canSave || saving}
          className="btn-primary px-8 shadow-2xl"
        >
          {saving ? 'Saving…' : `Save ${count} Pick${count !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
