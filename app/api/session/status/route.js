import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';

export async function GET() {
  try {
    await initDb();

    const rows = await sql`
      SELECT id, name FROM sessions
      WHERE status = 'open'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const session = rows[0];
    return NextResponse.json({
      open: !!session,
      sessionId: session?.id ?? null,
      sessionName: session?.name ?? null,
    });
  } catch (error) {
    console.error('Session status error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
