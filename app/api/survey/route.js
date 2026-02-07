import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';

export async function POST(request) {
  try {
    await initDb();

    const { q1, q2, browserId } = await request.json();

    // Validate inputs
    const q1Num = parseInt(q1, 10);
    const q2Num = parseInt(q2, 10);

    if (!Number.isInteger(q1Num) || q1Num < 1 || q1Num > 100) {
      return NextResponse.json(
        { error: 'Answer 1 must be an integer between 1 and 100' },
        { status: 400 }
      );
    }
    if (!Number.isInteger(q2Num) || q2Num < 0 || q2Num > 1000) {
      return NextResponse.json(
        { error: 'Answer 2 must be an integer between 0 and 1000' },
        { status: 400 }
      );
    }
    if (!browserId || typeof browserId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid browser ID' },
        { status: 400 }
      );
    }

    // Check for open session
    const sessionRows = await sql`
      SELECT id FROM sessions
      WHERE status = 'open'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const session = sessionRows[0];
    if (!session) {
      return NextResponse.json(
        { error: 'No survey session is currently open' },
        { status: 403 }
      );
    }

    // Check for duplicate submission
    const existingRows = await sql`
      SELECT id FROM responses
      WHERE session_id = ${session.id} AND browser_id = ${browserId}
    `;

    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: 'You have already submitted a response for this session' },
        { status: 409 }
      );
    }

    // Insert response
    await sql`
      INSERT INTO responses (session_id, q1_answer, q2_answer, browser_id)
      VALUES (${session.id}, ${q1Num}, ${q2Num}, ${browserId})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Survey submission error:', error);
    if (error.message?.includes('unique') || error.message?.includes('UNIQUE')) {
      return NextResponse.json(
        { error: 'You have already submitted a response for this session' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
