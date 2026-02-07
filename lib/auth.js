import { cookies } from 'next/headers';
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SECRET = process.env.DATABASE_URL || 'dev-secret-key';

function makeToken() {
  return crypto
    .createHmac('sha256', SECRET)
    .update(ADMIN_PASSWORD)
    .digest('hex');
}

export async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin-token')?.value;
  return token === makeToken();
}

export async function setAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.set('admin-token', makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('admin-token');
}

export function checkPassword(password) {
  return password === ADMIN_PASSWORD;
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    return new Response(JSON.stringify({ error: 'Admin authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}
