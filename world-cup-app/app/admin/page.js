'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STAGE_LABELS = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final', 'Champion'];
const TABS = ['Record Results', 'Teams', 'Participants', 'Settings'];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [teams, setTeams] = useState([]);
  const [logs, setLogs] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data?.user || data.user.role !== 'admin') {
        router.push('/leaderboard');
      }
    });
  }, [router]);

  async function loadAll() {
    const [teamsRes, logsRes, partRes, settRes] = await Promise.all([
      fetch('/api/admin/teams').then(r => r.json()),
      fetch('/api/admin/results').then(r => r.json()),
      fetch('/api/admin/participants').then(r => r.json()),
      fetch('/api/admin/settings').then(r => r.json()),
    ]);
    setTeams(teamsRes.teams || []);
    setLogs(logsRes.logs || []);
    setParticipants(partRes.participants || []);
    setSettings(settRes.settings || {});
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function recordWin(teamId, winType) {
    const res = await fetch('/api/admin/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, winType }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`${winType === 'group' ? '+1 Group Win' : '+2 Knockout Win'} recorded!`);
      setTeams(prev => prev.map(t => t.id === teamId ? { ...data.team } : t));
      const logsRes = await fetch('/api/admin/results').then(r => r.json());
      setLogs(logsRes.logs || []);
    } else {
      showToast(data.error || 'Error', false);
    }
  }

  async function undoLog(logId) {
    const res = await fetch('/api/admin/results/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId }),
    });
    if (res.ok) {
      showToast('Undone!');
      await loadAll();
    } else {
      showToast('Failed to undo', false);
    }
  }

  async function updateTeam(id, updates) {
    const res = await fetch('/api/admin/teams', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Team updated!');
      setTeams(prev => prev.map(t => t.id === id ? { ...data.team } : t));
    } else {
      showToast(data.error || 'Error', false);
    }
  }

  async function updateSettings(updates) {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (res.ok) {
      setSettings(data.settings || {});
      showToast('Settings saved!');
    } else {
      showToast(data.error || 'Error', false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-60 text-green-400 animate-pulse">Loading admin panel…</div>;
  }

  const picksLocked = settings.picks_locked === '1';

  return (
    <div className="page-enter">
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl font-medium shadow-xl text-sm ${toast.ok ? 'bg-green-700' : 'bg-red-800'} text-white`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${picksLocked ? 'bg-red-800 text-red-200' : 'bg-green-800 text-green-200'}`}>
          Picks {picksLocked ? 'LOCKED' : 'OPEN'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900/60 p-1 rounded-xl">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors ${
              tab === i ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab 0: Record Results */}
      {tab === 0 && (
        <div>
          <p className="text-slate-400 text-sm mb-4">Click a win type to record a result and award points.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {teams.filter(t => t.active).sort((a, b) => b.price - a.price || a.name.localeCompare(b.name)).map(team => (
              <div key={team.id} className={`card p-4 flex items-center gap-3 ${team.eliminated ? 'opacity-50' : ''}`}>
                <span className="text-3xl">{team.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{team.name}</div>
                  <div className="text-xs text-slate-400">
                    {team.group_wins}G + {team.knockout_wins}KO = <span className="text-green-400 font-bold">{team.score} pts</span>
                  </div>
                  {team.stage_order > 0 && (
                    <div className="text-xs text-slate-500">{STAGE_LABELS[team.stage_order]}</div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => recordWin(team.id, 'group')}
                    disabled={team.eliminated}
                    className="px-2.5 py-1 bg-blue-800 hover:bg-blue-700 text-blue-100 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +1 Group
                  </button>
                  <button
                    onClick={() => recordWin(team.id, 'knockout')}
                    disabled={team.eliminated}
                    className="px-2.5 py-1 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +2 K/O
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Match log */}
          <div className="card p-4">
            <h3 className="font-semibold text-white mb-3">Recent Results</h3>
            {logs.length === 0 ? (
              <p className="text-slate-500 text-sm">No results recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto scroll-area">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span>{log.team_flag}</span>
                      <span className="text-white">{log.team_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${log.win_type === 'group' ? 'bg-blue-800 text-blue-200' : 'bg-amber-800 text-amber-200'}`}>
                        {log.win_type === 'group' ? 'Group +1' : 'Knockout +2'}
                      </span>
                    </span>
                    <button
                      onClick={() => undoLog(log.id)}
                      className="text-xs text-red-400 hover:text-red-300 ml-3 flex-shrink-0"
                    >
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Teams */}
      {tab === 1 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-green-900/60">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Team</th>
                <th className="text-center px-2 py-3 text-slate-400 font-medium">Price</th>
                <th className="text-center px-2 py-3 text-slate-400 font-medium">Stage</th>
                <th className="text-center px-2 py-3 text-slate-400 font-medium">Elim</th>
                <th className="text-center px-2 py-3 text-slate-400 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(team => (
                <tr key={team.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span className="text-xl">{team.flag}</span>
                      <span className="text-white font-medium">{team.name}</span>
                      <span className="text-green-400 text-xs">{team.score}pts</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <select
                      value={team.price}
                      onChange={(e) => updateTeam(team.id, { price: parseInt(e.target.value) })}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    >
                      {[1,2,3,5,7].map(p => <option key={p} value={p}>${p}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <select
                      value={team.stage_order}
                      onChange={(e) => updateTeam(team.id, { stage_order: parseInt(e.target.value) })}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
                    >
                      {STAGE_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!team.eliminated}
                      onChange={(e) => updateTeam(team.id, { eliminated: e.target.checked })}
                      className="w-4 h-4 accent-red-500"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!team.active}
                      onChange={(e) => updateTeam(team.id, { active: e.target.checked })}
                      className="w-4 h-4 accent-green-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Participants */}
      {tab === 2 && (
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">{participants.filter(p => p.role !== 'admin').length} participants registered.</p>
          {participants.filter(p => p.role !== 'admin').map(user => (
            <div key={user.id} className="card p-4 cursor-pointer hover:border-green-700" onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">{user.name}</div>
                  <div className="text-xs text-slate-400">{user.email}</div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-xl font-bold text-green-400">{user.total_points}</div>
                    <div className="text-xs text-slate-500">points</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">${user.total_spend}</div>
                    <div className="text-xs text-slate-500">spent</div>
                  </div>
                  <div className="flex gap-0.5">
                    {user.teams.map(t => <span key={t.id} className={t.eliminated ? 'opacity-30' : ''} title={t.name}>{t.flag}</span>)}
                  </div>
                </div>
              </div>
              {expandedUser === user.id && user.teams.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-slate-700 pt-4">
                  {user.teams.map(t => (
                    <div key={t.id} className={`flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 text-xs ${t.eliminated ? 'opacity-40' : ''}`}>
                      <span className="flex items-center gap-1.5">
                        {t.flag}
                        <span className={t.eliminated ? 'line-through text-slate-400' : 'text-white'}>{t.name}</span>
                        <span className="text-slate-500">(${t.price})</span>
                      </span>
                      <span className="text-green-400 font-bold">{t.score}p</span>
                    </div>
                  ))}
                </div>
              )}
              {expandedUser === user.id && user.teams.length === 0 && (
                <div className="mt-4 text-slate-500 text-sm text-center">No picks submitted yet</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Settings */}
      {tab === 3 && (
        <div className="max-w-md space-y-6">
          {/* Lock picks */}
          <div className="card p-6">
            <h3 className="font-semibold text-white mb-1">Picks Lock</h3>
            <p className="text-slate-400 text-sm mb-4">Lock picks when the tournament starts to prevent changes.</p>
            <button
              onClick={() => updateSettings({ picks_locked: picksLocked ? '0' : '1' })}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${
                picksLocked
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : 'bg-red-700 hover:bg-red-600 text-white'
              }`}
            >
              {picksLocked ? '🔓 Unlock Picks' : '🔒 Lock Picks'}
            </button>
          </div>

          {/* Budget & team count */}
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-white mb-1">Pool Rules</h3>
            <div>
              <label className="block text-sm text-green-300 mb-1.5">Budget ($)</label>
              <input
                type="number"
                defaultValue={settings.budget || '14'}
                onBlur={(e) => updateSettings({ budget: e.target.value })}
                className="input w-32"
                min="1"
                max="100"
              />
            </div>
            <div className="flex gap-4">
              <div>
                <label className="block text-sm text-green-300 mb-1.5">Min Teams</label>
                <input
                  type="number"
                  defaultValue={settings.min_teams || '2'}
                  onBlur={(e) => updateSettings({ min_teams: e.target.value })}
                  className="input w-24"
                  min="1" max="10"
                />
              </div>
              <div>
                <label className="block text-sm text-green-300 mb-1.5">Max Teams</label>
                <input
                  type="number"
                  defaultValue={settings.max_teams || '7'}
                  onBlur={(e) => updateSettings({ max_teams: e.target.value })}
                  className="input w-24"
                  min="1" max="10"
                />
              </div>
            </div>
          </div>

          {/* Admin credentials reminder */}
          <div className="card p-4 border-amber-800/40">
            <h3 className="font-semibold text-amber-300 text-sm mb-2">Admin Account</h3>
            <p className="text-slate-400 text-xs">Default login: <span className="text-white">admin@worldcup.app</span> / <span className="text-white">worldcup2026</span></p>
            <p className="text-slate-500 text-xs mt-1">Change the password in production by re-seeding with a new password hash.</p>
          </div>
        </div>
      )}
    </div>
  );
}
