import { NextResponse } from 'next/server';
import { sql, initDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function DELETE(request, { params }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    await initDb();
    const { id } = await params;

    await sql`DELETE FROM sessions WHERE id = ${parseInt(id, 10)}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
