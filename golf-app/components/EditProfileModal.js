'use client';

import { useState, useRef } from 'react';
import Avatar from '@/components/Avatar';

function resizeImageToDataUrl(file, maxSize = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function EditProfileModal({ user, onClose, onSaved }) {
  const [bio, setBio] = useState(user?.bio || '');
  const [ghin, setGhin] = useState(user?.ghin_number || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);
  const [avatarData, setAvatarData] = useState(null); // new image data to save
  const [ghinData, setGhinData] = useState(null);
  const [ghinError, setGhinError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      setAvatarPreview(dataUrl);
      setAvatarData(dataUrl);
    } catch {
      // ignore
    }
  }

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
      if (ghinData?.handicapIndex != null) body.handicap = ghinData.handicapIndex;
      if (avatarData) body.avatar_url = avatarData;
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

          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <Avatar name={user?.name} avatarUrl={avatarPreview} size="xl" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center shadow-lg transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
              />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{user?.name}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-green-400 text-xs mt-1 hover:text-green-300"
              >
                {avatarPreview ? 'Change photo' : 'Upload photo'}
              </button>
              {avatarData && (
                <p className="text-green-600 text-xs mt-0.5">New photo ready — tap Save to apply</p>
              )}
            </div>
          </div>

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
