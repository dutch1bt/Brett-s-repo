// Run with: node scripts/seed.js
// Seeds the database with sample data

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'golf.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    ghin_number TEXT, handicap REAL, avatar_url TEXT, role TEXT NOT NULL DEFAULT 'member',
    bio TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL, image_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, UNIQUE(post_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS post_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, date TEXT NOT NULL,
    location TEXT NOT NULL, description TEXT, type TEXT NOT NULL DEFAULT 'tournament',
    format TEXT, is_active INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS event_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, position INTEGER,
    gross_score INTEGER, net_score INTEGER, points REAL DEFAULT 0, notes TEXT
  );
  CREATE TABLE IF NOT EXISTS trophies (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
    year INTEGER NOT NULL, event_id INTEGER REFERENCES events(id), winner_id INTEGER REFERENCES users(id),
    image_emoji TEXT DEFAULT '🏆', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS live_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, hole INTEGER NOT NULL,
    score INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(event_id, user_id, hole)
  );
  CREATE TABLE IF NOT EXISTS itinerary_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, date TEXT NOT NULL, time TEXT,
    location TEXT, description TEXT, type TEXT NOT NULL DEFAULT 'event', notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('Schema created.');

// ── Users ────────────────────────────────────────────────────────────────────
const users = [
  { name: 'Brett Admin', email: 'brett@golf.com', password: 'admin123', role: 'admin', ghin: '1234567', handicap: 8.4, bio: 'Founder & commissioner of the group. 18 years on the links.' },
  { name: 'Mike Johnson', email: 'mike@golf.com', password: 'golf123', role: 'member', ghin: '2345678', handicap: 12.1, bio: 'Weekend warrior. Driver of the cart.' },
  { name: 'Dave Wilson', email: 'dave@golf.com', password: 'golf123', role: 'member', ghin: '3456789', handicap: 5.7, bio: 'Scratch golfer on his best days.' },
  { name: 'Tom Rivera', email: 'tom@golf.com', password: 'golf123', role: 'member', ghin: '4567890', handicap: 18.3, bio: 'In it for the beer cart.' },
  { name: 'Chris Lee', email: 'chris@golf.com', password: 'golf123', role: 'member', ghin: '5678901', handicap: 22.0, bio: 'Annual winner of the "most improved" award.' },
  { name: 'Steve Brown', email: 'steve@golf.com', password: 'golf123', role: 'member', ghin: '6789012', handicap: 15.6, bio: 'Consistent bogey golfer. Consistent beer drinker.' },
];

const insertUser = db.prepare(
  `INSERT OR IGNORE INTO users (name, email, password_hash, role, ghin_number, handicap, bio) VALUES (?, ?, ?, ?, ?, ?, ?)`
);

for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 10);
  insertUser.run(u.name, u.email, hash, u.role, u.ghin, u.handicap, u.bio);
}
console.log('Users seeded.');

const allUsers = db.prepare('SELECT id, name FROM users').all();
const userMap = {};
allUsers.forEach((u) => (userMap[u.name] = u.id));

// ── Events ───────────────────────────────────────────────────────────────────
const insertEvent = db.prepare(
  `INSERT OR IGNORE INTO events (name, date, location, description, type, format) VALUES (?, ?, ?, ?, ?, ?)`
);

const events = [
  { name: 'Founders Cup 2022', date: '2022-09-10', location: 'Pebble Brook Golf Club', description: 'Our 1st annual tournament. Started it all.', type: 'tournament', format: 'Stroke Play, Net' },
  { name: 'Founders Cup 2023', date: '2023-09-09', location: 'Eagle Ridge Golf Club', description: '2nd annual. Closer finishes, bigger bets.', type: 'tournament', format: 'Stroke Play, Net' },
  { name: 'Spring Scramble 2024', date: '2024-04-20', location: 'Pine Valley Golf Course', description: 'First scramble format. Teams of 2.', type: 'scramble', format: 'Two-Man Scramble' },
  { name: 'Founders Cup 2024', date: '2024-09-07', location: 'Lakeside Golf & Country Club', description: '3rd annual. New trophies, same trash talk.', type: 'tournament', format: 'Stroke Play, Net' },
  { name: 'Winter Classic 2025', date: '2025-02-15', location: 'Sunbelt Golf Resort, Scottsdale AZ', description: 'First destination event. Scottsdale baby!', type: 'tournament', format: 'Stableford' },
  { name: 'Founders Cup 2025', date: '2025-09-13', location: 'Heritage Oaks Golf Club', description: '4th annual. Legend status achieved.', type: 'tournament', format: 'Stroke Play, Net' },
];

for (const e of events) {
  insertEvent.run(e.name, e.date, e.location, e.description, e.type, e.format);
}
console.log('Events seeded.');

const allEvents = db.prepare('SELECT id, name FROM events').all();
const eventMap = {};
allEvents.forEach((e) => (eventMap[e.name] = e.id));

// ── Event Results ─────────────────────────────────────────────────────────────
const insertResult = db.prepare(
  `INSERT OR IGNORE INTO event_results (event_id, user_id, position, gross_score, net_score, points) VALUES (?, ?, ?, ?, ?, ?)`
);

const results = [
  // Founders Cup 2022
  { event: 'Founders Cup 2022', user: 'Dave Wilson',   pos: 1, gross: 78,  net: 72, pts: 100 },
  { event: 'Founders Cup 2022', user: 'Brett Admin',   pos: 2, gross: 82,  net: 74, pts: 75 },
  { event: 'Founders Cup 2022', user: 'Mike Johnson',  pos: 3, gross: 91,  net: 79, pts: 50 },
  { event: 'Founders Cup 2022', user: 'Steve Brown',   pos: 4, gross: 94,  net: 79, pts: 25 },
  { event: 'Founders Cup 2022', user: 'Tom Rivera',    pos: 5, gross: 99,  net: 81, pts: 10 },
  { event: 'Founders Cup 2022', user: 'Chris Lee',     pos: 6, gross: 103, net: 81, pts: 5  },
  // Founders Cup 2023
  { event: 'Founders Cup 2023', user: 'Brett Admin',   pos: 1, gross: 80,  net: 72, pts: 100 },
  { event: 'Founders Cup 2023', user: 'Dave Wilson',   pos: 2, gross: 76,  net: 70, pts: 75 },
  { event: 'Founders Cup 2023', user: 'Tom Rivera',    pos: 3, gross: 95,  net: 77, pts: 50 },
  { event: 'Founders Cup 2023', user: 'Mike Johnson',  pos: 4, gross: 89,  net: 77, pts: 25 },
  { event: 'Founders Cup 2023', user: 'Chris Lee',     pos: 5, gross: 100, net: 78, pts: 10 },
  { event: 'Founders Cup 2023', user: 'Steve Brown',   pos: 6, gross: 96,  net: 81, pts: 5  },
  // Spring Scramble 2024
  { event: 'Spring Scramble 2024', user: 'Dave Wilson',  pos: 1, gross: 65, net: 65, pts: 100 },
  { event: 'Spring Scramble 2024', user: 'Brett Admin',  pos: 1, gross: 65, net: 65, pts: 100 },
  { event: 'Spring Scramble 2024', user: 'Mike Johnson', pos: 2, gross: 67, net: 67, pts: 50 },
  { event: 'Spring Scramble 2024', user: 'Steve Brown',  pos: 2, gross: 67, net: 67, pts: 50 },
  // Founders Cup 2024
  { event: 'Founders Cup 2024', user: 'Mike Johnson',  pos: 1, gross: 88,  net: 76, pts: 100 },
  { event: 'Founders Cup 2024', user: 'Brett Admin',   pos: 2, gross: 83,  net: 75, pts: 75 },
  { event: 'Founders Cup 2024', user: 'Dave Wilson',   pos: 3, gross: 74,  net: 68, pts: 50 },
  { event: 'Founders Cup 2024', user: 'Steve Brown',   pos: 4, gross: 93,  net: 78, pts: 25 },
  { event: 'Founders Cup 2024', user: 'Chris Lee',     pos: 5, gross: 101, net: 79, pts: 10 },
  { event: 'Founders Cup 2024', user: 'Tom Rivera',    pos: 6, gross: 98,  net: 80, pts: 5  },
  // Winter Classic 2025
  { event: 'Winter Classic 2025', user: 'Dave Wilson',  pos: 1, gross: 72, net: 66, pts: 100 },
  { event: 'Winter Classic 2025', user: 'Brett Admin',  pos: 2, gross: 79, net: 71, pts: 75 },
  { event: 'Winter Classic 2025', user: 'Tom Rivera',   pos: 3, gross: 94, net: 76, pts: 50 },
  { event: 'Winter Classic 2025', user: 'Mike Johnson', pos: 4, gross: 88, net: 76, pts: 25 },
  { event: 'Winter Classic 2025', user: 'Steve Brown',  pos: 5, gross: 92, net: 77, pts: 10 },
  { event: 'Winter Classic 2025', user: 'Chris Lee',    pos: 6, gross: 99, net: 77, pts: 5  },
  // Founders Cup 2025
  { event: 'Founders Cup 2025', user: 'Dave Wilson',   pos: 1, gross: 75,  net: 69, pts: 100 },
  { event: 'Founders Cup 2025', user: 'Steve Brown',   pos: 2, gross: 90,  net: 75, pts: 75 },
  { event: 'Founders Cup 2025', user: 'Brett Admin',   pos: 3, gross: 82,  net: 74, pts: 50 },
  { event: 'Founders Cup 2025', user: 'Mike Johnson',  pos: 4, gross: 91,  net: 79, pts: 25 },
  { event: 'Founders Cup 2025', user: 'Tom Rivera',    pos: 5, gross: 97,  net: 79, pts: 10 },
  { event: 'Founders Cup 2025', user: 'Chris Lee',     pos: 6, gross: 104, net: 82, pts: 5  },
];

for (const r of results) {
  const eventId = eventMap[r.event];
  const userId = userMap[r.user];
  if (eventId && userId) {
    insertResult.run(eventId, userId, r.pos, r.gross, r.net, r.pts);
  }
}
console.log('Event results seeded.');

// ── Trophies ─────────────────────────────────────────────────────────────────
const insertTrophy = db.prepare(
  `INSERT OR IGNORE INTO trophies (name, description, year, event_id, winner_id, image_emoji) VALUES (?, ?, ?, ?, ?, ?)`
);

const trophyData = [
  { name: 'Founders Cup Champion', desc: 'Winner of the annual Founders Cup', year: 2022, event: 'Founders Cup 2022', winner: 'Dave Wilson', emoji: '🏆' },
  { name: 'Founders Cup Champion', desc: 'Winner of the annual Founders Cup', year: 2023, event: 'Founders Cup 2023', winner: 'Brett Admin', emoji: '🏆' },
  { name: 'Scramble Kings', desc: 'Spring Scramble champions', year: 2024, event: 'Spring Scramble 2024', winner: 'Dave Wilson', emoji: '👑' },
  { name: 'Founders Cup Champion', desc: 'Winner of the annual Founders Cup', year: 2024, event: 'Founders Cup 2024', winner: 'Mike Johnson', emoji: '🏆' },
  { name: 'Desert Fox', desc: 'Winter Classic Scottsdale champion', year: 2025, event: 'Winter Classic 2025', winner: 'Dave Wilson', emoji: '🌵' },
  { name: 'Founders Cup Champion', desc: 'Winner of the annual Founders Cup', year: 2025, event: 'Founders Cup 2025', winner: 'Dave Wilson', emoji: '🏆' },
  { name: 'Most Improved', desc: 'Biggest handicap drop year-over-year', year: 2023, event: null, winner: 'Chris Lee', emoji: '📈' },
  { name: 'Most Improved', desc: 'Biggest handicap drop year-over-year', year: 2024, event: null, winner: 'Tom Rivera', emoji: '📈' },
  { name: 'Most Improved', desc: 'Biggest handicap drop year-over-year', year: 2025, event: null, winner: 'Mike Johnson', emoji: '📈' },
  { name: 'Closest to the Pin', desc: 'Annual closest to the pin contest winner', year: 2024, event: 'Founders Cup 2024', winner: 'Brett Admin', emoji: '🎯' },
  { name: 'Closest to the Pin', desc: 'Annual closest to the pin contest winner', year: 2025, event: 'Founders Cup 2025', winner: 'Steve Brown', emoji: '🎯' },
  { name: 'Long Drive Champion', desc: 'Longest drive on hole 18', year: 2025, event: 'Founders Cup 2025', winner: 'Dave Wilson', emoji: '💪' },
];

for (const t of trophyData) {
  const eventId = t.event ? (eventMap[t.event] || null) : null;
  const winnerId = t.winner ? (userMap[t.winner] || null) : null;
  insertTrophy.run(t.name, t.desc, t.year, eventId, winnerId, t.emoji);
}
console.log('Trophies seeded.');

// ── Itinerary 2026 ────────────────────────────────────────────────────────────
const insertItem = db.prepare(
  `INSERT OR IGNORE INTO itinerary_items (title, date, time, location, description, type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const itinerary = [
  { title: 'Season Kickoff Dinner', date: '2026-03-14', time: '7:00 PM', location: "O'Malley's Grille, Downtown", description: 'Annual kickoff dinner to plan the year, collect dues, and start the trash talk.', type: 'social', notes: 'Dues: $200/person due at dinner' },
  { title: 'Spring Scramble 2026', date: '2026-04-18', time: '8:00 AM', location: 'Whispering Pines Golf Club', description: 'Two-man scramble format. Tee times starting at 8am. Cart fees included.', type: 'tournament', notes: 'Teams TBD at dinner. Handicaps apply.' },
  { title: 'Member Guest Invitational', date: '2026-06-06', time: '9:00 AM', location: 'Ridgemont Country Club', description: 'Bring a guest! Best ball format. Post-round cookout included.', type: 'tournament', notes: 'Each member brings one guest. Guest fees: $75' },
  { title: 'Midsummer Match Play', date: '2026-07-11', time: '7:30 AM', location: 'Crestwood Golf Course', description: 'Bracket-style match play tournament. Seeded by handicap.', type: 'tournament', notes: 'Bracket announced 1 week prior via group chat' },
  { title: 'Vegas Trip', date: '2026-08-20', time: '6:00 AM', location: 'Las Vegas, NV', description: 'Annual group golf trip to Vegas! Shadow Creek + TPC Las Vegas.', type: 'trip', notes: 'Flight leaves 6am Thursday. Return Sunday. Hotel: MGM Grand.' },
  { title: 'Founders Cup 2026', date: '2026-09-12', time: '7:00 AM', location: 'Augusta National... kidding. TBD', description: 'The big one. 5th Annual Founders Cup. 72-hole stroke play over 2 days.', type: 'tournament', notes: 'Format: Stroke Play, Net. Awards dinner Saturday evening.' },
  { title: 'Awards Banquet & Party', date: '2026-09-12', time: '6:00 PM', location: 'TBD', description: 'Trophy presentation, year-end awards, and season wrap party.', type: 'social', notes: 'Significant others welcome!' },
  { title: 'Fall Social Round', date: '2026-10-17', time: '10:00 AM', location: 'Autumn Ridge Golf Club', description: 'Low-key fun round. No handicaps, no pressure. Just golf and good times.', type: 'social', notes: 'Skins game. $5/skin.' },
];

for (const i of itinerary) {
  insertItem.run(i.title, i.date, i.time, i.location, i.description, i.type, i.notes);
}
console.log('Itinerary seeded.');

// ── Sample Posts ──────────────────────────────────────────────────────────────
const insertPost = db.prepare(
  `INSERT OR IGNORE INTO posts (user_id, content, created_at) VALUES (?, ?, ?)`
);

const postLike = db.prepare(`INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)`);
const postComment = db.prepare(
  `INSERT OR IGNORE INTO post_comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)`
);

const posts = [
  { user: 'Brett Admin', content: 'Founders Cup 2026 is officially on the books! September 12th. Who\'s ready to defend or take the title from Dave? 🏆⛳', date: '2026-01-15 09:00:00' },
  { user: 'Dave Wilson', content: 'Back-to-back Founders Cup champion. Just saying. 😎 Already practicing my acceptance speech for 2026.', date: '2026-01-16 14:30:00' },
  { user: 'Mike Johnson', content: 'Finally broke 85 at Ridgemont today! 84 gross, 72 net with my handicap. The work is paying off! #golflife', date: '2026-02-10 18:00:00' },
  { user: 'Tom Rivera', content: 'Vegas trip is going to be INSANE. Shadow Creek bucket list check. Who\'s going?? 🎰⛳', date: '2026-02-20 11:00:00' },
  { user: 'Chris Lee', content: 'Dropped my handicap 2 more strokes this month. Down to 20. Watch out boys, most improved incoming for year 3! 📉', date: '2026-03-01 16:00:00' },
  { user: 'Steve Brown', content: 'Range session this morning. 200 balls. Ready for Spring Scramble. Dave, watch your back. I\'m coming for you partner. 💪', date: '2026-03-05 08:30:00' },
];

for (const p of posts) {
  const userId = userMap[p.user];
  if (userId) {
    const result = insertPost.run(userId, p.content, p.date);
    const postId = result.lastInsertRowid;
    // Add some random likes
    const likerIds = Object.values(userMap).filter((id) => id !== userId);
    const numLikes = Math.floor(Math.random() * likerIds.length) + 1;
    for (let i = 0; i < numLikes; i++) {
      postLike.run(postId, likerIds[i]);
    }
  }
}

// Add comments to first post
const firstPost = db.prepare('SELECT id FROM posts ORDER BY id LIMIT 1').get();
if (firstPost) {
  postComment.run(firstPost.id, userMap['Dave Wilson'], 'Count me in. Title defense starts now. 🏆', '2026-01-15 09:30:00');
  postComment.run(firstPost.id, userMap['Mike Johnson'], 'This is my year. I can feel it!', '2026-01-15 10:00:00');
  postComment.run(firstPost.id, userMap['Tom Rivera'], 'Vegas trip announcement when Brett??', '2026-01-15 11:00:00');
}

console.log('Posts seeded.');
console.log('\n✅ Database seeded successfully!');
console.log('\nTest accounts:');
users.forEach((u) => console.log(`  ${u.email} / ${u.password} (${u.role})`));
