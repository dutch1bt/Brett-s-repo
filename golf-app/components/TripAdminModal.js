'use client';

import { useState, useEffect } from 'react';

const DAYS = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TYPES = ['activity', 'golf', 'meal', 'social', 'travel', 'info'];

function blankItinerary() {
  return { day: 'Thursday', time: '', description: '', location: '', type: 'activity', sort_order: 0 };
}
function blankTeeTime() {
  return { day: 'Thursday', round_name: '', course: '', tee_time: '', players: '' };
}
function blankRoom() {
  return { room_name: '', player_name: '' };
}
function blankPlayer() {
  return { name: '', handicap: '', hcp_80: '', hcp_100: '', hcp_9hole: '', team: '' };
}
function blankPayment() {
  return { player_name: '', item: '', amount: '', venmo_to: '', paid: false };
}

async function api(body) {
  const r = await fetch('/api/trip', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export default function TripAdminModal({ tripData, onClose, onSaved }) {
  const { trip, itinerary = [], teeTimes = [], rooms = [], players = [], payments = [] } = tripData || {};

  const [section, setSection] = useState('info');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  // ── Info ──
  const [info, setInfo] = useState({
    name: trip?.name || '',
    location: trip?.location || '',
    dates_text: trip?.dates_text || '',
    hotel: trip?.hotel || '',
    notes: trip?.notes || '',
  });

  // ── Itinerary ──
  const [items, setItems] = useState(
    itinerary.length ? itinerary.map((i) => ({ ...i })) : [blankItinerary()]
  );

  // ── Tee Times ──
  const [tees, setTees] = useState(
    teeTimes.length
      ? teeTimes.map((t) => ({ ...t, players: Array.isArray(t.players) ? t.players.join(', ') : t.players || '' }))
      : [blankTeeTime()]
  );

  // ── Rooms ──
  const [roomRows, setRoomRows] = useState(
    rooms.length ? rooms.map((r) => ({ ...r })) : [blankRoom()]
  );

  // ── Players ──
  const [playerRows, setPlayerRows] = useState(
    players.length ? players.map((p) => ({ ...p })) : [blankPlayer()]
  );

  // ── Payments ──
  const [paymentRows, setPaymentRows] = useState(
    payments.length ? payments.map((p) => ({ ...p })) : [blankPayment()]
  );

  function flash(msg) {
    setSaved(msg);
    setTimeout(() => setSaved(''), 2500);
  }

  // ── Save handlers ──
  async function saveInfo() {
    setSaving(true);
    await api({ resource: 'trip', action: 'update', data: info });
    setSaving(false);
    flash('Info saved');
  }

  async function saveItinerary() {
    setSaving(true);
    const data = items.map((it, i) => ({
      ...it,
      sort_order: it.sort_order ?? i,
      time: it.time || null,
      location: it.location || null,
    }));
    await api({ resource: 'itinerary', action: 'replace', data });
    setSaving(false);
    flash('Itinerary saved');
  }

  async function saveTeeTimes() {
    setSaving(true);
    const data = tees.map((t) => ({
      day: t.day,
      round_name: t.round_name,
      course: t.course || null,
      tee_time: t.tee_time,
      players: t.players ? t.players.split(',').map((s) => s.trim()).filter(Boolean) : [],
    }));
    await api({ resource: 'tee_times', action: 'replace', data });
    setSaving(false);
    flash('Tee times saved');
  }

  async function saveRooms() {
    setSaving(true);
    const data = roomRows.map((r, i) => ({ ...r, sort_order: i }));
    await api({ resource: 'rooms', action: 'replace', data });
    setSaving(false);
    flash('Rooms saved');
  }

  async function savePlayers() {
    setSaving(true);
    const data = playerRows.map((p) => ({
      name: p.name,
      handicap: p.handicap !== '' ? parseFloat(p.handicap) : null,
      hcp_80:   p.hcp_80 !== '' ? parseFloat(p.hcp_80) : null,
      hcp_100:  p.hcp_100 !== '' ? parseFloat(p.hcp_100) : null,
      hcp_9hole: p.hcp_9hole !== '' ? parseFloat(p.hcp_9hole) : null,
      team: p.team || null,
    }));
    await api({ resource: 'players', action: 'replace', data });
    setSaving(false);
    flash('Players saved');
  }

  async function savePayments() {
    setSaving(true);
    const data = paymentRows.map((p) => ({
      player_name: p.player_name,
      item: p.item,
      amount: p.amount !== '' ? parseFloat(p.amount) : null,
      venmo_to: p.venmo_to || null,
      paid: p.paid ? 1 : 0,
    }));
    await api({ resource: 'payments', action: 'replace', data });
    setSaving(false);
    flash('Payments saved');
  }

  const sections = [
    { key: 'info',      label: '📋 Info' },
    { key: 'itinerary', label: '📅 Itinerary' },
    { key: 'teetimes',  label: '⛳ Tee Times' },
    { key: 'rooms',     label: '🏠 Rooms' },
    { key: 'players',   label: '👤 Players' },
    { key: 'payments',  label: '💰 Payments' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex flex-col flex-1 bg-green-950 overflow-hidden"
           style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-green-800/50 bg-green-900/50 flex-shrink-0">
          <h2 className="text-white font-bold text-base">Edit Trip</h2>
          <div className="flex items-center gap-3">
            {saved && <span className="text-green-400 text-xs font-semibold animate-pulse">{saved}</span>}
            <button onClick={onSaved} className="text-green-400 text-sm font-semibold">Done</button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-none border-b border-green-800/40 flex-shrink-0">
          {sections.map((s) => (
            <button key={s.key} onClick={() => setSection(s.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                      section === s.key ? 'bg-green-500 text-white' : 'bg-green-900/50 text-green-400 border border-green-800/50'
                    }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── INFO ── */}
          {section === 'info' && (
            <div className="space-y-3">
              {[
                ['name', 'Trip Name', 'e.g. 12th Annual Sandbaggers 2025'],
                ['location', 'Location', 'e.g. Boyne Highlands, MI'],
                ['dates_text', 'Dates', 'e.g. August 14-17, 2025'],
                ['hotel', 'Hotel / Lodge', 'e.g. Boyne Highlands Resort'],
              ].map(([f, label, ph]) => (
                <div key={f}>
                  <label className="text-green-400 text-xs font-semibold uppercase block mb-1">{label}</label>
                  <input className="input w-full" placeholder={ph} value={info[f]}
                         onChange={(e) => setInfo({ ...info, [f]: e.target.value })} />
                </div>
              ))}
              <div>
                <label className="text-green-400 text-xs font-semibold uppercase block mb-1">Notes</label>
                <textarea rows={3} className="input w-full resize-none" placeholder="General trip notes…"
                          value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} />
              </div>
              <SaveButton saving={saving} onClick={saveInfo} />
            </div>
          )}

          {/* ── ITINERARY ── */}
          {section === 'itinerary' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-green-400 text-xs">Each row = one schedule item. Players see this in the Schedule tab.</p>
                <button className="text-green-400 text-sm font-semibold hover:text-green-300"
                        onClick={() => setItems([...items, blankItinerary()])}>+ Add</button>
              </div>
              {items.map((item, i) => (
                <div key={i} className="card p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select className="input flex-1 text-sm" value={item.day}
                            onChange={(e) => { const a = [...items]; a[i] = { ...a[i], day: e.target.value }; setItems(a); }}>
                      {DAYS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                    <select className="input flex-1 text-sm" value={item.type}
                            onChange={(e) => { const a = [...items]; a[i] = { ...a[i], type: e.target.value }; setItems(a); }}>
                      {TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <input className="input w-20 text-sm" placeholder="Time" value={item.time || ''}
                           onChange={(e) => { const a = [...items]; a[i] = { ...a[i], time: e.target.value }; setItems(a); }} />
                    <button className="text-red-500 text-lg leading-none flex-shrink-0 hover:text-red-400"
                            onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button>
                  </div>
                  <input className="input w-full text-sm" placeholder="Description (required)"
                         value={item.description || ''}
                         onChange={(e) => { const a = [...items]; a[i] = { ...a[i], description: e.target.value }; setItems(a); }} />
                  <input className="input w-full text-sm" placeholder="Location (optional)"
                         value={item.location || ''}
                         onChange={(e) => { const a = [...items]; a[i] = { ...a[i], location: e.target.value }; setItems(a); }} />
                </div>
              ))}
              <SaveButton saving={saving} onClick={saveItinerary} />
            </div>
          )}

          {/* ── TEE TIMES ── */}
          {section === 'teetimes' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-green-400 text-xs">Each row = one tee time group. Players = comma-separated names.</p>
                <button className="text-green-400 text-sm font-semibold hover:text-green-300"
                        onClick={() => setTees([...tees, blankTeeTime()])}>+ Add</button>
              </div>
              {tees.map((t, i) => (
                <div key={i} className="card p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select className="input flex-1 text-sm" value={t.day}
                            onChange={(e) => { const a = [...tees]; a[i] = { ...a[i], day: e.target.value }; setTees(a); }}>
                      {DAYS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                    <input className="input flex-1 text-sm" placeholder="Round Name (e.g. Round 1)"
                           value={t.round_name}
                           onChange={(e) => { const a = [...tees]; a[i] = { ...a[i], round_name: e.target.value }; setTees(a); }} />
                    <button className="text-red-500 text-lg leading-none flex-shrink-0 hover:text-red-400"
                            onClick={() => setTees(tees.filter((_, j) => j !== i))}>×</button>
                  </div>
                  <div className="flex gap-2">
                    <input className="input flex-1 text-sm" placeholder="Course"
                           value={t.course || ''}
                           onChange={(e) => { const a = [...tees]; a[i] = { ...a[i], course: e.target.value }; setTees(a); }} />
                    <input className="input w-24 text-sm" placeholder="Tee Time"
                           value={t.tee_time}
                           onChange={(e) => { const a = [...tees]; a[i] = { ...a[i], tee_time: e.target.value }; setTees(a); }} />
                  </div>
                  <input className="input w-full text-sm" placeholder="Players (comma-separated, e.g. Brett, Jake, Tanner)"
                         value={t.players || ''}
                         onChange={(e) => { const a = [...tees]; a[i] = { ...a[i], players: e.target.value }; setTees(a); }} />
                </div>
              ))}
              <SaveButton saving={saving} onClick={saveTeeTimes} />
            </div>
          )}

          {/* ── ROOMS ── */}
          {section === 'rooms' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-green-400 text-xs">Each row = one person in a room. Rows with the same room name are grouped.</p>
                <button className="text-green-400 text-sm font-semibold hover:text-green-300"
                        onClick={() => setRoomRows([...roomRows, blankRoom()])}>+ Add</button>
              </div>
              {roomRows.map((r, i) => (
                <div key={i} className="card p-3 flex gap-2 items-center">
                  <input className="input flex-1 text-sm" placeholder="Room Name (e.g. Condo 1)"
                         value={r.room_name}
                         onChange={(e) => { const a = [...roomRows]; a[i] = { ...a[i], room_name: e.target.value }; setRoomRows(a); }} />
                  <input className="input flex-1 text-sm" placeholder="Player Name"
                         value={r.player_name}
                         onChange={(e) => { const a = [...roomRows]; a[i] = { ...a[i], player_name: e.target.value }; setRoomRows(a); }} />
                  <button className="text-red-500 text-lg leading-none flex-shrink-0 hover:text-red-400"
                          onClick={() => setRoomRows(roomRows.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              <SaveButton saving={saving} onClick={saveRooms} />
            </div>
          )}

          {/* ── PLAYERS ── */}
          {section === 'players' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-green-400 text-xs">Handicap list shown in the Handicaps tab. 80% = 80% of HCP for net games.</p>
                <button className="text-green-400 text-sm font-semibold hover:text-green-300"
                        onClick={() => setPlayerRows([...playerRows, blankPlayer()])}>+ Add</button>
              </div>
              <div className="card overflow-hidden">
                {/* Header */}
                <div className="grid gap-1 px-3 py-2 bg-green-800/30 border-b border-green-800/50"
                     style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr auto' }}>
                  {['Name','HCP','80%','100%','9H','Team',''].map((h, i) => (
                    <span key={i} className="text-green-500 text-[10px] font-bold uppercase text-center">{h}</span>
                  ))}
                </div>
                {playerRows.map((p, i) => (
                  <div key={i} className="grid gap-1 px-3 py-2 border-b border-green-800/20 last:border-0"
                       style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr auto' }}>
                    <input className="input text-xs py-1 px-2" placeholder="Name" value={p.name}
                           onChange={(e) => { const a = [...playerRows]; a[i] = { ...a[i], name: e.target.value }; setPlayerRows(a); }} />
                    {['handicap','hcp_80','hcp_100','hcp_9hole'].map((f) => (
                      <input key={f} className="input text-xs py-1 px-2 text-center" placeholder="—" value={p[f] ?? ''}
                             onChange={(e) => { const a = [...playerRows]; a[i] = { ...a[i], [f]: e.target.value }; setPlayerRows(a); }} />
                    ))}
                    <input className="input text-xs py-1 px-2" placeholder="Team" value={p.team || ''}
                           onChange={(e) => { const a = [...playerRows]; a[i] = { ...a[i], team: e.target.value }; setPlayerRows(a); }} />
                    <button className="text-red-500 text-base leading-none hover:text-red-400 pl-1"
                            onClick={() => setPlayerRows(playerRows.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
              <SaveButton saving={saving} onClick={savePlayers} />
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {section === 'payments' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-green-400 text-xs">Track what each player owes and whether they've paid.</p>
                <div className="flex gap-2">
                  <button className="text-green-500 text-xs font-semibold hover:text-green-400"
                          onClick={() => {
                            // Bulk add: add one row per existing player name for a new item
                            const name = prompt('Item name (e.g. Entry Fee):');
                            if (!name) return;
                            const playerNames = [...new Set(paymentRows.map((r) => r.player_name).filter(Boolean))];
                            if (playerNames.length === 0) return;
                            const newRows = playerNames.map((pn) => ({ player_name: pn, item: name, amount: '', venmo_to: '', paid: false }));
                            setPaymentRows([...paymentRows, ...newRows]);
                          }}>
                    + Bulk Add Item
                  </button>
                  <button className="text-green-400 text-sm font-semibold hover:text-green-300"
                          onClick={() => setPaymentRows([...paymentRows, blankPayment()])}>+ Row</button>
                </div>
              </div>
              <div className="card overflow-hidden">
                <div className="grid gap-1 px-3 py-2 bg-green-800/30 border-b border-green-800/50"
                     style={{ gridTemplateColumns: '2fr 2fr 1fr 2fr auto auto' }}>
                  {['Player','Item','$','Venmo To','Paid',''].map((h, i) => (
                    <span key={i} className="text-green-500 text-[10px] font-bold uppercase text-center">{h}</span>
                  ))}
                </div>
                {paymentRows.map((p, i) => (
                  <div key={i} className="grid gap-1 px-3 py-2 border-b border-green-800/20 last:border-0"
                       style={{ gridTemplateColumns: '2fr 2fr 1fr 2fr auto auto' }}>
                    <input className="input text-xs py-1 px-2" placeholder="Player" value={p.player_name}
                           onChange={(e) => { const a = [...paymentRows]; a[i] = { ...a[i], player_name: e.target.value }; setPaymentRows(a); }} />
                    <input className="input text-xs py-1 px-2" placeholder="Item" value={p.item}
                           onChange={(e) => { const a = [...paymentRows]; a[i] = { ...a[i], item: e.target.value }; setPaymentRows(a); }} />
                    <input className="input text-xs py-1 px-2 text-center" placeholder="0" value={p.amount ?? ''}
                           onChange={(e) => { const a = [...paymentRows]; a[i] = { ...a[i], amount: e.target.value }; setPaymentRows(a); }} />
                    <input className="input text-xs py-1 px-2" placeholder="@handle" value={p.venmo_to || ''}
                           onChange={(e) => { const a = [...paymentRows]; a[i] = { ...a[i], venmo_to: e.target.value }; setPaymentRows(a); }} />
                    <button className={`text-xs px-2 py-1 rounded-full font-semibold transition-colors ${
                      p.paid ? 'bg-green-700/40 text-green-300 border border-green-600/40' : 'bg-green-900/30 text-green-600 border border-green-800/30'
                    }`}
                    onClick={() => { const a = [...paymentRows]; a[i] = { ...a[i], paid: !a[i].paid }; setPaymentRows(a); }}>
                      {p.paid ? '✓' : '○'}
                    </button>
                    <button className="text-red-500 text-base leading-none hover:text-red-400 pl-1"
                            onClick={() => setPaymentRows(paymentRows.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
              <SaveButton saving={saving} onClick={savePayments} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function SaveButton({ saving, onClick }) {
  return (
    <button onClick={onClick} disabled={saving}
            className="btn-primary w-full mt-2">
      {saving ? 'Saving…' : 'Save Changes'}
    </button>
  );
}
