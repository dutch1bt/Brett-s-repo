// Default scoring rules matching The Masters Pick'em 2025 spreadsheet
export const DEFAULT_SCORING = [
  { label: '1st',       points: 25, condition: (pos) => pos === 1 },
  { label: '2nd',       points: 15, condition: (pos) => pos === 2 },
  { label: '3rd',       points: 12, condition: (pos) => pos === 3 },
  { label: 'Top 10',    points:  8, condition: (pos) => pos >= 4 && pos <= 10 },
  { label: 'Top 25',    points:  5, condition: (pos) => pos >= 11 && pos <= 25 },
  { label: 'Made Cut',  points:  3, condition: (pos) => pos !== null && pos > 25 },
  { label: 'Missed Cut', points: -2, condition: (pos) => pos === null },
];
export const LOW_ROUND_POINTS = 2;

export function scorePlayer(player) {
  const { position, cutMade, isCut, lowRoundCount } = player;

  let posPoints = 0;
  if (isCut) {
    posPoints = -2; // missed cut
  } else if (position !== null) {
    const rule = DEFAULT_SCORING.find((r) => r.condition(position));
    posPoints = rule ? rule.points : 3; // fallback: made cut
  } else {
    // still in progress / active - treat as made cut for now
    posPoints = 3;
  }

  const lowRoundPts = (lowRoundCount || 0) * LOW_ROUND_POINTS;
  return { posPoints, lowRoundPts, total: posPoints + lowRoundPts };
}

export function scoreTeam(picks, playerMap) {
  let total = 0;
  const breakdown = [];

  for (const pick of picks) {
    const player = playerMap[normalizeName(pick.player_name)];
    if (!player) {
      // Player hasn't teed off or not found yet
      breakdown.push({
        player: pick.player_name,
        tier: pick.tier_number,
        posPoints: 0,
        lowRoundPts: 0,
        total: 0,
        position: null,
        status: 'pending',
      });
      continue;
    }

    const { posPoints, lowRoundPts, total: pts } = scorePlayer(player);
    total += pts;
    breakdown.push({
      player: pick.player_name,
      tier: pick.tier_number,
      posPoints,
      lowRoundPts,
      total: pts,
      position: player.positionStr,
      status: player.isCut ? 'CUT' : 'active',
    });
  }

  return { total, breakdown };
}

export function buildPlayerMap(players) {
  const map = {};
  for (const p of players) {
    map[normalizeName(p.name)] = p;
  }
  return map;
}

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}
