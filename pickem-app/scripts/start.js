// Railway start script: seeds DB if empty, then starts Next.js
const { execSync, spawn } = require('child_process');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'pickem.db');

// Ensure the directory exists (for Railway volume mounts)
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Check if we need to seed
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    espn_event_id TEXT,
    buy_in INTEGER NOT NULL DEFAULT 20,
    status TEXT NOT NULL DEFAULT 'upcoming',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const count = db.prepare('SELECT COUNT(*) as n FROM tournaments').get().n;
db.close();

if (count === 0) {
  console.log('Empty database detected — seeding 2025 Masters data...');
  try {
    execSync(`node ${path.join(__dirname, '..', 'lib', 'seed.js')}`, { stdio: 'inherit' });
  } catch (e) {
    console.error('Seed failed (non-fatal):', e.message);
  }
} else {
  console.log(`Database has ${count} tournament(s) — skipping seed.`);
}

// Start Next.js
console.log('Starting Next.js...');
const port = process.env.PORT || 3001;
const next = spawn('node', ['node_modules/.bin/next', 'start', '-p', String(port), '-H', '0.0.0.0'], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

next.on('exit', (code) => process.exit(code));
