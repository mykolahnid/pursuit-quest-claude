import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { analyzeCorrelation } from '@/lib/correlation';

export async function GET(request, { params }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await initDb();
    const { id } = await params;

    const rows = await sql`
      SELECT q1_answer, q2_answer
      FROM responses
      WHERE session_id = ${parseInt(id, 10)}
      ORDER BY created_at ASC
    `;

    const analysis = analyzeCorrelation(rows);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Correlation analysis error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
