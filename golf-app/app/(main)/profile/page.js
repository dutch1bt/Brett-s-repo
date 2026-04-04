'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import EditProfileModal from '@/components/EditProfileModal';
import PostRoundModal from '@/components/PostRoundModal';

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [postingRound, setPostingRound] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [tab, setTab] = useState('stats');
  const [members, setMembers] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then((r) => r.json()),
      fetch('/api/members').then((r) => r.json()),
    ]).then(([profileData, membersData]) => {
      setData(profileData);
      setMembers(membersData.members || []);
      setLoading(false);
    });
  }, []);

  async function syncRounds() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/ghin/sync', { method: 'POST' });
      const data = await res.json();
      if (data.error) { setSyncMsg(data.error); }
      else if (data.synced === 0) { setSyncMsg('No new rounds found'); }
      else { setSyncMsg(`${data.synced} new round${data.synced !== 1 ? 's' : ''} added to your feed!`); }
    } catch {
      setSyncMsg('Sync failed — try again');
    } finally {
      setSyncing(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="p-4 animate-pulse space-y-4">
        <div className="h-32 bg-green-900 rounded-2xl" />
        <div className="h-24 bg-green-900 rounded-2xl" />
      </div>
    );
  }

  const { user, stats, trophyCount, recentResults = [], posts = [] } = data || {};

  const myRank = members.findIndex((m) => m.id === user?.id) + 1;

  return (
    <div className="page-enter">
      {/* Profile Header */}
      <div className="bg-gradient-to-b from-green-800 to-green-950 pb-4">
        <div className="px-4 pt-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-start justify-between">
            <Avatar name={user?.name} avatarUrl={user?.avatar_url} size="xl" />
            <div className="flex flex-col gap-2 items-end">
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)}
                        className="btn-secondary text-xs px-3 py-2">Edit Profile</button>
                <button onClick={logout}
                        className="bg-red-900/40 border border-red-800/50 text-red-400 hover:bg-red-900/60 text-xs px-3 py-2 rounded-xl font-medium">
                  Logout
                </button>
              </div>
              {user?.ghin_number && (
                <div className="flex gap-2">
                  <button onClick={() => setPostingRound(true)}
                          className="bg-amber-600/20 border border-amber-500/40 text-amber-400 hover:bg-amber-600/30 text-xs px-3 py-2 rounded-xl font-medium whitespace-nowrap">
                    ⛳ Post Round
                  </button>
                  <button onClick={syncRounds} disabled={syncing}
                          className="bg-green-700/30 border border-green-600/40 text-green-400 hover:bg-green-700/50 text-xs px-3 py-2 rounded-xl font-medium disabled:opacity-50 whitespace-nowrap">
                    {syncing ? '…' : '↻ Sync GHIN'}
                  </button>
                </div>
              )}
              {syncMsg && (
                <p className="text-xs text-green-400 text-right max-w-[180px]">{syncMsg}</p>
              )}
            </div>
          </div>

          <div className="mt-3">
            <h1 className="text-2xl font-extrabold text-white">{user?.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {user?.handicap != null && (
                <span className="bg-green-600/30 text-green-300 border border-green-600/40 text-sm px-3 py-0.5 rounded-full font-bold">
                  HCP {user.handicap.toFixed(1)}
                </span>
              )}
              {user?.ghin_number && (
                <span className="text-green-500 text-xs">GHIN #{user.ghin_number}</span>
              )}
              {myRank > 0 && (
                <span className="text-amber-400 text-xs font-semibold">#{myRank} overall</span>
              )}
            </div>
            {user?.bio && (
              <p className="text-green-300 text-sm mt-2 leading-relaxed">{user.bio}</p>
            )}
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Events', value: stats?.events_played || 0 },
              { label: 'Wins', value: stats?.wins || 0 },
              { label: 'Trophies', value: trophyCount || 0 },
              { label: 'Pts', value: Math.round(stats?.total_points || 0) },
            ].map((s) => (
              <div key={s.label} className="bg-green-900/40 rounded-xl p-2.5 text-center">
                <p className="text-white font-extrabold text-lg leading-none">{s.value}</p>
                <p className="text-green-500 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GHIN Setup Banner — shown when no GHIN number is set */}
      {!user?.ghin_number && (
        <div className="mx-4 mt-4 rounded-2xl bg-amber-900/20 border border-amber-500/30 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏌️</span>
            <div className="flex-1">
              <p className="text-amber-300 font-bold text-sm">Connect your GHIN account</p>
              <p className="text-amber-200/70 text-xs mt-0.5 leading-relaxed">
                Add your GHIN number to sync your handicap and automatically post rounds to the feed.
              </p>
              <button
                onClick={() => setEditing(true)}
                className="mt-3 bg-amber-600/30 border border-amber-500/50 text-amber-300 hover:bg-amber-600/50 text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                Set Up GHIN →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-green-800/50 bg-green-950/50">
        {['stats', 'results', 'posts'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                    tab === t ? 'text-green-400 border-b-2 border-green-400' : 'text-green-600 hover:text-green-400'
                  }`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* Stats tab */}
        {tab === 'stats' && (
          <div className="space-y-4">
            <div className="card p-4 space-y-3">
              <h2 className="text-white font-bold text-sm">Career Stats</h2>
              {[
                { label: 'Best Finish', value: stats?.best_finish ? `#${stats.best_finish}` : '—' },
                { label: 'Average Gross', value: stats?.avg_gross ? stats.avg_gross.toFixed(1) : '—' },
                { label: 'Best Round', value: stats?.best_gross || '—' },
                { label: 'Total Points', value: Math.round(stats?.total_points || 0) },
                { label: 'Trophies Won', value: trophyCount || 0 },
                { label: 'Overall Rank', value: myRank > 0 ? `#${myRank}` : '—' },
              ].map((s) => (
                <div key={s.label} className="flex justify-between items-center py-1.5 border-b border-green-800/30 last:border-0">
                  <span className="text-green-400 text-sm">{s.label}</span>
                  <span className="text-white font-bold text-sm">{s.value}</span>
                </div>
              ))}
            </div>

            {/* Members leaderboard */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-green-800/50">
                <h2 className="text-white font-bold text-sm">Group Standings</h2>
              </div>
              <div className="divide-y divide-green-800/30">
                {members.map((m, i) => (
                  <Link key={m.id} href={m.id === user?.id ? '/profile' : `/members/${m.id}`}
                       className={`flex items-center gap-3 px-4 py-3 hover:bg-green-800/30 transition-colors ${m.id === user?.id ? 'bg-green-800/20' : ''}`}>
                    <span className={`pos-badge ${i === 0 ? 'pos-1' : i === 1 ? 'pos-2' : i === 2 ? 'pos-3' : 'pos-other'}`}>
                      {i + 1}
                    </span>
                    <Avatar name={m.name} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${m.id === user?.id ? 'text-green-300' : 'text-green-100'}`}>
                        {m.name} {m.id === user?.id && '(you)'}
                      </p>
                      <p className="text-green-600 text-xs">{m.wins} wins · {m.trophy_count} 🏆</p>
                    </div>
                    <span className="text-amber-400 font-bold text-sm">{Math.round(m.total_points || 0)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results tab */}
        {tab === 'results' && (
          <div className="space-y-3">
            {recentResults.length === 0 && (
              <div className="text-center py-12 text-green-600">
                <div className="text-4xl mb-3">🏌️</div>
                <p>No results yet</p>
              </div>
            )}
            {recentResults.map((r, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-start gap-3">
                  <span className={`text-2xl ${r.position <= 3 ? '' : 'opacity-50'}`}>
                    {r.position <= 3 ? MEDAL_EMOJIS[r.position - 1] : `#${r.position}`}
                  </span>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{r.event_name}</p>
                    <p className="text-green-500 text-xs">{new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-green-400 text-xs">{r.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{r.net_score} net</p>
                    <p className="text-green-500 text-xs">{r.gross_score} gross</p>
                    <p className="text-amber-400 text-xs">{r.points} pts</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Posts tab */}
        {tab === 'posts' && (
          <div className="space-y-3">
            {posts.length === 0 && (
              <div className="text-center py-12 text-green-600">
                <div className="text-4xl mb-3">💬</div>
                <p>No posts yet</p>
              </div>
            )}
            {posts.map((p) => (
              <div key={p.id} className="card p-4">
                <p className="text-green-100 text-sm leading-relaxed">{p.content}</p>
                {p.image_url && (
                  <img src={p.image_url} alt="Post" className="w-full max-h-40 object-cover rounded-xl mt-3" />
                )}
                <div className="flex gap-4 mt-3 text-green-600 text-xs">
                  <span>❤️ {p.like_count}</span>
                  <span>💬 {p.comment_count}</span>
                  <span className="ml-auto">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editing && (
        <EditProfileModal
          user={user}
          onClose={() => setEditing(false)}
          onSaved={(updatedUser) => {
            setData((prev) => ({ ...prev, user: updatedUser }));
            setEditing(false);
          }}
        />
      )}

      {/* Post Round Modal */}
      {postingRound && (
        <PostRoundModal
          user={user}
          onClose={() => setPostingRound(false)}
          onPosted={() => {
            setPostingRound(false);
            // Reload posts tab data
            fetch('/api/profile').then((r) => r.json()).then((d) => setData(d));
          }}
        />
      )}
    </div>
  );
}
