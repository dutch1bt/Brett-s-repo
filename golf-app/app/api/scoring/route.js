import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('event_id');

  const db = getDb();

  // Get active events if no event_id specified
  if (!eventId) {
    const activeEvents = db.prepare(`
      SELECT * FROM events WHERE is_active = 1 ORDER BY date DESC
    `).all();
    return NextResponse.json({ activeEvents });
  }

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(parseInt(eventId));
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  // Get all scores for this event grouped by user
  const scores = db.prepare(`
    SELECT ls.user_id, ls.hole, ls.score, u.name AS user_name, u.handicap, u.avatar_url
    FROM live_scores ls
    JOIN users u ON u.id = ls.user_id
    WHERE ls.event_id = ?
    ORDER BY ls.user_id, ls.hole ASC
  `).all(parseInt(eventId));

  // Group by user
  const playerMap = {};
  for (const s of scores) {
    if (!playerMap[s.user_id]) {
      playerMap[s.user_id] = {
        user_id: s.user_id,
        user_name: s.user_name,
        handicap: s.handicap,
        avatar_url: s.avatar_url,
        holes: {},
        total: 0,
        holesPlayed: 0,
      };
    }
    playerMap[s.user_id].holes[s.hole] = s.score;
    playerMap[s.user_id].total += s.score;
    playerMap[s.user_id].holesPlayed++;
  }

  const players = Object.values(playerMap).sort((a, b) => {
    if (a.holesPlayed !== b.holesPlayed) return b.holesPlayed - a.holesPlayed;
    return a.total - b.total;
  });

  return NextResponse.json({ event, players });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { event_id, hole, score } = await request.json();
  if (!event_id || !hole || score == null) {
    return NextResponse.json({ error: 'event_id, hole, and score required' }, { status: 400 });
  }
  if (hole < 1 || hole > 18 || score < 1 || score > 15) {
    return NextResponse.json({ error: 'Invalid hole (1-18) or score (1-15)' }, { status: 400 });
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO live_scores (event_id, user_id, hole, score)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(event_id, user_id, hole) DO UPDATE SET score = excluded.score
  `).run(event_id, session.userId, hole, score);

  return NextResponse.json({ success: true });
}
