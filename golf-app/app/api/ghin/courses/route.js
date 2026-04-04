import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchCourses } from '@/lib/ghin';

// GET /api/ghin/courses?q=Pebble
export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  if (q.length < 3) {
    return NextResponse.json({ courses: [] });
  }

  const courses = await searchCourses(q);
  return NextResponse.json({ courses });
}
