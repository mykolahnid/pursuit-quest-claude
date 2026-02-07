import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { generateTestData } from '@/lib/testdata';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request, { params }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await initDb();
    const { id } = await params;
    const sessionId = parseInt(id, 10);

    const body = await request.json();
    const count = Math.min(Math.max(parseInt(body.count, 10) || 30, 1), 500);

    // Verify session exists
    const sessionRows = await sql`
      SELECT id FROM sessions WHERE id = ${sessionId}
    `;
    if (sessionRows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const testData = generateTestData(count);

    // Insert test data
    for (const data of testData) {
      const browserId = `test-${uuidv4()}`;
      await sql`
        INSERT INTO responses (session_id, q1_answer, q2_answer, browser_id)
        VALUES (${sessionId}, ${data.q1}, ${data.q2}, ${browserId})
      `;
    }

    return NextResponse.json({ generated: testData.length });
  } catch (error) {
    console.error('Generate test data error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
