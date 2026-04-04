'use client';

import { useState, useCallback } from 'react';

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export default function PostRoundModal({ user, onClose, onPosted }) {
  const today = new Date().toISOString().slice(0, 10);

  const [step, setStep] = useState('course'); // 'course' | 'score' | 'submitting' | 'done'
  const [courseQuery, setCourseQuery] = useState('');
  const [courses, setCourses] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTee, setSelectedTee] = useState(null);
  const [form, setForm] = useState({
    playedAt: today,
    numberOfHoles: 18,
    grossScore: '',
    netScore: '',
    courseHandicap: '',
    postToGhin: true,
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Debounced course search
  const searchCourses = useCallback(
    debounce(async (q) => {
      if (q.length < 3) { setCourses([]); setSearching(false); return; }
      setSearching(true);
      try {
        const res = await fetch(`/api/ghin/courses?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setCourses(data.courses || []);
      } catch {
        setCourses([]);
      } finally {
        setSearching(false);
      }
    }, 400),
    []
  );

  function handleCourseInput(val) {
    setCourseQuery(val);
    setSelectedCourse(null);
    setSelectedTee(null);
    searchCourses(val);
  }

  function selectCourse(course) {
    setSelectedCourse(course);
    setCourseQuery(course.name);
    setCourses([]);
    if (course.tees?.length === 1) setSelectedTee(course.tees[0]);
    else setSelectedTee(null);
  }

  async function submit() {
    setError('');
    if (!form.grossScore) { setError('Gross score is required'); return; }
    setStep('submitting');

    const payload = {
      courseId: selectedCourse?.courseId ?? null,
      courseName: selectedCourse?.name ?? courseQuery,
      teeId: selectedTee?.teeId ?? null,
      teeName: selectedTee?.name ?? null,
      courseRating: selectedTee?.rating ?? null,
      slopeRating: selectedTee?.slope ?? null,
      playedAt: form.playedAt,
      numberOfHoles: parseInt(form.numberOfHoles),
      grossScore: parseInt(form.grossScore),
      netScore: form.netScore ? parseInt(form.netScore) : null,
      courseHandicap: form.courseHandicap ? parseInt(form.courseHandicap) : null,
      postToGhin: form.postToGhin,
    };

    try {
      const res = await fetch('/api/ghin/post-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to post round'); setStep('score'); return; }
      setResult(data);
      setStep('done');
      onPosted?.();
    } catch (e) {
      setError(e.message);
      setStep('score');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-green-950 border border-green-800/50 rounded-t-3xl p-6 pb-safe space-y-5 max-h-[90vh] overflow-y-auto"
           style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>

        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Post a Round</h2>
          <button onClick={onClose} className="text-green-500 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Done state */}
        {step === 'done' && (
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">🏌️</div>
            <p className="text-white font-bold text-lg">Round posted!</p>
            {result?.postedToGhin
              ? <p className="text-green-400 text-sm">Score submitted to GHIN ✓</p>
              : result?.ghinMessage
              ? <p className="text-amber-400 text-sm text-center">{result.ghinMessage}</p>
              : <p className="text-green-500 text-sm">Saved to your feed</p>
            }
            <button onClick={onClose} className="btn-primary w-full mt-4">Done</button>
          </div>
        )}

        {/* Submitting */}
        {step === 'submitting' && (
          <div className="text-center py-8 text-green-400">
            <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Posting round…</p>
          </div>
        )}

        {/* Step 1: Course selection */}
        {(step === 'course' || step === 'score') && (
          <>
            {/* Course search */}
            <div className="space-y-2">
              <label className="text-green-400 text-xs font-semibold uppercase tracking-wide">Course</label>
              <div className="relative">
                <input
                  type="text"
                  value={courseQuery}
                  onChange={(e) => handleCourseInput(e.target.value)}
                  placeholder="Search course name…"
                  className="input-field w-full"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Course results dropdown */}
              {courses.length > 0 && !selectedCourse && (
                <div className="border border-green-800/50 rounded-xl overflow-hidden divide-y divide-green-800/30 max-h-48 overflow-y-auto">
                  {courses.map((c) => (
                    <button key={c.courseId} onClick={() => selectCourse(c)}
                            className="w-full text-left px-4 py-3 bg-green-900/40 hover:bg-green-800/50 transition-colors">
                      <p className="text-white text-sm font-semibold">{c.name}</p>
                      <p className="text-green-500 text-xs">{[c.city, c.state].filter(Boolean).join(', ')}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Tee selection */}
              {selectedCourse?.tees?.length > 0 && (
                <div className="space-y-1">
                  <label className="text-green-400 text-xs font-semibold">Tee</label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedCourse.tees.map((t) => (
                      <button key={t.teeId}
                              onClick={() => setSelectedTee(t)}
                              className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                                selectedTee?.teeId === t.teeId
                                  ? 'border-green-400 bg-green-400/10 text-white'
                                  : 'border-green-800/50 bg-green-900/30 text-green-300 hover:border-green-600'
                              }`}>
                        <p className="text-sm font-semibold">{t.name}</p>
                        {t.rating && <p className="text-xs opacity-70">{t.rating} / {t.slope}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual course name if no GHIN match */}
              {!selectedCourse && courseQuery.length >= 3 && courses.length === 0 && !searching && (
                <p className="text-green-500 text-xs">No GHIN courses found — the name you typed will be used.</p>
              )}
            </div>

            {/* Score details */}
            <div className="space-y-3">
              <label className="text-green-400 text-xs font-semibold uppercase tracking-wide">Score Details</label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-green-500 text-xs mb-1 block">Date Played</label>
                  <input type="date" value={form.playedAt} max={today}
                         onChange={(e) => setForm({ ...form, playedAt: e.target.value })}
                         className="input-field w-full" />
                </div>
                <div>
                  <label className="text-green-500 text-xs mb-1 block">Holes</label>
                  <select value={form.numberOfHoles}
                          onChange={(e) => setForm({ ...form, numberOfHoles: parseInt(e.target.value) })}
                          className="input-field w-full">
                    <option value={18}>18 holes</option>
                    <option value={9}>9 holes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-green-500 text-xs mb-1 block">Gross Score *</label>
                  <input type="number" inputMode="numeric" placeholder="84"
                         value={form.grossScore}
                         onChange={(e) => setForm({ ...form, grossScore: e.target.value })}
                         className="input-field w-full" min={50} max={200} />
                </div>
                <div>
                  <label className="text-green-500 text-xs mb-1 block">Net Score</label>
                  <input type="number" inputMode="numeric" placeholder="76"
                         value={form.netScore}
                         onChange={(e) => setForm({ ...form, netScore: e.target.value })}
                         className="input-field w-full" min={30} max={200} />
                </div>
                <div>
                  <label className="text-green-500 text-xs mb-1 block">Course HCP</label>
                  <input type="number" inputMode="numeric" placeholder="10"
                         value={form.courseHandicap}
                         onChange={(e) => setForm({ ...form, courseHandicap: e.target.value })}
                         className="input-field w-full" min={0} max={54} />
                </div>
              </div>
            </div>

            {/* Post to GHIN toggle */}
            {user?.ghin_number && (
              <button
                onClick={() => setForm((f) => ({ ...f, postToGhin: !f.postToGhin }))}
                className="flex items-center gap-3 w-full text-left"
              >
                <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                  form.postToGhin ? 'bg-green-500' : 'bg-green-800'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    form.postToGhin ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Submit to GHIN</p>
                  <p className="text-green-500 text-xs">Posts this score to your official handicap record</p>
                </div>
              </button>
            )}

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button onClick={submit} disabled={!form.grossScore || !form.playedAt}
                    className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
              Post Round
            </button>
          </>
        )}
      </div>
    </div>
  );
}
