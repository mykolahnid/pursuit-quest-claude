import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await initDb();

    const rows = await sql`
      SELECT s.id, s.name, s.status, s.created_at, s.closed_at,
             COUNT(r.id)::int AS response_count
      FROM sessions s
      LEFT JOIN responses r ON r.session_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    return NextResponse.json({ sessions: rows });
  } catch (error) {
    console.error('List sessions error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await initDb();

    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Session name is required' },
        { status: 400 }
      );
    }

    // Close any currently open sessions
    await sql`
      UPDATE sessions SET status = 'closed', closed_at = NOW()
      WHERE status = 'open'
    `;

    // Create new session
    const rows = await sql`
      INSERT INTO sessions (name) VALUES (${name.trim()})
      RETURNING id, name, status, created_at, closed_at
    `;

    return NextResponse.json({ session: rows[0] });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
