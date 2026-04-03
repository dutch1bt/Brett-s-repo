'use client';

import { useState, useEffect, useRef } from 'react';
import PostCard from '@/components/PostCard';
import Avatar from '@/components/Avatar';
import InstallBanner from '@/components/InstallBanner';

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([
      fetch('/api/posts').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
    ]).then(([postsData, meData]) => {
      setPosts(postsData.posts || []);
      setUser(meData.user);
      setLoading(false);
    });
  }, []);

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function submitPost(e) {
    e.preventDefault();
    if (!newPost.trim() || submitting) return;
    setSubmitting(true);

    try {
      let res;
      if (imageFile) {
        const fd = new FormData();
        fd.append('content', newPost.trim());
        fd.append('image', imageFile);
        res = await fetch('/api/posts', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newPost.trim() }),
        });
      }
      const data = await res.json();
      if (data.post) {
        setPosts((prev) => [{ ...data.post, user_liked: 0 }, ...prev]);
        setNewPost('');
        setImageFile(null);
        setImagePreview(null);
        setShowComposer(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-green-950/90 backdrop-blur-md border-b border-green-800/50">
        <div className="flex items-center justify-between px-4 py-3"
             style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
          <div>
            <h1 className="text-lg font-bold text-white">Sandbaggers</h1>
            <p className="text-green-500 text-xs">Member Feed</p>
          </div>
          <button
            onClick={() => setShowComposer(true)}
            className="btn-primary px-4 py-2 text-sm"
          >
            + Post
          </button>
        </div>
      </div>

      {/* Post Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-auto bg-green-950 rounded-t-3xl border-t border-green-800 p-5 pb-8"
               style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">New Post</h2>
              <button onClick={() => { setShowComposer(false); setImagePreview(null); setImageFile(null); setNewPost(''); }}
                      className="text-green-500 hover:text-green-300 p-1">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={submitPost} className="space-y-3">
              <div className="flex gap-3">
                <Avatar name={user?.name} avatarUrl={user?.avatar_url} size="sm" />
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="What's happening on the course?"
                  className="flex-1 bg-green-900/50 border border-green-700 focus:border-green-400 focus:outline-none text-green-50 placeholder-green-600 rounded-xl px-4 py-3 text-sm resize-none"
                  rows={4}
                  autoFocus
                />
              </div>

              {imagePreview && (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover rounded-xl" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                          className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs">✕</button>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={() => fileRef.current?.click()}
                        className="flex items-center gap-1.5 text-green-400 hover:text-green-300 text-sm font-medium">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  Photo
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <button type="submit" disabled={!newPost.trim() || submitting}
                        className="ml-auto btn-primary px-6 py-2.5 text-sm">
                  {submitting ? 'Posting...' : 'Share'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <InstallBanner />

      {/* Feed */}
      <div className="p-4 space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse space-y-3">
              <div className="flex gap-3 items-center">
                <div className="w-9 h-9 rounded-full bg-green-800" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 bg-green-800 rounded" />
                  <div className="h-2 w-16 bg-green-800 rounded" />
                </div>
              </div>
              <div className="h-3 bg-green-800 rounded w-full" />
              <div className="h-3 bg-green-800 rounded w-3/4" />
            </div>
          ))
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-green-600">
            <div className="text-5xl mb-4">⛳</div>
            <p className="font-medium">No posts yet. Be the first!</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={user?.id} />
          ))
        )}
      </div>
    </div>
  );
}
