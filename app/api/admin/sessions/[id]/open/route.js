import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function PUT(request, { params }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await initDb();
    const { id } = await params;

    // Close any currently open sessions first
    await sql`
      UPDATE sessions SET status = 'closed', closed_at = NOW()
      WHERE status = 'open'
    `;

    // Open the requested session
    const rows = await sql`
      UPDATE sessions
      SET status = 'open', closed_at = NULL
      WHERE id = ${parseInt(id, 10)}
      RETURNING id, name, status, created_at, closed_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: rows[0] });
  } catch (error) {
    console.error('Open session error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
