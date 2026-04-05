'use client';

import { useState, useEffect } from 'react';
import TripAdminModal from '@/components/TripAdminModal';

const DAY_ORDER = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_COLORS = {
  Wednesday: 'text-purple-400 border-purple-700/40 bg-purple-900/20',
  Thursday:  'text-blue-400 border-blue-700/40 bg-blue-900/20',
  Friday:    'text-green-400 border-green-700/40 bg-green-900/20',
  Saturday:  'text-amber-400 border-amber-700/40 bg-amber-900/20',
  Sunday:    'text-red-400 border-red-700/40 bg-red-900/20',
};
const TYPE_ICONS = { golf: '⛳', meal: '🍽️', activity: '🎯', info: 'ℹ️', social: '🍺', travel: '✈️' };

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] ?? 'Other';
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

export default function TripPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('itinerary');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  async function load() {
    const [tripRes, meRes] = await Promise.all([
      fetch('/api/trip').then((r) => r.json()),
      fetch('/api/profile').then((r) => r.json()),
    ]);
    setData(tripRes);
    setIsAdmin(meRes.user?.role === 'admin');
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="p-4 space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-green-900/40 rounded-2xl" />)}
    </div>
  );

  const { trip, itinerary = [], teeTimes = [], rooms = [], players = [], payments = [] } = data || {};

  if (!trip) return <NoTripView isAdmin={isAdmin} onCreated={load} />;

  const grouped = groupBy(itinerary, 'day');
  const teeByDay = groupBy(teeTimes, 'day');
  const roomGroups = groupBy(rooms, 'room_name');
  const paymentByPlayer = groupBy(payments, 'player_name');
  const paymentItems = [...new Set(payments.map((p) => p.item))];

  return (
    <div className="page-enter pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-green-800 to-green-950 px-4 pb-4"
           style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-green-400 text-xs font-semibold uppercase tracking-widest">Annual Trip</p>
            <h1 className="text-xl font-extrabold text-white leading-tight mt-0.5">{trip.name}</h1>
            {trip.dates_text && <p className="text-green-300 text-sm mt-0.5">{trip.dates_text}</p>}
            {trip.location && <p className="text-green-500 text-xs mt-0.5">📍 {trip.location}</p>}
          </div>
          {isAdmin && (
            <button onClick={() => setShowAdmin(true)}
                    className="btn-secondary text-xs px-3 py-2 flex-shrink-0">
              ✏️ Edit
            </button>
          )}
        </div>

        {trip.hotel && (
          <div className="mt-3 bg-green-900/40 rounded-xl px-3 py-2">
            <p className="text-green-400 text-xs font-semibold">🏨 {trip.hotel}</p>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1.5 mt-4 overflow-x-auto pb-0.5 scrollbar-none">
          {[
            { key: 'itinerary', label: '📅 Schedule' },
            { key: 'teetimes',  label: '⛳ Tee Times' },
            { key: 'rooms',     label: '🏠 Rooms' },
            { key: 'handicaps', label: '📊 Handicaps' },
            { key: 'payments',  label: '💰 Payments' },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                      tab === t.key ? 'bg-green-500 text-white' : 'bg-green-900/50 text-green-400 border border-green-800/50'
                    }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ── ITINERARY ── */}
        {tab === 'itinerary' && (
          DAY_ORDER.filter((d) => grouped[d]).map((day) => (
            <div key={day}>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold mb-3 ${DAY_COLORS[day] || 'text-green-400 border-green-700/40 bg-green-900/20'}`}>
                {day.toUpperCase()}
              </div>
              <div className="space-y-2">
                {grouped[day].map((item) => (
                  <div key={item.id} className="card px-4 py-3 flex items-start gap-3">
                    <span className="text-lg leading-none mt-0.5 flex-shrink-0">{TYPE_ICONS[item.type] || '•'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold leading-snug">{item.description}</p>
                      {item.location && <p className="text-green-500 text-xs mt-0.5">📍 {item.location}</p>}
                    </div>
                    {item.time && (
                      <span className="text-green-400 text-xs font-semibold whitespace-nowrap flex-shrink-0">{item.time}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {tab === 'itinerary' && itinerary.length === 0 && (
          <EmptyState icon="📅" text="No itinerary yet" sub={isAdmin ? 'Tap Edit to add the schedule' : null} />
        )}

        {/* ── TEE TIMES ── */}
        {tab === 'teetimes' && (
          DAY_ORDER.filter((d) => teeByDay[d]).map((day) => (
            <div key={day}>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold mb-3 ${DAY_COLORS[day] || 'text-green-400 border-green-700/40 bg-green-900/20'}`}>
                {day.toUpperCase()}
              </div>
              {/* Group by round within day */}
              {Object.entries(groupBy(teeByDay[day], 'round_name')).map(([round, groups]) => (
                <div key={round} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-green-300 text-xs font-bold uppercase tracking-wide">{round}</p>
                    {groups[0]?.course && <p className="text-green-600 text-xs">· {groups[0].course}</p>}
                  </div>
                  <div className="space-y-2">
                    {groups.map((t) => (
                      <div key={t.id} className="card px-4 py-3 flex items-center gap-3">
                        <span className="text-green-400 font-bold text-sm w-14 flex-shrink-0">{t.tee_time}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {(t.players || []).map((p, i) => (
                            <span key={i} className="bg-green-800/50 text-green-200 text-xs px-2 py-0.5 rounded-full font-medium">{p}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        {tab === 'teetimes' && teeTimes.length === 0 && (
          <EmptyState icon="⛳" text="No tee times yet" sub={isAdmin ? 'Tap Edit to add tee times' : null} />
        )}

        {/* ── ROOMS ── */}
        {tab === 'rooms' && (
          Object.entries(roomGroups).map(([room, occupants]) => (
            <div key={room} className="card overflow-hidden">
              <div className="px-4 py-2.5 bg-green-800/30 border-b border-green-800/50">
                <p className="text-white font-bold text-sm">🏠 {room}</p>
              </div>
              <div className="divide-y divide-green-800/30">
                {occupants.map((o) => (
                  <div key={o.id} className="px-4 py-3">
                    <p className="text-green-100 text-sm">{o.player_name}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {tab === 'rooms' && rooms.length === 0 && (
          <EmptyState icon="🏠" text="No room assignments yet" sub={isAdmin ? 'Tap Edit to assign rooms' : null} />
        )}

        {/* ── HANDICAPS ── */}
        {tab === 'handicaps' && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-green-800/50 grid grid-cols-5 text-xs font-bold text-green-400 uppercase tracking-wide">
              <span className="col-span-2">Player</span>
              <span className="text-right">HCP</span>
              <span className="text-right">80%</span>
              <span className="text-right">9 hole</span>
            </div>
            <div className="divide-y divide-green-800/30">
              {players.map((p, i) => (
                <div key={p.id} className="px-4 py-3 grid grid-cols-5 items-center">
                  <div className="col-span-2 flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 ${i < 3 ? 'text-amber-400' : 'text-green-700'}`}>{i + 1}</span>
                    <div>
                      <p className="text-green-100 text-sm font-medium leading-tight">{p.name}</p>
                      {p.team && <span className="text-xs text-green-600">{p.team}</span>}
                    </div>
                  </div>
                  <span className="text-white font-bold text-sm text-right">{p.handicap?.toFixed(1) ?? '—'}</span>
                  <span className="text-green-400 text-sm text-right">{p.hcp_80 ?? '—'}</span>
                  <span className="text-green-600 text-sm text-right">{p.hcp_9hole ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'handicaps' && players.length === 0 && (
          <EmptyState icon="📊" text="No player list yet" sub={isAdmin ? 'Tap Edit to add players' : null} />
        )}

        {/* ── PAYMENTS ── */}
        {tab === 'payments' && paymentItems.length > 0 && (
          <div className="space-y-4">
            {paymentItems.map((item) => {
              const itemPayments = payments.filter((p) => p.item === item);
              const venmoTo = itemPayments[0]?.venmo_to;
              const amount = itemPayments[0]?.amount;
              const paidCount = itemPayments.filter((p) => p.paid).length;
              return (
                <div key={item} className="card overflow-hidden">
                  <div className="px-4 py-3 bg-green-800/20 border-b border-green-800/50 flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-sm">{item}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {venmoTo && <p className="text-green-500 text-xs">Venmo @{venmoTo}</p>}
                        {amount && <p className="text-amber-400 text-xs font-semibold">${amount}/person</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 text-sm font-bold">{paidCount}/{itemPayments.length}</p>
                      <p className="text-green-600 text-xs">paid</p>
                    </div>
                  </div>
                  <div className="divide-y divide-green-800/30">
                    {itemPayments.map((p) => (
                      <div key={p.id} className="px-4 py-2.5 flex items-center justify-between">
                        <p className="text-green-200 text-sm">{p.player_name}</p>
                        <PaymentToggle payment={p} isAdmin={isAdmin} onToggled={load} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'payments' && payments.length === 0 && (
          <EmptyState icon="💰" text="No payment tracking yet" sub={isAdmin ? 'Tap Edit to set up payments' : null} />
        )}
      </div>

      {showAdmin && (
        <TripAdminModal
          tripData={data}
          onClose={() => setShowAdmin(false)}
          onSaved={() => { setShowAdmin(false); load(); }}
        />
      )}
    </div>
  );
}

function PaymentToggle({ payment, isAdmin, onToggled }) {
  const [working, setWorking] = useState(false);

  async function toggle() {
    if (!isAdmin) return;
    setWorking(true);
    await fetch('/api/trip', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource: 'payment', action: 'toggle',
        data: { player_name: payment.player_name, item: payment.item, amount: payment.amount, venmo_to: payment.venmo_to },
      }),
    });
    setWorking(false);
    onToggled();
  }

  const paid = !!payment.paid;
  return (
    <button onClick={toggle} disabled={!isAdmin || working}
            className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
              paid ? 'bg-green-700/40 text-green-300 border border-green-600/40' : 'bg-red-900/30 text-red-400 border border-red-800/40'
            } ${isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}>
      {working ? '…' : paid ? '✓ Paid' : 'Unpaid'}
    </button>
  );
}

function EmptyState({ icon, text, sub }) {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="text-green-500 font-medium">{text}</p>
      {sub && <p className="text-green-700 text-sm mt-1">{sub}</p>}
    </div>
  );
}

function NoTripView({ isAdmin, onCreated }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', dates_text: '', hotel: '' });
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    await fetch('/api/trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, year: new Date().getFullYear() }),
    });
    setSaving(false);
    onCreated();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-6xl mb-4">🏌️</div>
      <h2 className="text-white font-extrabold text-xl mb-2">No Active Trip</h2>
      <p className="text-green-500 text-sm mb-6">The next annual trip hasn't been set up yet.</p>
      {isAdmin && !creating && (
        <button onClick={() => setCreating(true)} className="btn-primary">Create This Year's Trip</button>
      )}
      {isAdmin && creating && (
        <div className="w-full max-w-sm space-y-3 text-left">
          {[['name','Trip Name (e.g. 13th Annual Sandbaggers 2026)'],['location','Location (e.g. Boyne Highlands, MI)'],['dates_text','Dates (e.g. Aug 13-16, 2026)'],['hotel','Hotel/Lodge']].map(([f, ph]) => (
            <div key={f}>
              <label className="text-green-400 text-xs uppercase font-semibold block mb-1">{f.replace('_',' ')}</label>
              <input className="input w-full" placeholder={ph} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
            </div>
          ))}
          <button onClick={create} disabled={saving || !form.name} className="btn-primary w-full">{saving ? 'Creating…' : 'Create Trip'}</button>
        </div>
      )}
    </div>
  );
}
