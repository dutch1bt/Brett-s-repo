'use client';

import { useState } from 'react';

export default function EditProfileModal({ user, onClose, onSaved }) {
  const [bio, setBio] = useState(user?.bio || '');
  const [ghin, setGhin] = useState(user?.ghin_number || '');
  const [ghinData, setGhinData] = useState(null);
  const [ghinError, setGhinError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function syncGHIN() {
    if (!ghin.trim()) return;
    setSyncing(true);
    setGhinError('');
    setGhinData(null);
    try {
      const res = await fetch('/api/ghin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ghin_number: ghin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGhinError('Could not fetch from GHIN right now. Save your number — handicap will sync once the GHIN API connection is configured.');
        return;
      }
      setGhinData(data.golfer);
    } catch {
      setGhinError('Network error. Save your number anyway — it will sync when available.');
    } finally {
      setSyncing(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const body = { bio, ghin_number: ghin.trim() };
      // Only update handicap if we got a confirmed GHIN sync
      if (ghinData?.handicapIndex != null) {
        body.handicap = ghinData.handicapIndex;
      }
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) onSaved(data.user);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-auto bg-green-950 rounded-t-3xl border-t border-green-800 p-5"
           style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Edit Profile</h2>
          <button onClick={onClose} className="text-green-500 hover:text-green-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto max-h-[70vh]">

          {/* GHIN Section */}
          <div className="card-gold p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏌️</span>
              <p className="text-amber-300 font-bold text-sm">GHIN Handicap Sync</p>
            </div>

            <div>
              <label className="block text-green-400 text-xs font-semibold uppercase tracking-wide mb-1.5">
                GHIN Number
              </label>
              <p className="text-green-500 text-xs mb-2">
                Find this on your USGA handicap card or at ghin.com
              </p>
              <div className="flex gap-2">
                <input
                  value={ghin}
                  onChange={(e) => { setGhin(e.target.value); setGhinData(null); setGhinError(''); }}
                  className="input flex-1"
                  placeholder="e.g. 10210936"
                  inputMode="numeric"
                />
                <button
                  onClick={syncGHIN}
                  disabled={!ghin.trim() || syncing}
                  className="btn-gold px-4 py-2 text-sm flex-shrink-0"
                >
                  {syncing ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Syncing
                    </span>
                  ) : 'Sync'}
                </button>
              </div>
            </div>

            {ghinError && (
              <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl px-3 py-2">
                <p className="text-amber-300 text-sm">{ghinError}</p>
              </div>
            )}

            {ghinData && (
              <div className="bg-green-900/50 border border-green-600/40 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <p className="text-green-300 font-semibold text-sm">{ghinData.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-green-950/60 rounded-lg p-2 text-center">
                    <p className="text-2xl font-extrabold text-white">{ghinData.handicapIndex?.toFixed(1) ?? '—'}</p>
                    <p className="text-green-500 text-xs">Handicap Index</p>
                  </div>
                  <div className="bg-green-950/60 rounded-lg p-2 text-center">
                    <p className="text-sm font-semibold text-green-200 leading-tight">{ghinData.club || '—'}</p>
                    <p className="text-green-500 text-xs mt-0.5">Home Club</p>
                  </div>
                </div>
                {ghinData.lastRevised && (
                  <p className="text-green-600 text-xs text-right">
                    Last revised: {new Date(ghinData.lastRevised).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
                <p className="text-green-500 text-xs pt-1">
                  Handicap will be updated when you save.
                </p>
              </div>
            )}

            {!ghinData && user?.ghin_number && (
              <div className="bg-green-900/20 border border-green-800/40 rounded-xl px-3 py-2">
                <p className="text-green-500 text-xs">
                  GHIN #{user.ghin_number} saved.
                  {user.handicap != null
                    ? ` Current handicap: ${user.handicap.toFixed(1)}.`
                    : ' Tap Sync to fetch your handicap from GHIN.'}
                </p>
              </div>
            )}
          </div>

          {/* Bio */}
          <div>
            <label className="block text-green-400 text-xs font-semibold uppercase tracking-wide mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="Tell the group about yourself..."
            />
          </div>

          <button onClick={save} disabled={saving} className="w-full btn-primary py-3.5 text-base">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
