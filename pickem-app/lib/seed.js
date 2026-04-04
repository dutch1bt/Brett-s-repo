// Run with: node lib/seed.js
// Seeds The Masters Pick'em 2025 data from the spreadsheet

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'pickem.db'));
db.pragma('journal_mode = WAL');
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
  CREATE TABLE IF NOT EXISTS tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    tier_number INTEGER NOT NULL,
    player_name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'unpaid'
  );
  CREATE TABLE IF NOT EXISTS picks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    tier_number INTEGER NOT NULL,
    player_name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    place INTEGER NOT NULL,
    percent REAL NOT NULL
  );
`);

// Clear existing data
db.exec('DELETE FROM picks; DELETE FROM teams; DELETE FROM tiers; DELETE FROM payouts; DELETE FROM tournaments;');

// Insert tournament
const tournamentId = db.prepare(
  `INSERT INTO tournaments (name, espn_event_id, buy_in, status) VALUES (?, ?, ?, ?)`
).run("The Masters 2025", "20264400", 20, "complete").lastInsertRowid;

// Payouts
db.prepare(`INSERT INTO payouts (tournament_id, place, percent) VALUES (?, ?, ?)`).run(tournamentId, 1, 0.70);
db.prepare(`INSERT INTO payouts (tournament_id, place, percent) VALUES (?, ?, ?)`).run(tournamentId, 2, 0.20);
db.prepare(`INSERT INTO payouts (tournament_id, place, percent) VALUES (?, ?, ?)`).run(tournamentId, 3, 0.10);

// Tier 1 players
const tier1 = ['Bryson DeChambeau','Collin Morikawa','Hideki Matsuyama','Joaquín Niemann','Jon Rahm','Justin Thomas','Ludvig Åberg','Rory McIlroy','Scottie Scheffler','Xander Schauffele'];
// Tier 2 players
const tier2 = ['Akshay Bhatia','Brooks Koepka','Cameron Smith','Jordan Spieth','Min Woo Lee','Patrick Cantlay','Robert MacIntyre','Russell Henley','Shane Lowry','Tommy Fleetwood','Tyrrell Hatton','Viktor Hovland','Will Zalatoris'];
// Tier 3 players
const tier3 = ['Aaron Rai','Adam Scott','Billy Horschel','Brian Harman','Byeong Hun An','Corey Conners','Daniel Berger','Davis Thompson','Dustin Johnson','J. J. Spaun','Jason Day','Justin Rose','Keegan Bradley','Matt Fitzpatrick','Maverick McNealy','Patrick Reed','Phil Mickelson','Sahith Theegala','Sam Burns','Sepp Straka','Sergio Garcia','Sungjae Im','Taylor Pendrith','Tom Kim','Tony Finau','Wyndham Clark'];
// Tier 4 players
const tier4 = ['Adam Schenk','Angel Cabrera','Austin Eckroat','Bernhard Langer','Brian Campbell','Bubba Watson','Cam Davis','Cameron Young','Charl Schwartzel','Chris Kirk','Danny Willett','Davis Riley','Denny McCarthy','Evan Beck','Fred Couples','Harris English','Hiroshi Tai','J.T. Poston','Jhonattan Vegas','Joe Highsmith','Jose Luis Ballester','Jose Maria Olazábal','Justin Hastings','Kevin Yu','Laurie Canter','Lucas Glover','Matt Mccarty','Matthieu Pavon','Max Greyserman','Max Homa','Michael Kim','Mike Weir','Nick Dunlap','Nick Taylor','Nicolai Højgaard','Nicolas Echavarria','Noah Kent','Patton Kizzire','Rafael Campos','Rasmus Højgaard','Stephan Jaeger','Thomas Detry','Thriston Lawrence','Tom Hoge','Vijay Singh','Zach Johnson'];

const insertTier = db.prepare(`INSERT INTO tiers (tournament_id, tier_number, player_name) VALUES (?, ?, ?)`);
for (const p of tier1) insertTier.run(tournamentId, 1, p);
for (const p of tier2) insertTier.run(tournamentId, 2, p);
for (const p of tier3) insertTier.run(tournamentId, 3, p);
for (const p of tier4) insertTier.run(tournamentId, 4, p);

// Teams with picks from the spreadsheet
const teamsData = [
  { team: "Shankapotamus ⛳️", owner: "Brett Dutcher", paid: true, picks: ["Rory McIlroy", "Jordan Spieth", "Sahith Theegala", "Cam Davis"] },
  { team: "9 O'clock on the 9th Green", owner: "Nate Feldpausch", paid: true, picks: ["Scottie Scheffler", "Tommy Fleetwood", "Sepp Straka", "Thomas Detry"] },
  { team: "Better Than Most", owner: "Dave Phillips", paid: true, picks: ["Scottie Scheffler", "Viktor Hovland", "Sam Burns", "Cameron Young"] },
  { team: "Maher", owner: "John Maher", paid: true, picks: ["Scottie Scheffler", "Brooks Koepka", "Sergio Garcia", "Danny Willett"] },
  { team: "Wish Louis was Playing", owner: "Jake Wester", paid: true, picks: ["Collin Morikawa", "Shane Lowry", "Justin Rose", "Michael Kim"] },
  { team: "Putts n' Stuff", owner: "Nick Ranns", paid: true, picks: ["Collin Morikawa", "Patrick Cantlay", "Dustin Johnson", "Cameron Young"] },
  { team: "Scottie Style", owner: "John Sinacola", paid: true, picks: ["Scottie Scheffler", "Shane Lowry", "Sergio Garcia", "Denny McCarthy"] },
  { team: "Back to back to back", owner: "Troy", paid: true, picks: ["Scottie Scheffler", "Jordan Spieth", "Maverick McNealy", "Cameron Young"] },
  { team: "And33znutz", owner: "Andy Semanson", paid: true, picks: ["Rory McIlroy", "Russell Henley", "Tony Finau", "J.T. Poston"] },
  { team: "Magnolia Lane", owner: "Steve Wester", paid: true, picks: ["Scottie Scheffler", "Brooks Koepka", "Maverick McNealy", "Nicolai Højgaard"] },
  { team: "Shooter's Turn", owner: "James Dutcher", paid: true, picks: ["Rory McIlroy", "Shane Lowry", "Patrick Reed", "Cameron Young"] },
  { team: "It's all in the hips", owner: "Duane Brown", paid: true, picks: ["Ludvig Åberg", "Patrick Cantlay", "Corey Conners", "Nick Taylor"] },
  { team: "Member's Bounce", owner: "Patrick Doyle", paid: true, picks: ["Rory McIlroy", "Tommy Fleetwood", "Corey Conners", "Max Homa"] },
  { team: "Nova", owner: "Joe N", paid: true, picks: ["Scottie Scheffler", "Akshay Bhatia", "Billy Horschel", "Cameron Young"] },
  { team: "Vandegriff", owner: "Aaron Vandegriff", paid: true, picks: ["Scottie Scheffler", "Brooks Koepka", "Tony Finau", "Matt Mccarty"] },
  { team: "Good Good Good", owner: "Kyle B.", paid: true, picks: ["Collin Morikawa", "Robert MacIntyre", "Corey Conners", "Lucas Glover"] },
  { team: "Kyle Beeler", owner: "Kyle B.", paid: true, picks: ["Collin Morikawa", "Brooks Koepka", "Wyndham Clark", "Cameron Young"] },
  { team: "Faldo & Barker", owner: "Nick W", paid: true, picks: ["Jon Rahm", "Brooks Koepka", "Keegan Bradley", "Lucas Glover"] },
  { team: "Kroll's Holes", owner: "Nick K", paid: true, picks: ["Bryson DeChambeau", "Shane Lowry", "Jason Day", "J.T. Poston"] },
  { team: "The Putt Pirates", owner: "Evan Timm", paid: true, picks: ["Xander Schauffele", "Shane Lowry", "Justin Rose", "Max Homa"] },
  { team: "Bizzle Bone 🦴", owner: "Mike Bielski", paid: true, picks: ["Collin Morikawa", "Viktor Hovland", "Jason Day", "Max Homa"] },
  { team: "Rob Won", owner: "Boss Team 1", paid: true, picks: ["Xander Schauffele", "Viktor Hovland", "Sahith Theegala", "Cam Davis"] },
  { team: "Rob Won Two", owner: "Boss Team 2", paid: true, picks: ["Ludvig Åberg", "Brooks Koepka", "Tony Finau", "Nicolai Højgaard"] },
  { team: "Only Boss That Has Won this Before", owner: "Becca", paid: true, picks: ["Joaquín Niemann", "Will Zalatoris", "Tony Finau", "Nicolai Højgaard"] },
  { team: "Johnson Wagner", owner: "Mitch", paid: true, picks: ["Rory McIlroy", "Brooks Koepka", "Justin Rose", "Michael Kim"] },
  { team: "ParTee Animals", owner: "John L.", paid: true, picks: ["Rory McIlroy", "Tommy Fleetwood", "Sepp Straka", "Lucas Glover"] },
  { team: "Hosel Rocket", owner: "Weasel", paid: true, picks: ["Rory McIlroy", "Shane Lowry", "Maverick McNealy", "Stephan Jaeger"] },
  { team: "Putt Blugs", owner: "OB", paid: true, picks: ["Rory McIlroy", "Brooks Koepka", "Sepp Straka", "Denny McCarthy"] },
  { team: "Baseball Hacks Only", owner: "Ganci", paid: true, picks: ["Rory McIlroy", "Viktor Hovland", "Justin Rose", "Max Homa"] },
  { team: "Rocky", owner: "Rocky", paid: true, picks: ["Rory McIlroy", "Rory McIlroy", "Rory McIlroy", "Rory McIlroy"] },
];

const insertTeam = db.prepare(`INSERT INTO teams (tournament_id, team_name, owner_name, payment_status) VALUES (?, ?, ?, ?)`);
const insertPick = db.prepare(`INSERT INTO picks (team_id, tournament_id, tier_number, player_name) VALUES (?, ?, ?, ?)`);

for (const t of teamsData) {
  const teamId = insertTeam.run(tournamentId, t.team, t.owner, t.paid ? 'paid' : 'unpaid').lastInsertRowid;
  for (let i = 0; i < t.picks.length; i++) {
    insertPick.run(teamId, tournamentId, i + 1, t.picks[i]);
  }
}

console.log(`Seeded tournament ID=${tournamentId} with ${teamsData.length} teams.`);
db.close();
