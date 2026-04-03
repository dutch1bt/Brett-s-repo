'use client';

import { useState } from 'react';
import Link from 'next/link';
import Avatar from './Avatar';

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

export default function PostCard({ post, currentUserId }) {
  const [liked, setLiked] = useState(!!post.user_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function toggleLike() {
    const prev = liked;
    setLiked(!liked);
    setLikeCount((c) => c + (prev ? -1 : 1));
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.count);
    } catch {
      setLiked(prev);
      setLikeCount((c) => c + (prev ? 1 : -1));
    }
  }

  async function loadComments() {
    if (comments !== null) {
      setShowComments(!showComments);
      return;
    }
    const res = await fetch(`/api/posts/${post.id}/comments`);
    const data = await res.json();
    setComments(data.comments || []);
    setShowComments(true);
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      const data = await res.json();
      setComments((prev) => [...(prev || []), data.comment]);
      setNewComment('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <Link href={`/members/${post.user_id}`} className="flex items-center gap-3 p-4 pb-3 hover:bg-green-800/20 transition-colors">
        <Avatar name={post.user_name} avatarUrl={post.avatar_url} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-green-50 text-sm leading-tight truncate">{post.user_name}</p>
          <p className="text-green-500 text-xs">{timeAgo(post.created_at)}</p>
        </div>
      </Link>

      {/* Content */}
      <p className="px-4 pb-3 text-green-100 text-sm leading-relaxed whitespace-pre-wrap">
        {post.content}
      </p>

      {/* Image */}
      {post.image_url && (
        <div className="mx-0 mb-3">
          <img
            src={post.image_url}
            alt="Post"
            className="w-full max-h-80 object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 pb-3 border-t border-green-800/40 pt-3">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors text-sm font-medium ${
            liked
              ? 'bg-green-600/20 text-green-400'
              : 'text-green-500 hover:text-green-300 hover:bg-green-800/30'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        <button
          onClick={loadComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-green-500 hover:text-green-300 hover:bg-green-800/30 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          {post.comment_count > 0 && <span>{post.comment_count}</span>}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-green-800/40 px-4 pt-3 pb-4 space-y-3">
          {(comments || []).map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar name={c.user_name} avatarUrl={c.avatar_url} size="xs" />
              <div className="flex-1 bg-green-950/60 rounded-xl px-3 py-2">
                <p className="text-xs font-semibold text-green-300 mb-0.5">{c.user_name}</p>
                <p className="text-xs text-green-200 leading-relaxed">{c.content}</p>
              </div>
            </div>
          ))}
          <form onSubmit={submitComment} className="flex gap-2 pt-1">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-green-950 border border-green-700 focus:border-green-400 focus:outline-none text-green-50 placeholder-green-600 rounded-xl px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="px-3 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
