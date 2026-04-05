// GHIN Integration — supports both token (full) and public (limited) modes
// Set GHIN_TOKEN in Railway Variables to enable full round sync

const GHIN_API = 'https://api2.ghin.com/api/v1';

function headers() {
  const h = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0',
    'Origin': 'https://www.ghin.com',
    'Referer': 'https://www.ghin.com/',
  };
  if (process.env.GHIN_TOKEN) {
    h['Authorization'] = `Token token="${process.env.GHIN_TOKEN}"`;
  }
  return h;
}

export async function lookupGolfer(ghinNumber) {
  if (!ghinNumber) return null;
  try {
    const res = await fetch(
      `${GHIN_API}/golfers/search.json?golfer_id=${ghinNumber}&per_page=1`,
      { headers: headers(), cache: 'no-store' }
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
    console.error('GHIN lookupGolfer failed:', err.message);
    return null;
  }
}

export async function getHandicapHistory(ghinNumber) {
  if (!ghinNumber) return [];
  try {
    const res = await fetch(
      `${GHIN_API}/golfers/${ghinNumber}/handicap_index.json`,
      { headers: headers(), cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.handicap_index_revisions || []).slice(0, 12);
  } catch {
    return [];
  }
}

// Fetch recent posted rounds for a golfer (requires GHIN_TOKEN for full data)
export async function getPostedRounds(ghinNumber, { limit = 20, since = null } = {}) {
  if (!ghinNumber) return [];

  const params = new URLSearchParams({ per_page: limit, page: 1 });
  if (since) params.set('from_date', since); // YYYY-MM-DD

  try {
    const res = await fetch(
      `${GHIN_API}/golfers/${ghinNumber}/scores.json?${params}`,
      { headers: headers(), cache: 'no-store' }
    );
    if (!res.ok) {
      console.error(`GHIN scores error ${res.status} for GHIN ${ghinNumber}`);
      return [];
    }
    const data = await res.json();
    const scores = data.scores || [];

    return scores.map((s) => ({
      ghinScoreId:   s.id?.toString(),
      date:          s.played_at || s.score_day,
      courseName:    s.course_name,
      courseRating:  s.course_rating,
      slopeRating:   s.slope_rating,
      numberOfHoles: s.number_of_holes || 18,
      adjustedScore: s.adjusted_gross_score || s.gross_score,
      grossScore:    s.gross_score,
      differential:  parseFloat(s.differential) || null,
      netScore:      s.net_score || null,
      courseHandicap:s.course_handicap || null,
      tees:          s.tee_name || null,
      isHome:        s.home_or_away === 'H',
      revisionType:  s.revision_type || null,
    }));
  } catch (err) {
    console.error('GHIN getPostedRounds failed:', err.message);
    return [];
  }
}

export const hasToken = () => !!process.env.GHIN_TOKEN;

// Search GHIN course database by name or city
export async function searchCourses(query) {
  if (!query || query.length < 3) return [];
  try {
    const params = new URLSearchParams({ search_term: query, per_page: 20, page: 1 });
    const res = await fetch(
      `${GHIN_API}/courses.json?${params}`,
      { headers: headers(), cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.courses || []).map((c) => ({
      courseId: c.CourseID || c.id,
      name: c.FullName || c.course_name || c.name,
      city: c.City || c.city,
      state: c.State || c.state,
      tees: (c.Tees || c.tees || []).map((t) => ({
        teeId: t.TeeID || t.id,
        name: t.TeeName || t.name,
        rating: t.Rating || t.course_rating,
        slope: t.Slope || t.slope_rating,
        par: t.Par || t.par,
      })),
    }));
  } catch (err) {
    console.error('GHIN searchCourses failed:', err.message);
    return [];
  }
}

// Post a score to GHIN on behalf of a golfer (requires GHIN_TOKEN with write access)
export async function postScore(ghinNumber, { courseId, teeId, playedAt, numberOfHoles, grossScore, adjustedGrossScore, scoreType = 'T' }) {
  if (!process.env.GHIN_TOKEN) {
    return { error: 'GHIN_TOKEN not configured — score saved locally only' };
  }
  if (!ghinNumber || !courseId || !teeId || !grossScore) {
    return { error: 'Missing required score fields' };
  }

  try {
    const body = {
      golfer_id: ghinNumber,
      scores: [{
        played_at: playedAt,
        course_id: courseId,
        tee_id: teeId,
        number_of_holes: numberOfHoles || 18,
        gross_score: grossScore,
        adjusted_gross_score: adjustedGrossScore || grossScore,
        score_type: scoreType,
      }],
    };

    const res = await fetch(`${GHIN_API}/scores.json`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`GHIN postScore error ${res.status}:`, text);
      return { error: `GHIN returned ${res.status}`, details: text };
    }

    const data = await res.json();
    return { success: true, score: data };
  } catch (err) {
    console.error('GHIN postScore failed:', err.message);
    return { error: err.message };
  }
}
