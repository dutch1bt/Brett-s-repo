// Seeds the database with World Cup 2026 teams and admin user
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'worldcup.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Delete existing DB so seed is idempotent
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    flag TEXT DEFAULT '',
    confederation TEXT DEFAULT '',
    price INTEGER NOT NULL DEFAULT 1,
    group_wins INTEGER NOT NULL DEFAULT 0,
    knockout_wins INTEGER NOT NULL DEFAULT 0,
    eliminated INTEGER NOT NULL DEFAULT 0,
    stage_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS user_picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    picked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, team_id)
  );

  CREATE TABLE IF NOT EXISTS match_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    win_type TEXT NOT NULL,
    points_awarded INTEGER NOT NULL,
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('picks_locked', '0');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('budget', '14');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('min_teams', '2');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('max_teams', '7');
`);
console.log('Schema created.');

// ── Admin User ────────────────────────────────────────────────────────────────
const insertUser = db.prepare(
  `INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`
);
const adminHash = bcrypt.hashSync('worldcup2026', 10);
insertUser.run('Admin', 'admin@worldcup.app', adminHash, 'admin');
console.log('Admin user seeded. Email: admin@worldcup.app / Password: worldcup2026');

// ── Teams ──────────────────────────────────────────────────────────────────────
const insertTeam = db.prepare(
  `INSERT OR IGNORE INTO teams (name, flag, confederation, price) VALUES (?, ?, ?, ?)`
);

const teams = [
  // $7 tier
  { name: 'Spain', flag: '🇪🇸', confederation: 'UEFA', price: 7 },
  { name: 'Argentina', flag: '🇦🇷', confederation: 'CONMEBOL', price: 7 },

  // $5 tier
  { name: 'Germany', flag: '🇩🇪', confederation: 'UEFA', price: 5 },
  { name: 'Netherlands', flag: '🇳🇱', confederation: 'UEFA', price: 5 },

  // $3 tier
  { name: 'Norway', flag: '🇳🇴', confederation: 'UEFA', price: 3 },
  { name: 'USA', flag: '🇺🇸', confederation: 'CONCACAF', price: 3 },

  // $2 tier
  { name: 'Switzerland', flag: '🇨🇭', confederation: 'UEFA', price: 2 },
  { name: 'Senegal', flag: '🇸🇳', confederation: 'CAF', price: 2 },

  // $1 tier - UEFA
  { name: 'France', flag: '🇫🇷', confederation: 'UEFA', price: 1 },
  { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA', price: 1 },
  { name: 'Portugal', flag: '🇵🇹', confederation: 'UEFA', price: 1 },
  { name: 'Italy', flag: '🇮🇹', confederation: 'UEFA', price: 1 },
  { name: 'Belgium', flag: '🇧🇪', confederation: 'UEFA', price: 1 },
  { name: 'Croatia', flag: '🇭🇷', confederation: 'UEFA', price: 1 },
  { name: 'Austria', flag: '🇦🇹', confederation: 'UEFA', price: 1 },
  { name: 'Denmark', flag: '🇩🇰', confederation: 'UEFA', price: 1 },
  { name: 'Serbia', flag: '🇷🇸', confederation: 'UEFA', price: 1 },
  { name: 'Turkey', flag: '🇹🇷', confederation: 'UEFA', price: 1 },
  { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA', price: 1 },
  { name: 'Hungary', flag: '🇭🇺', confederation: 'UEFA', price: 1 },
  { name: 'Romania', flag: '🇷🇴', confederation: 'UEFA', price: 1 },
  { name: 'Slovakia', flag: '🇸🇰', confederation: 'UEFA', price: 1 },

  // $1 tier - CONMEBOL
  { name: 'Brazil', flag: '🇧🇷', confederation: 'CONMEBOL', price: 1 },
  { name: 'Colombia', flag: '🇨🇴', confederation: 'CONMEBOL', price: 1 },
  { name: 'Uruguay', flag: '🇺🇾', confederation: 'CONMEBOL', price: 1 },
  { name: 'Ecuador', flag: '🇪🇨', confederation: 'CONMEBOL', price: 1 },
  { name: 'Paraguay', flag: '🇵🇾', confederation: 'CONMEBOL', price: 1 },
  { name: 'Venezuela', flag: '🇻🇪', confederation: 'CONMEBOL', price: 1 },

  // $1 tier - CONCACAF
  { name: 'Canada', flag: '🇨🇦', confederation: 'CONCACAF', price: 1 },
  { name: 'Mexico', flag: '🇲🇽', confederation: 'CONCACAF', price: 1 },
  { name: 'Panama', flag: '🇵🇦', confederation: 'CONCACAF', price: 1 },
  { name: 'Costa Rica', flag: '🇨🇷', confederation: 'CONCACAF', price: 1 },
  { name: 'Jamaica', flag: '🇯🇲', confederation: 'CONCACAF', price: 1 },

  // $1 tier - CAF
  { name: 'Morocco', flag: '🇲🇦', confederation: 'CAF', price: 1 },
  { name: 'Nigeria', flag: '🇳🇬', confederation: 'CAF', price: 1 },
  { name: 'Cameroon', flag: '🇨🇲', confederation: 'CAF', price: 1 },
  { name: 'Egypt', flag: '🇪🇬', confederation: 'CAF', price: 1 },
  { name: 'Ghana', flag: '🇬🇭', confederation: 'CAF', price: 1 },
  { name: 'South Africa', flag: '🇿🇦', confederation: 'CAF', price: 1 },
  { name: 'Tunisia', flag: '🇹🇳', confederation: 'CAF', price: 1 },
  { name: 'Ivory Coast', flag: '🇨🇮', confederation: 'CAF', price: 1 },
  { name: 'Mali', flag: '🇲🇱', confederation: 'CAF', price: 1 },

  // $1 tier - AFC
  { name: 'Japan', flag: '🇯🇵', confederation: 'AFC', price: 1 },
  { name: 'South Korea', flag: '🇰🇷', confederation: 'AFC', price: 1 },
  { name: 'Australia', flag: '🇦🇺', confederation: 'AFC', price: 1 },
  { name: 'Saudi Arabia', flag: '🇸🇦', confederation: 'AFC', price: 1 },
  { name: 'Iran', flag: '🇮🇷', confederation: 'AFC', price: 1 },
  { name: 'Jordan', flag: '🇯🇴', confederation: 'AFC', price: 1 },
  { name: 'Iraq', flag: '🇮🇶', confederation: 'AFC', price: 1 },
  { name: 'Uzbekistan', flag: '🇺🇿', confederation: 'AFC', price: 1 },

  // $1 tier - OFC
  { name: 'New Zealand', flag: '🇳🇿', confederation: 'OFC', price: 1 },
];

for (const team of teams) {
  insertTeam.run(team.name, team.flag, team.confederation, team.price);
}
console.log(`${teams.length} teams seeded.`);

console.log('\n✅ Database seeded successfully!');
console.log('Admin login: admin@worldcup.app / worldcup2026');
