// GHIN Public Lookup
// Uses the GHIN public API endpoint that backs ghin.com golfer lookup.
// No token required — same data source The Grint and other apps use.

const GHIN_API = 'https://api2.ghin.com/api/v1';

// App token used by ghin.com's own frontend (public, read-only)
const APP_TOKEN = 'no_secret_needed';

export async function lookupGolfer(ghinNumber) {
  if (!ghinNumber) return null;

  try {
    // GHIN public search endpoint
    const res = await fetch(
      `${GHIN_API}/golfers/search.json?golfer_id=${ghinNumber}&per_page=1`,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Origin': 'https://www.ghin.com',
          'Referer': 'https://www.ghin.com/',
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) throw new Error(`GHIN error: ${res.status}`);

    const data = await res.json();
    const golfer = data.golfers?.[0];
    if (!golfer) return null;

    return {
      ghinNumber: golfer.ghin,
      name: `${golfer.first_name} ${golfer.last_name}`,
      handicapIndex: parseFloat(golfer.handicap_index) || null,
      club: golfer.club_name || null,
      state: golfer.state || null,
      lastRevised: golfer.revision_date || null,
      status: golfer.status || null,
    };
  } catch (err) {
    console.error('GHIN lookup failed:', err.message);
    return null;
  }
}

export async function getHandicapHistory(ghinNumber) {
  if (!ghinNumber) return [];
  try {
    const res = await fetch(
      `${GHIN_API}/golfers/${ghinNumber}/handicap_index.json`,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
          'Origin': 'https://www.ghin.com',
          'Referer': 'https://www.ghin.com/',
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.handicap_index_revisions || []).slice(0, 12); // last 12 revisions
  } catch {
    return [];
  }
}
