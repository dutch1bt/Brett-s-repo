import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { postScore, hasToken } from '@/lib/ghin';

// POST /api/ghin/post-round
// Body: { courseId, courseName, teeId, teeName, courseRating, slopeRating,
//         playedAt, numberOfHoles, grossScore, netScore, courseHandicap }
export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    courseId, courseName, teeId, teeName,
    courseRating, slopeRating,
    playedAt, numberOfHoles = 18,
    grossScore, netScore, courseHandicap,
    postToGhin = true,
  } = body;

  if (!grossScore || !playedAt) {
    return NextResponse.json({ error: 'grossScore and playedAt are required' }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, name, ghin_number FROM users WHERE id = ?').get(session.userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Build feed post content
  const holes = numberOfHoles === 9 ? '9 holes' : '18 holes';
  const dateStr = new Date(playedAt + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  let lines = [];
  lines.push(`🏌️ ${user.name} posted a round`);
  lines.push(`📍 ${courseName || 'Unknown Course'} · ${holes}`);
  lines.push(`📅 ${dateStr}`);
  lines.push('');

  const scoreParts = [];
  if (grossScore) scoreParts.push(`Gross: **${grossScore}**`);
  if (netScore) scoreParts.push(`Net: ${netScore}`);
  if (scoreParts.length) lines.push(scoreParts.join('  ·  '));

  if (courseRating && slopeRating) {
    lines.push(`⛳ Rating ${courseRating} / Slope ${slopeRating}${teeName ? ` (${teeName})` : ''}`);
  }

  if (courseHandicap != null) {
    lines.push(`Course handicap: ${courseHandicap}`);
  }

  const content = lines.join('\n');
  const createdAt = new Date(playedAt + 'T12:00:00').toISOString().replace('T', ' ').slice(0, 19);

  // Save to feed
  const postResult = db
    .prepare('INSERT INTO posts (user_id, content, created_at) VALUES (?, ?, ?)')
    .run(session.userId, content, createdAt);

  const postId = postResult.lastInsertRowid;

  // Attempt to post to GHIN if we have a token and course ID
  let ghinResult = null;
  if (postToGhin && hasToken() && user.ghin_number && courseId && teeId) {
    ghinResult = await postScore(user.ghin_number, {
      courseId, teeId, playedAt,
      numberOfHoles, grossScore,
    });

    // If GHIN accepted it, record a fake sync so we don't double-post when syncing back
    if (ghinResult?.success && ghinResult?.score?.id) {
      const ghinScoreId = ghinResult.score.id.toString();
      db.prepare('INSERT OR IGNORE INTO ghin_synced_rounds (user_id, ghin_score_id, post_id) VALUES (?, ?, ?)')
        .run(session.userId, ghinScoreId, postId);
    }
  }

  return NextResponse.json({
    ok: true,
    postId,
    postedToGhin: ghinResult?.success ?? false,
    ghinMessage: ghinResult?.error ?? null,
    content,
  });
}
