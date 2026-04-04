// GHIN Round Sync Engine
// Fetches new posted rounds for a user and creates feed posts

import { getPostedRounds, hasToken } from './ghin.js';
import { getDb } from './db.js';

function scoreTrend(differential) {
  if (differential === null) return '';
  if (differential <= 0) return '🔥';
  if (differential <= 3) return '✅';
  if (differential <= 6) return '👍';
  return '😅';
}

function buildPostContent(round, userName) {
  const holes = round.numberOfHoles === 9 ? '9 holes' : '18 holes';
  const diff = round.differential != null
    ? (round.differential >= 0 ? `+${round.differential.toFixed(1)}` : round.differential.toFixed(1))
    : null;
  const trend = scoreTrend(round.differential);

  let lines = [];
  lines.push(`🏌️ ${userName} posted a round ${trend}`);
  lines.push(`📍 ${round.courseName || 'Unknown Course'} · ${holes}`);
  lines.push(`📅 ${new Date(round.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`);
  lines.push('');

  const scoreLine = [];
  if (round.grossScore) scoreLine.push(`Gross: **${round.grossScore}**`);
  if (round.netScore) scoreLine.push(`Net: ${round.netScore}`);
  if (diff) scoreLine.push(`Differential: ${diff}`);
  if (scoreLine.length) lines.push(scoreLine.join('  ·  '));

  if (round.courseRating && round.slopeRating) {
    lines.push(`⛳ Rating ${round.courseRating} / Slope ${round.slopeRating}${round.tees ? ` (${round.tees})` : ''}`);
  }

  return lines.join('\n');
}

// Sync rounds for a single user. Returns count of new posts created.
export async function syncUserRounds(userId, ghinNumber, { dryRun = false } = {}) {
  if (!hasToken()) {
    return { synced: 0, skipped: 0, error: 'No GHIN_TOKEN configured' };
  }
  if (!ghinNumber) {
    return { synced: 0, skipped: 0, error: 'No GHIN number on file' };
  }

  const db = getDb();
  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
  if (!user) return { synced: 0, skipped: 0, error: 'User not found' };

  // Fetch last 30 days of rounds
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rounds = await getPostedRounds(ghinNumber, { limit: 20, since });

  let synced = 0;
  let skipped = 0;

  for (const round of rounds) {
    if (!round.ghinScoreId) { skipped++; continue; }

    // Check if already synced
    const existing = db
      .prepare('SELECT id FROM ghin_synced_rounds WHERE user_id = ? AND ghin_score_id = ?')
      .get(userId, round.ghinScoreId);

    if (existing) { skipped++; continue; }

    if (dryRun) { synced++; continue; }

    // Create feed post
    const content = buildPostContent(round, user.name);
    const playedAt = round.date
      ? new Date(round.date + 'T12:00:00').toISOString().replace('T', ' ').slice(0, 19)
      : new Date().toISOString().replace('T', ' ').slice(0, 19);

    const postResult = db
      .prepare('INSERT INTO posts (user_id, content, created_at) VALUES (?, ?, ?)')
      .run(userId, content, playedAt);

    // Mark as synced
    db.prepare('INSERT OR IGNORE INTO ghin_synced_rounds (user_id, ghin_score_id, post_id) VALUES (?, ?, ?)')
      .run(userId, round.ghinScoreId, postResult.lastInsertRowid);

    synced++;
  }

  return { synced, skipped };
}

// Sync all users who have GHIN numbers
export async function syncAllUsers({ dryRun = false } = {}) {
  if (!hasToken()) return { error: 'No GHIN_TOKEN configured', users: [] };

  const db = getDb();
  const users = db.prepare('SELECT id, name, ghin_number FROM users WHERE ghin_number IS NOT NULL AND ghin_number != ""').all();

  const results = [];
  for (const user of users) {
    const result = await syncUserRounds(user.id, user.ghin_number, { dryRun });
    results.push({ userId: user.id, name: user.name, ghin: user.ghin_number, ...result });
  }

  return { users: results };
}
