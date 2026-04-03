'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';
import Link from 'next/link';

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MemberProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('stats');
  const [trophies, setTrophies] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/profile?id=${id}`).then((r) => r.json()),
      fetch('/api/trophies').then((r) => r.json()),
    ]).then(([profileData, trophyData]) => {
      setData(profileData);
      const memberTrophies = (trophyData.trophies || []).filter(
        (t) => t.winner_id === parseInt(id)
      );
      setTrophies(memberTrophies);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="animate-pulse p-4 space-y-4">
        <div className="h-40 bg-green-900 rounded-2xl" />
        <div className="h-24 bg-green-900 rounded-2xl" />
        <div className="h-24 bg-green-900 rounded-2xl" />
      </div>
    );
  }

  const { user, stats, trophyCount, recentResults = [], posts = [] } = data || {};
  if (!user) return <div className="p-8 text-center text-green-500">Member not found.</div>;

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="bg-gradient-to-b from-green-800 to-green-950 pb-4">
        <div className="px-4 pt-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
          <button onClick={() => router.back()}
                  className="flex items-center gap-1 text-green-400 text-sm mb-4 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div className="flex items-start gap-4">
            <Avatar name={user.name} avatarUrl={user.avatar_url} size="xl" />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold text-white leading-tight">{user.name}</h1>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {user.handicap != null && (
                  <span className="bg-green-600/30 text-green-300 border border-green-600/40 text-sm px-3 py-0.5 rounded-full font-bold">
                    HCP {user.handicap.toFixed(1)}
                  </span>
                )}
                {trophyCount > 0 && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm px-3 py-0.5 rounded-full font-bold">
                    {trophyCount} 🏆
                  </span>
                )}
              </div>
              {user.ghin_number && (
                <p className="text-green-500 text-xs mt-1">GHIN #{user.ghin_number}</p>
              )}
            </div>
          </div>

          {user.bio && (
            <p className="text-green-300 text-sm mt-3 leading-relaxed">{user.bio}</p>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Events', value: stats?.events_played || 0 },
              { label: 'Wins', value: stats?.wins || 0 },
              { label: 'Trophies', value: trophyCount || 0 },
              { label: 'Pts', value: Math.round(stats?.total_points || 0) },
            ].map((s) => (
              <div key={s.label} className="bg-green-900/50 rounded-xl p-2.5 text-center">
                <p className="text-white font-extrabold text-lg leading-none">{s.value}</p>
                <p className="text-green-500 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-green-800/50 bg-green-950/50">
        {['stats', 'trophies', 'results', 'posts'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                    tab === t ? 'text-green-400 border-b-2 border-green-400' : 'text-green-600 hover:text-green-400'
                  }`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        {tab === 'stats' && (
          <div className="card p-4 space-y-3">
            <h2 className="text-white font-bold text-sm">Career Stats</h2>
            {[
              { label: 'Events Played', value: stats?.events_played || 0 },
              { label: 'Wins', value: stats?.wins || 0 },
              { label: 'Best Finish', value: stats?.best_finish ? `#${stats.best_finish}` : '—' },
              { label: 'Average Gross', value: stats?.avg_gross ? stats.avg_gross.toFixed(1) : '—' },
              { label: 'Best Round', value: stats?.best_gross || '—' },
              { label: 'Total Points', value: Math.round(stats?.total_points || 0) },
              { label: 'Trophies Won', value: trophyCount || 0 },
            ].map((s) => (
              <div key={s.label} className="flex justify-between items-center py-1.5 border-b border-green-800/30 last:border-0">
                <span className="text-green-400 text-sm">{s.label}</span>
                <span className="text-white font-bold text-sm">{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Trophies */}
        {tab === 'trophies' && (
          <div className="space-y-3">
            {trophies.length === 0 && (
              <div className="text-center py-12 text-green-600">
                <div className="text-4xl mb-3">🏆</div>
                <p>No trophies yet</p>
              </div>
            )}
            {trophies.map((t) => (
              <div key={t.id} className="card trophy-shimmer p-4 flex items-center gap-4 border border-amber-700/20">
                <div className="text-3xl">{t.image_emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-300 text-sm">{t.name}</p>
                  <p className="text-green-500 text-xs mt-0.5">{t.year}{t.event_name ? ` · ${t.event_name}` : ''}</p>
                  <p className="text-green-400 text-xs italic mt-0.5">{t.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {tab === 'results' && (
          <div className="space-y-3">
            {recentResults.length === 0 && (
              <div className="text-center py-12 text-green-600">
                <div className="text-4xl mb-3">🏌️</div>
                <p>No results yet</p>
              </div>
            )}
            {recentResults.map((r, i) => (
              <Link key={i} href={`/events/${r.event_id || ''}`}>
                <div className="card p-4 flex items-start gap-3 hover:bg-green-800/40 transition-colors">
                  <span className="text-2xl">
                    {r.position <= 3 ? MEDAL_EMOJIS[r.position - 1] : `#${r.position}`}
                  </span>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{r.event_name}</p>
                    <p className="text-green-500 text-xs">{new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{r.net_score} net</p>
                    <p className="text-green-500 text-xs">{r.gross_score} gross</p>
                    <p className="text-amber-400 text-xs">{r.points} pts</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Posts */}
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
                <div className="flex items-center gap-2 mb-2">
                  <Avatar name={user.name} avatarUrl={user.avatar_url} size="xs" />
                  <div>
                    <p className="text-green-200 text-xs font-semibold">{user.name}</p>
                    <p className="text-green-600 text-xs">{timeAgo(p.created_at)}</p>
                  </div>
                </div>
                <p className="text-green-100 text-sm leading-relaxed">{p.content}</p>
                {p.image_url && (
                  <img src={p.image_url} alt="Post" className="w-full max-h-48 object-cover rounded-xl mt-3" />
                )}
                <div className="flex gap-4 mt-3 text-green-600 text-xs">
                  <span>❤️ {p.like_count}</span>
                  <span>💬 {p.comment_count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
