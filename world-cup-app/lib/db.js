import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'worldcup.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let _db = null;

export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL');
    _db.exec('PRAGMA foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db) {
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
}
