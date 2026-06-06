#!/usr/bin/env node
// Production startup script — seeds DB on first run, then starts Next.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'worldcup.db');
const dataDir = path.dirname(DB_PATH);

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let needsSeed = true;
try {
  const db = new Database(DB_PATH);
  const result = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  needsSeed = result.n === 0;
  db.close();
} catch {
  needsSeed = true;
}

if (needsSeed) {
  console.log('Seeding database...');
  try {
    execSync(`node ${path.join(__dirname, 'seed.js')}`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_PATH: DB_PATH },
    });
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exit(1);
  }
} else {
  console.log('Database already seeded, skipping.');
}

console.log('Starting Next.js...');
const next = spawn('node', ['node_modules/.bin/next', 'start', '-H', '0.0.0.0'], {
  stdio: 'inherit',
  env: process.env,
});
next.on('exit', (code) => process.exit(code));
