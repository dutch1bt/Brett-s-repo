'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const STAGE_LABELS = {
  0: 'Group Stage',
  1: 'Round of 32',
  2: 'Round of 16',
  3: 'Quarterfinals',
  4: 'Semifinals',
  5: 'Final',
  6: 'Champion',
};

const TABS = ['Record Results', 'Update Teams', 'Participants', 'Settings'];

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
      ${toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'}`}>
      {toast.msg}
    </div>
  );
}

// Tab 1: Record Results
function RecordResultsTab() {
  const [teams, setTeams] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [working, setWorking] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    const [teamsRes, logsRes] = await Promise.all([
      fetch('/api/admin/teams'),
      fetch('/api/admin/results'),
    ]);
    const [teamsData, logsData] = await Promise.all([teamsRes.json(), logsRes.json()]);
    setTeams((teamsData.teams || []).filter((t) => t.active));
    setLogs(logsData.logs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function recordWin(teamId, winType) {
    setWorking(`${teamId}-${winType}`);
    try {
      const res = await fetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, winType }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Win recorded for ${data.team.name}!`);
        load();
      } else {
        showToast(data.error || 'Failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setWorking(null);
    }
  }

  async function undoLog(logId) {
    try {
      const res = await fetch('/api/admin/results/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      });
      if (res.ok) {
        showToast('Undone!');
        load();
      } else {
        showToast('Undo failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  }

  if (loading) return <div className="text-green-400 animate-pulse py-8 text-center">Loading teams...</div>;

  return (
    <div>
      <Toast toast={toast} />
      <h2 className="text-lg font-semibold text-white mb-4">Record Match Results</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {teams.map((team) => (
          <div
            key={team.id}
            className={`bg-slate-900 border rounded-xl p-3 ${
              team.eliminated ? 'border-red-900/40 opacity-60' : 'border-green-900/40'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{team.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm truncate">{team.name}</div>
                <div className="text-xs text-slate-400">
                  {STAGE_LABELS[team.stage_order] || 'Group Stage'} · {team.score} pts
                  {team.eliminated ? ' · Eliminated' : ''}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => recordWin(team.id, 'group')}
                disabled={!!working || team.eliminated}
                className="flex-1 text-xs font-semibold py-1.5 px-2 rounded-lg bg-blue-900/50 hover:bg-blue-800 text-blue-300 border border-blue-800/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {working === `${team.id}-group` ? '...' : 'Group Win +1'}
              </button>
              <button
                onClick={() => recordWin(team.id, 'knockout')}
                disabled={!!working || team.eliminated}
                className="flex-1 text-xs font-semibold py-1.5 px-2 rounded-lg bg-green-900/50 hover:bg-green-800 text-green-300 border border-green-800/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {working === `${team.id}-knockout` ? '...' : 'KO Win +2'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-base font-semibold text-white mb-3">Recent Results (last 10)</h3>
        {logs.length === 0 ? (
          <p className="text-slate-500 text-sm">No results recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{log.team_flag}</span>
                  <div>
                    <span className="text-sm text-white font-medium">{log.team_name}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {log.win_type === 'group' ? 'Group Win' : 'Knockout Win'} · +{log.points_awarded}pts
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => undoLog(log.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-900/20 hover:bg-red-900/40 transition-colors"
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Tab 2: Update Teams
function UpdateTeamsTab() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [toast, setToast] = useState(null);
  const [edits, setEdits] = useState({});

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch('/api/admin/teams')
      .then((r) => r.json())
      .then((data) => {
        setTeams(data.teams || []);
        setLoading(false);
      });
  }, []);

  function setEdit(teamId, field, value) {
    setEdits((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], [field]: value },
    }));
  }

  function getVal(team, field) {
    if (edits[team.id] && field in edits[team.id]) return edits[team.id][field];
    return team[field];
  }

  async function saveTeam(team) {
    setSaving(team.id);
    try {
      const changes = edits[team.id] || {};
      const res = await fetch('/api/admin/teams', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: team.id, ...changes }),
      });
      const data = await res.json();
      if (res.ok) {
        setTeams((prev) => prev.map((t) => (t.id === data.team.id ? data.team : t)));
        setEdits((prev) => { const n = { ...prev }; delete n[team.id]; return n; });
        showToast(`${team.name} updated!`);
      } else {
        showToast(data.error || 'Failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="text-green-400 animate-pulse py-8 text-center">Loading teams...</div>;

  return (
    <div>
      <Toast toast={toast} />
      <h2 className="text-lg font-semibold text-white mb-4">Update Teams</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <th className="text-left py-2 px-2">Team</th>
              <th className="text-center py-2 px-2 w-16">Price</th>
              <th className="text-center py-2 px-2 w-28">Stage</th>
              <th className="text-center py-2 px-2 w-16">Elim.</th>
              <th className="text-center py-2 px-2 w-16">Active</th>
              <th className="py-2 px-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const isDirty = !!edits[team.id] && Object.keys(edits[team.id]).length > 0;
              return (
                <tr key={team.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{team.flag}</span>
                      <div>
                        <div className="font-medium text-white">{team.name}</div>
                        <div className="text-xs text-slate-500">{team.confederation} · {team.score || 0}pts</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={getVal(team, 'price')}
                      onChange={(e) => setEdit(team.id, 'price', parseInt(e.target.value))}
                      className="w-14 bg-slate-800 border border-slate-700 rounded-lg text-center text-white text-sm py-1"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <select
                      value={getVal(team, 'stage_order')}
                      onChange={(e) => setEdit(team.id, 'stage_order', parseInt(e.target.value))}
                      className="bg-slate-800 border border-slate-700 rounded-lg text-white text-xs py-1 w-full"
                    >
                      {Object.entries(STAGE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!getVal(team, 'eliminated')}
                      onChange={(e) => setEdit(team.id, 'eliminated', e.target.checked)}
                      className="w-4 h-4 accent-red-500"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!getVal(team, 'active')}
                      onChange={(e) => setEdit(team.id, 'active', e.target.checked)}
                      className="w-4 h-4 accent-green-500"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <button
                      onClick={() => saveTeam(team)}
                      disabled={!isDirty || saving === team.id}
                      className="text-xs px-2 py-1 rounded-lg bg-green-700 hover:bg-green-600 text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {saving === team.id ? '...' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Tab 3: Participants
function ParticipantsTab() {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/participants')
      .then((r) => r.json())
      .then((data) => {
        setParticipants(data.participants || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-green-400 animate-pulse py-8 text-center">Loading participants...</div>;

  const members = participants.filter((p) => p.role !== 'admin');

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">
        Participants ({members.length})
      </h2>
      {members.length === 0 ? (
        <p className="text-slate-500 text-sm">No participants yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <th className="text-left py-2 px-3">Name</th>
                <th className="text-left py-2 px-3 hidden sm:table-cell">Email</th>
                <th className="text-left py-2 px-3">Teams</th>
                <th className="text-right py-2 px-3">Spend</th>
                <th className="text-right py-2 px-3">Pts</th>
              </tr>
            </thead>
            <tbody>
              {[...members]
                .sort((a, b) => b.total_points - a.total_points || b.max_stage_order - a.max_stage_order)
                .map((p, idx) => (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-900/30">
                    <td className="py-2 px-3">
                      <div className="font-medium text-white">{p.name}</div>
                      <div className="text-xs text-slate-500">#{idx + 1}</div>
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-xs hidden sm:table-cell">{p.email}</td>
                    <td className="py-2 px-3">
                      <div className="flex gap-0.5 flex-wrap">
                        {p.teams.map((t) => (
                          <span
                            key={t.id}
                            className={`text-base ${t.eliminated ? 'opacity-30' : ''}`}
                            title={`${t.name} ($${t.price}) ${t.score}pts`}
                          >
                            {t.flag}
                          </span>
                        ))}
                        {p.teams.length === 0 && <span className="text-slate-600 text-xs italic">No picks</span>}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300 font-medium">${p.total_spend}</td>
                    <td className="py-2 px-3 text-right font-bold text-green-400">{p.total_points}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Tab 4: Settings
function SettingsTab() {
  const [settings, setSettings] = useState({ picks_locked: '0', budget: '14', min_teams: '2', max_teams: '7' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
        setLoading(false);
      });
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        showToast('Settings saved!');
      } else {
        showToast(data.error || 'Failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleLock() {
    const newLocked = settings.picks_locked === '1' ? '0' : '1';
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks_locked: newLocked }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        showToast(newLocked === '1' ? 'Picks locked!' : 'Picks unlocked!');
      } else {
        showToast('Failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-green-400 animate-pulse py-8 text-center">Loading settings...</div>;

  const isLocked = settings.picks_locked === '1';

  return (
    <div>
      <Toast toast={toast} />
      <h2 className="text-lg font-semibold text-white mb-6">Pool Settings</h2>

      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white text-base">
              {isLocked ? '🔒 Picks are Locked' : '🔓 Picks are Open'}
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              {isLocked
                ? 'Users cannot change their picks. Unlock to allow changes.'
                : 'Users can freely change their picks. Lock when the tournament starts.'}
            </p>
          </div>
          <button
            onClick={toggleLock}
            disabled={saving}
            className={`relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none ${
              isLocked ? 'bg-red-600' : 'bg-green-600'
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                isLocked ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-white">Budget &amp; Team Rules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-green-300 mb-1.5">Budget ($)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.budget}
              onChange={(e) => setSettings((s) => ({ ...s, budget: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm text-green-300 mb-1.5">Min Teams</label>
            <input
              type="number"
              min="1"
              max="20"
              value={settings.min_teams}
              onChange={(e) => setSettings((s) => ({ ...s, min_teams: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm text-green-300 mb-1.5">Max Teams</label>
            <input
              type="number"
              min="1"
              max="20"
              value={settings.max_teams}
              onChange={(e) => setSettings((s) => ({ ...s, max_teams: e.target.value }))}
              className="input"
            />
          </div>
        </div>
        <button onClick={saveSettings} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="mt-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl text-xs text-slate-500 space-y-1">
        <p><strong className="text-slate-400">Scoring:</strong> Group stage win = 1 pt, Knockout win = 2 pts</p>
        <p><strong className="text-slate-400">Tiebreaker:</strong> User whose team advanced furthest wins ties</p>
        <p><strong className="text-slate-400">Stage order:</strong> 0=Group, 1=R32, 2=R16, 3=QF, 4=SF, 5=Final, 6=Champion</p>
      </div>
    </div>
  );
}

// Main Admin Page
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user || data.user.role !== 'admin') {
          router.push('/leaderboard');
        } else {
          setUser(data.user);
          setChecking(false);
        }
      })
      .catch(() => router.push('/leaderboard'));
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-green-400 animate-pulse">Checking permissions...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <span className="text-sm text-slate-400">{user?.name}</span>
      </div>

      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-none px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === i
                ? 'bg-green-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 0 && <RecordResultsTab />}
        {activeTab === 1 && <UpdateTeamsTab />}
        {activeTab === 2 && <ParticipantsTab />}
        {activeTab === 3 && <SettingsTab />}
      </div>
    </div>
  );
}
