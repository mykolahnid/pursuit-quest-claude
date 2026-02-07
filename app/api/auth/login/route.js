import { NextResponse } from 'next/server';
import { checkPassword, setAdminCookie } from '@/lib/auth';

export async function POST(request) {
  try {
    const { password } = await request.json();

    if (!checkPassword(password)) {
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    await setAdminCookie();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
