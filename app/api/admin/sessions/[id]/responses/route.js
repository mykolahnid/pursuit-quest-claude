import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request, { params }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await initDb();
    const { id } = await params;

    const rows = await sql`
      SELECT id, q1_answer, q2_answer, created_at
      FROM responses
      WHERE session_id = ${parseInt(id, 10)}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({ responses: rows });
  } catch (error) {
    console.error('Get responses error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await initDb();
    const { id } = await params;

    await sql`DELETE FROM responses WHERE session_id = ${parseInt(id, 10)}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clear responses error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
