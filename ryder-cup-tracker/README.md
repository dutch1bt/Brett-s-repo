# Sandbaggers Ryder Cup Tracker

A single-page, mobile-friendly scoreboard for the 13th Annual Sandbaggers Invitational Ryder Cup (Team Black vs. Team Blue). It's a static HTML file that syncs live through Firebase Firestore, so anyone with the link and the page open sees score updates in real time — no login required.

Point structure is wired in to match the format from the invite: Thursday Top Two Match (2 pts) + Pink Ball (4 flights, 3/1/0/0 pts), Friday AM Best Ball (5 pts), Friday PM Scramble (5 pts), Saturday AM Singles (10 pts) — 26 points total, 13.5 to win.

## One-time setup (~5 minutes)

1. Go to the [Firebase console](https://console.firebase.google.com/) and create a new project (name it anything, e.g. "sandbaggers-ryder-cup"). You can decline Google Analytics.
2. In the left sidebar: **Build → Firestore Database → Create database**. Choose a region close to your group and start in **test mode** (you'll lock it down in step 5).
3. Click the gear icon → **Project settings**, scroll to "Your apps", click the **</>** (web) icon, register an app (no need for Firebase Hosting), and copy the `firebaseConfig` object it shows you — it looks like:
   ```json
   {
     "apiKey": "...",
     "authDomain": "...",
     "projectId": "...",
     "storageBucket": "...",
     "messagingSenderId": "...",
     "appId": "..."
   }
   ```
4. Open `index.html` (host it anywhere static — GitHub Pages, Netlify, Vercel, or just double-click it locally) and click the ⚙️ gear icon in the top corner. Paste that JSON into the "Firebase config" box, optionally set an Event/Room ID and your display name, and click **Save & Connect**.
5. Lock down Firestore so only this app's data is writable, without requiring anyone to log in. In the Firebase console under **Firestore Database → Rules**, use:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /ryderCupEvents/{eventId} {
         allow read, write: if true;
       }
     }
   }
   ```
   This scopes open access to just the `ryderCupEvents` collection this app uses (rather than leaving the whole test-mode database wide open), which is fine for low-stakes data like golf match results. Publish the rule.
6. Send the hosted URL to the group. Everyone who opens it and has the same Event/Room ID (default `sandbaggers-ryder-cup-2026`) sees and can edit the same live scoreboard.

## Using it

- **Matches tab**: enter results per match (Team Black win / Team Blue win / Halved / Not played). Points total automatically and the scoreboard bar updates live for everyone.
- **Pink Ball flights**: assign each of the 4 flights to a team and pick its placement (1st/2nd/3rd/4th); points are computed from placement (3/1/0/0).
- **Rosters tab**: optional — list each team's players for reference. Not linked to scoring.
- **Format tab**: quick recap of the rules, plus a "Reset all scores to defaults" button (keeps rosters, clears results).
- Match labels (e.g. "Match 1", "Sinacola vs. Beeler") are editable text — rename them to actual pairings once the draft/schedule is set.

## Notes

- No backend/build step — it's one HTML file with Firebase loaded from a CDN.
- If you'd rather not manage Firestore rules yourself, you can restrict `allow read, write` to a specific App Check token or add a simple shared-secret check, but for a friends' golf trip the scoped rule above is a reasonable tradeoff of convenience vs. exposure (worst case, someone messes with match scores, which is easy to reset).
