// ESPN unofficial API for golf leaderboard
const ESPN_API = 'https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard';

export async function fetchLeaderboard(espnEventId) {
  const url = espnEventId
    ? `${ESPN_API}?event=${espnEventId}`
    : ESPN_API;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);

  const data = await res.json();
  return parseLeaderboard(data);
}

function parseLeaderboard(data) {
  const event = data?.events?.[0];
  if (!event) return { players: [], eventName: 'Unknown', status: 'unknown' };

  const eventName = event.name || event.shortName || 'Tournament';
  const status = event.status?.type?.description || 'unknown';
  const players = [];

  const competition = event.competitions?.[0];
  if (!competition) return { players, eventName, status };

  // Track low round per round
  const roundLows = {}; // round -> lowest score
  const competitorRounds = [];

  for (const comp of competition.competitors || []) {
    const name = comp.athlete?.displayName || comp.displayName || '';
    const positionStr = comp.status?.position?.displayValue || comp.status?.displayValue || '';
    const position = parsePosition(positionStr);
    const cutMade = !['CUT', 'WD', 'DQ', 'MDF'].includes(positionStr?.toUpperCase());
    const isCut = ['CUT', 'WD', 'DQ', 'MDF'].includes(positionStr?.toUpperCase());

    const rounds = (comp.linescores || []).map((ls, i) => ({
      round: i + 1,
      score: ls.value != null ? ls.value : null,
    }));

    // track per-round lows
    for (const r of rounds) {
      if (r.score != null && !isNaN(r.score)) {
        if (roundLows[r.round] == null || r.score < roundLows[r.round]) {
          roundLows[r.round] = r.score;
        }
      }
    }

    competitorRounds.push({ name, position, positionStr, cutMade, isCut, rounds });
  }

  // Build player list with lowRound flags
  for (const c of competitorRounds) {
    const lowRoundCount = c.rounds.filter(
      (r) => r.score != null && roundLows[r.round] != null && r.score === roundLows[r.round]
    ).length;

    players.push({
      name: c.name,
      position: c.position,
      positionStr: c.positionStr,
      cutMade: c.cutMade,
      isCut: c.isCut,
      rounds: c.rounds,
      lowRoundCount,
    });
  }

  return { players, eventName, status, roundLows };
}

function parsePosition(str) {
  if (!str) return null;
  if (['CUT', 'WD', 'DQ', 'MDF'].includes(str.toUpperCase())) return null;
  const clean = str.replace(/^T/, '');
  const n = parseInt(clean, 10);
  return isNaN(n) ? null : n;
}
