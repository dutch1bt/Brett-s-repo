'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [tournaments, setTournaments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tiers, setTiers] = useState({});
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [showNewTournament, setShowNewTournament] = useState(false);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTournament, setNewTournament] = useState({ name: '', espn_event_id: '', buy_in: 20 });
  const [newTeam, setNewTeam] = useState({ team_name: '', owner_name: '', payment_status: 'paid', picks: ['', '', '', ''] });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      loadTeams(selectedTournament);
      loadTiers(selectedTournament);
    }
  }, [selectedTournament]);

  async function loadTournaments() {
    const res = await fetch('/api/admin/tournaments');
    const d = await res.json();
    setTournaments(d.tournaments || []);
    if (d.tournaments?.length && !selectedTournament) {
      setSelectedTournament(d.tournaments[0].id);
    }
  }

  async function loadTeams(tid) {
    const res = await fetch(`/api/teams?tournamentId=${tid}`);
    const d = await res.json();
    setTeams(d.teams || []);
  }

  async function loadTiers(tid) {
    const res = await fetch(`/api/admin/tiers?tournamentId=${tid}`);
    const d = await res.json();
    const grouped = {};
    for (const t of d.tiers || []) {
      if (!grouped[t.tier_number]) grouped[t.tier_number] = [];
      grouped[t.tier_number].push(t.player_name);
    }
    setTiers(grouped);
  }

  async function createTournament() {
    setSaving(true);
    const res = await fetch('/api/admin/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTournament),
    });
    const d = await res.json();
    setMsg('Tournament created!');
    setShowNewTournament(false);
    setNewTournament({ name: '', espn_event_id: '', buy_in: 20 });
    await loadTournaments();
    setSelectedTournament(d.id);
    setSaving(false);
  }

  async function createTeam() {
    setSaving(true);
    const picks = newTeam.picks
      .map((p, i) => ({ tier_number: i + 1, player_name: p }))
      .filter((p) => p.player_name.trim());

    await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newTeam, tournament_id: selectedTournament, picks }),
    });
    setMsg('Team added!');
    setShowNewTeam(false);
    setNewTeam({ team_name: '', owner_name: '', payment_status: 'paid', picks: ['', '', '', ''] });
    await loadTeams(selectedTournament);
    setSaving(false);
  }

  async function togglePayment(team) {
    const newStatus = team.payment_status === 'paid' ? 'unpaid' : 'paid';
    await fetch('/api/admin/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: team.id, payment_status: newStatus }),
    });
    await loadTeams(selectedTournament);
  }

  async function deleteTeam(id) {
    if (!confirm('Delete this team?')) return;
    await fetch(`/api/admin/teams?id=${id}`, { method: 'DELETE' });
    await loadTeams(selectedTournament);
  }

  const tournament = tournaments.find((t) => t.id === selectedTournament);
  const paidCount = teams.filter((t) => t.payment_status === 'paid').length;
  const totalPot = paidCount * (tournament?.buy_in || 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-masters-yellow">Admin</h1>
        <Link href="/" className="text-sm text-masters-green hover:text-green-300">← Scoreboard</Link>
      </div>

      {msg && (
        <div className="mb-4 bg-green-900 border border-green-600 text-green-300 rounded p-3 text-sm">
          {msg}
        </div>
      )}

      {/* Tournament selector */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {tournaments.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTournament(t.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
              selectedTournament === t.id
                ? 'bg-masters-green border-masters-yellow text-masters-yellow'
                : 'bg-gray-800 border-gray-600 text-gray-300'
            }`}
          >
            {t.name}
          </button>
        ))}
        <button
          onClick={() => setShowNewTournament(!showNewTournament)}
          className="px-4 py-2 rounded-full text-sm border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-white"
        >
          + New Tournament
        </button>
      </div>

      {/* New Tournament Form */}
      {showNewTournament && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
          <h3 className="font-semibold mb-3">New Tournament</h3>
          <div className="space-y-3">
            <input
              placeholder="Tournament name (e.g. The Masters 2026)"
              value={newTournament.name}
              onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
            />
            <input
              placeholder="ESPN Event ID (optional, e.g. 20264400)"
              value={newTournament.espn_event_id}
              onChange={(e) => setNewTournament({ ...newTournament, espn_event_id: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Buy-in ($)"
              value={newTournament.buy_in}
              onChange={(e) => setNewTournament({ ...newTournament, buy_in: parseInt(e.target.value) })}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
            />
            <button
              onClick={createTournament}
              disabled={saving || !newTournament.name}
              className="bg-masters-green text-masters-yellow px-4 py-2 rounded font-semibold disabled:opacity-50"
            >
              Create Tournament
            </button>
          </div>
        </div>
      )}

      {tournament && (
        <>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
            <div className="flex flex-wrap gap-6 text-sm">
              <div><span className="text-gray-400">Buy-in:</span> <strong>${tournament.buy_in}</strong></div>
              <div><span className="text-gray-400">Entries:</span> <strong>{teams.length}</strong></div>
              <div><span className="text-gray-400">Paid:</span> <strong className="text-green-400">{paidCount}</strong></div>
              <div><span className="text-gray-400">Total Pot:</span> <strong className="text-green-400">${totalPot}</strong></div>
              <div><span className="text-gray-400">ESPN ID:</span> <strong>{tournament.espn_event_id || 'not set'}</strong></div>
              <div><span className="text-gray-400">Status:</span> <strong>{tournament.status}</strong></div>
            </div>
          </div>

          {/* Teams list */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Teams ({teams.length})</h2>
            <button
              onClick={() => setShowNewTeam(!showNewTeam)}
              className="bg-masters-green text-masters-yellow text-sm px-3 py-1 rounded font-semibold"
            >
              + Add Team
            </button>
          </div>

          {/* New Team Form */}
          {showNewTeam && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
              <h3 className="font-semibold mb-3">Add Team</h3>
              <div className="space-y-3">
                <input
                  placeholder="Team name"
                  value={newTeam.team_name}
                  onChange={(e) => setNewTeam({ ...newTeam, team_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
                />
                <input
                  placeholder="Owner name"
                  value={newTeam.owner_name}
                  onChange={(e) => setNewTeam({ ...newTeam, owner_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
                />
                <select
                  value={newTeam.payment_status}
                  onChange={(e) => setNewTeam({ ...newTeam, payment_status: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
                >
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
                {[1, 2, 3, 4].map((tier) => (
                  <div key={tier}>
                    <label className="text-xs text-gray-400 mb-1 block">Tier {tier} Pick</label>
                    {tiers[tier]?.length ? (
                      <select
                        value={newTeam.picks[tier - 1]}
                        onChange={(e) => {
                          const picks = [...newTeam.picks];
                          picks[tier - 1] = e.target.value;
                          setNewTeam({ ...newTeam, picks });
                        }}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
                      >
                        <option value="">-- Select Tier {tier} Player --</option>
                        {tiers[tier].map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : (
                      <input
                        placeholder={`Tier ${tier} player name`}
                        value={newTeam.picks[tier - 1]}
                        onChange={(e) => {
                          const picks = [...newTeam.picks];
                          picks[tier - 1] = e.target.value;
                          setNewTeam({ ...newTeam, picks });
                        }}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                ))}
                <button
                  onClick={createTeam}
                  disabled={saving || !newTeam.team_name || !newTeam.owner_name}
                  className="bg-masters-green text-masters-yellow px-4 py-2 rounded font-semibold disabled:opacity-50"
                >
                  Add Team
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {teams.map((team) => (
              <div key={team.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-semibold">{team.team_name}</div>
                  <div className="text-sm text-gray-400">{team.owner_name}</div>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => togglePayment(team)}
                    className={`text-xs px-3 py-1 rounded-full border ${
                      team.payment_status === 'paid'
                        ? 'border-green-600 text-green-400 bg-green-950'
                        : 'border-red-600 text-red-400 bg-red-950'
                    }`}
                  >
                    {team.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                  </button>
                  <button
                    onClick={() => deleteTeam(team.id)}
                    className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-400 hover:text-red-400 hover:border-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
