'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Nav() {
  const [user, setUser] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data?.user || null))
      .catch(() => setUser(null));
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
  }

  if (!user) return null;

  const link = (href, label) => (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        pathname === href
          ? 'bg-green-600 text-white'
          : 'text-green-100 hover:bg-green-800'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 bg-green-950 border-b border-green-800 shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href="/leaderboard" className="flex items-center gap-2 font-bold text-lg text-white">
            <span>⚽</span>
            <span className="hidden sm:inline">World Cup 2026</span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            {link('/picks', 'My Picks')}
            {link('/leaderboard', 'Leaderboard')}
            {user.role === 'admin' && link('/admin', 'Admin')}
            <button
              onClick={logout}
              className="ml-2 px-3 py-1.5 rounded-md text-sm font-medium text-green-300 hover:bg-green-800 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
