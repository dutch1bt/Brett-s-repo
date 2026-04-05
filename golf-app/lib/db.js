// Uses Node.js built-in SQLite (available in Node 22.5+) - no native compilation needed
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'golf.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let _db = null;

export function getDb() {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL');
    _db.exec('PRAGMA foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

// Thin wrapper so callers use the same .get() / .all() / .run() API as before
// node:sqlite uses .get() returning one row, .all() returning array, .run() for mutations
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      ghin_number TEXT,
      handicap REAL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      bio TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'tournament',
      format TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      position INTEGER,
      gross_score INTEGER,
      net_score INTEGER,
      points REAL DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS trophies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      year INTEGER NOT NULL,
      event_id INTEGER REFERENCES events(id),
      winner_id INTEGER REFERENCES users(id),
      image_emoji TEXT DEFAULT '🏆',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS live_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hole INTEGER NOT NULL,
      score INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, user_id, hole)
    );

    CREATE TABLE IF NOT EXISTS itinerary_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      location TEXT,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'event',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tracks GHIN rounds that have been synced to the feed
    CREATE TABLE IF NOT EXISTS ghin_synced_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ghin_score_id TEXT NOT NULL,
      post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, ghin_score_id)
    );

    -- Annual trip (one active at a time — previous years archived)
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      location TEXT,
      dates_text TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      hotel TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trip_itinerary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      time TEXT,
      description TEXT NOT NULL,
      location TEXT,
      type TEXT DEFAULT 'activity'
    );

    CREATE TABLE IF NOT EXISTS trip_tee_times (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      round_name TEXT NOT NULL,
      course TEXT,
      tee_time TEXT NOT NULL,
      players TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS trip_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      room_name TEXT NOT NULL,
      player_name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS trip_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      handicap REAL,
      hcp_80 REAL,
      hcp_100 REAL,
      hcp_9hole REAL,
      team TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS trip_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      player_name TEXT NOT NULL,
      item TEXT NOT NULL,
      amount REAL,
      paid INTEGER DEFAULT 0,
      venmo_to TEXT,
      UNIQUE(trip_id, player_name, item)
    );

    -- Pick'em pool (one active at a time — Masters, etc.)
    CREATE TABLE IF NOT EXISTS pools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tournament TEXT NOT NULL,
      year INTEGER NOT NULL,
      buy_in REAL DEFAULT 20,
      status TEXT NOT NULL DEFAULT 'active',
      draft_deadline TEXT,
      venmo TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Golfer tiers for a pool (stored as JSON array)
    CREATE TABLE IF NOT EXISTS pool_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_id INTEGER NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
      tier_number INTEGER NOT NULL,
      golfers TEXT NOT NULL DEFAULT '[]',
      UNIQUE(pool_id, tier_number)
    );

    -- Each participant entry (team)
    CREATE TABLE IF NOT EXISTS pool_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_id INTEGER NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
      team_name TEXT NOT NULL,
      participant_name TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Each entry's 4 golfer picks (one per tier)
    CREATE TABLE IF NOT EXISTS pool_picks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL REFERENCES pool_entries(id) ON DELETE CASCADE,
      tier_number INTEGER NOT NULL,
      golfer_name TEXT NOT NULL,
      UNIQUE(entry_id, tier_number)
    );

    -- Live golfer results (admin enters/updates these)
    CREATE TABLE IF NOT EXISTS pool_golfer_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_id INTEGER NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
      golfer_name TEXT NOT NULL,
      position TEXT,
      score TEXT,
      made_cut INTEGER NOT NULL DEFAULT 1,
      low_round INTEGER NOT NULL DEFAULT 0,
      points REAL NOT NULL DEFAULT 0,
      UNIQUE(pool_id, golfer_name)
    );

    -- Scoring rules per pool
    CREATE TABLE IF NOT EXISTS pool_scoring_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_id INTEGER NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      points REAL NOT NULL,
      UNIQUE(pool_id, label)
    );
  `);
}
