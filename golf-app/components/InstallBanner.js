'use client';

import { useState, useEffect } from 'react';

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return;
    if (sessionStorage.getItem('install-dismissed')) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      setShow(true);
      return;
    }

    // Android / Chrome install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    });
  }, []);

  function dismiss() {
    sessionStorage.setItem('install-dismissed', '1');
    setShow(false);
  }

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setShow(false);
    }
  }

  if (!show) return null;

  return (
    <div className="mx-4 mt-3 mb-1 card border border-green-600/40 p-3 flex items-center gap-3">
      <span className="text-2xl flex-shrink-0">⛳</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold">Add to Home Screen</p>
        {isIOS ? (
          <p className="text-green-400 text-xs mt-0.5">
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
          </p>
        ) : (
          <p className="text-green-400 text-xs mt-0.5">Install for offline access & notifications</p>
        )}
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {!isIOS && (
          <button onClick={install}
                  className="bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
            Install
          </button>
        )}
        <button onClick={dismiss} className="text-green-600 hover:text-green-400 p-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
