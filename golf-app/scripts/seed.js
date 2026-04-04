// Run with: node --experimental-sqlite scripts/seed.js
// Seeds the database with sample data
// Uses Node.js built-in SQLite (Node 22.5+) - no extra packages needed

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'golf.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Delete existing DB so seed is idempotent
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────────────────────────
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

// ── Users ─────────────────────────────────────────────────────────────────────
// Only the admin account is seeded. Real members sign up and connect their GHIN.
const insertUser = db.prepare(
  `INSERT OR IGNORE INTO users (name, email, password_hash, role, bio) VALUES (?, ?, ?, ?, ?)`
);
const adminHash = bcrypt.hashSync('changeme123', 10);
insertUser.run('Brett', 'brett@sandbaggers.com', adminHash, 'admin', 'Founder & commissioner of the Sandbaggers.');
console.log('Admin user seeded. Email: brett@sandbaggers.com / Password: changeme123');

const allUsers = db.prepare('SELECT id, name FROM users').all();
const userMap = {};
allUsers.forEach((u) => (userMap[u.name] = u.id));

// ── Events ────────────────────────────────────────────────────────────────────
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

// No event results or trophies seeded — admins enter real data via the app.

// ── Itinerary ─────────────────────────────────────────────────────────────────
const insertItem = db.prepare(
  `INSERT OR IGNORE INTO itinerary_items (title, date, time, location, description, type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const itinerary = [
  { title: 'Season Kickoff Dinner', date: '2026-03-14', time: '7:00 PM', location: "O'Malley's Grille, Downtown", description: 'Annual kickoff dinner to plan the year, collect dues, and start the trash talk.', type: 'social', notes: 'Dues: $200/person due at dinner' },
  { title: 'Spring Scramble 2026', date: '2026-04-18', time: '8:00 AM', location: 'Whispering Pines Golf Club', description: 'Two-man scramble format. Tee times starting at 8am. Cart fees included.', type: 'tournament', notes: 'Teams TBD at dinner. Handicaps apply.' },
  { title: 'Member Guest Invitational', date: '2026-06-06', time: '9:00 AM', location: 'Ridgemont Country Club', description: 'Bring a guest! Best ball format. Post-round cookout included.', type: 'tournament', notes: 'Each member brings one guest. Guest fees: $75' },
  { title: 'Midsummer Match Play', date: '2026-07-11', time: '7:30 AM', location: 'Crestwood Golf Course', description: 'Bracket-style match play tournament. Seeded by handicap.', type: 'tournament', notes: 'Bracket announced 1 week prior via group chat' },
  { title: 'Vegas Trip', date: '2026-08-20', time: '6:00 AM', location: 'Las Vegas, NV', description: 'Annual group golf trip to Vegas! Shadow Creek + TPC Las Vegas.', type: 'trip', notes: 'Flight leaves 6am Thursday. Return Sunday. Hotel: MGM Grand.' },
  { title: 'Founders Cup 2026', date: '2026-09-12', time: '7:00 AM', location: 'TBD', description: 'The big one. 5th Annual Founders Cup.', type: 'tournament', notes: 'Format: Stroke Play, Net. Awards dinner Saturday evening.' },
  { title: 'Awards Banquet & Party', date: '2026-09-12', time: '6:00 PM', location: 'TBD', description: 'Trophy presentation, year-end awards, and season wrap party.', type: 'social', notes: 'Significant others welcome!' },
  { title: 'Fall Social Round', date: '2026-10-17', time: '10:00 AM', location: 'Autumn Ridge Golf Club', description: 'Low-key fun round. No handicaps, no pressure.', type: 'social', notes: 'Skins game. $5/skin.' },
];
for (const i of itinerary) {
  insertItem.run(i.title, i.date, i.time, i.location, i.description, i.type, i.notes);
}
console.log('Itinerary seeded.');

// No fake posts seeded — real members post their own content.

console.log('\n✅ Database seeded successfully!');
console.log('\nAdmin login: brett@sandbaggers.com / changeme123');
