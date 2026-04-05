'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      router.push('/feed');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
         style={{ background: 'radial-gradient(ellipse at top, #14532d 0%, #052e16 60%)' }}>

      <div className="text-center mb-10">
        <div className="text-6xl mb-4">⛳</div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Sandbaggers</h1>
        <p className="text-green-400 mt-2 text-sm font-medium tracking-wide uppercase">Member Portal</p>
      </div>

      <div className="w-full max-w-sm">
        <div className="bg-green-900/50 backdrop-blur-sm border border-green-700/50 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Sign In</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-900/40 border border-red-700/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-green-300 text-xs font-semibold uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     className="input" placeholder="you@example.com" required autoComplete="email" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-green-300 text-xs font-semibold uppercase tracking-wide">
                  Password
                </label>
                <span className="text-green-600 text-xs">Forgot? Ask Brett to reset it.</span>
              </div>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="input pr-10" placeholder="••••••••" required autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 hover:text-green-300">
                  {showPassword
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  }
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary py-3.5 text-base mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-green-600 text-xs mt-6">
          New member?{' '}
          <Link href="/register" className="text-green-400 hover:text-green-300 font-medium">
            Create an account →
          </Link>
        </p>
      </div>
    </div>
  );
}
