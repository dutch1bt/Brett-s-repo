#!/usr/bin/env node
// Production startup script for Railway
// Seeds the database on first run, then starts Next.js

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'golf.db');
const dataDir = path.dirname(DB_PATH);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Check if database already has users (i.e. already seeded)
let needsSeed = true;
try {
  const db = new DatabaseSync(DB_PATH);
  const result = db.prepare("SELECT COUNT(*) AS n FROM users").get();
  needsSeed = result.n === 0;
  db.close();
} catch {
  needsSeed = true;
}

if (needsSeed) {
  console.log('🌱 Seeding database...');
  try {
    execSync(`node --experimental-sqlite ${path.join(__dirname, 'seed.js')}`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_PATH: DB_PATH },
    });
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exit(1);
  }
} else {
  console.log('✅ Database already seeded, skipping.');
}

console.log('🚀 Starting Next.js...');
// Hand off to Next.js (this replaces the current process)
const { spawn } = require('child_process');
const next = spawn(
  'node',
  ['--experimental-sqlite', 'node_modules/.bin/next', 'start', '-H', '0.0.0.0'],
  { stdio: 'inherit', env: process.env }
);
next.on('exit', (code) => process.exit(code));
