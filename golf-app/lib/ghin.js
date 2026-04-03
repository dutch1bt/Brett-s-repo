// GHIN API Integration
// GHIN (Golf Handicap and Information Network) is operated by the USGA.
// To use the real API, you need an authorized token from the USGA.
// Set GHIN_TOKEN in your .env.local file.
//
// API base: https://api2.ghin.com/api/v1

const GHIN_BASE = 'https://api2.ghin.com/api/v1';
const GHIN_TOKEN = process.env.GHIN_TOKEN;

export async function lookupGolfer(ghinNumber) {
  if (!GHIN_TOKEN) {
    // Return mock data when no token is configured
    return mockGolferData(ghinNumber);
  }

  try {
    const res = await fetch(
      `${GHIN_BASE}/golfers/search.json?per_page=1&golfer_id=${ghinNumber}`,
      {
        headers: {
          Authorization: `Token token="${GHIN_TOKEN}"`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 3600 }, // cache 1 hour
      }
    );

    if (!res.ok) throw new Error(`GHIN API error: ${res.status}`);

    const data = await res.json();
    const golfer = data.golfers?.[0];
    if (!golfer) return null;

    return {
      ghinNumber: golfer.ghin,
      name: `${golfer.first_name} ${golfer.last_name}`,
      handicapIndex: golfer.handicap_index,
      club: golfer.club_name,
      state: golfer.state,
      lastRevised: golfer.revision_date,
    };
  } catch (err) {
    console.error('GHIN lookup failed:', err.message);
    return null;
  }
}

export async function getHandicapHistory(ghinNumber) {
  if (!GHIN_TOKEN) return [];

  try {
    const res = await fetch(
      `${GHIN_BASE}/golfers/${ghinNumber}/handicap_index.json`,
      {
        headers: { Authorization: `Token token="${GHIN_TOKEN}"` },
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) throw new Error(`GHIN API error: ${res.status}`);
    const data = await res.json();
    return data.handicap_index_revisions || [];
  } catch {
    return [];
  }
}

function mockGolferData(ghinNumber) {
  // Returns mock data when GHIN token is not configured
  return {
    ghinNumber,
    name: 'GHIN Lookup',
    handicapIndex: null,
    club: 'Configure GHIN_TOKEN in .env.local for real data',
    state: null,
    lastRevised: null,
    mock: true,
  };
}
