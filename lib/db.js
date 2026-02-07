import { neon } from '@neondatabase/serverless';

let _sql = null;
let initialized = false;

// Lazy wrapper - avoids calling neon() at module load time (which fails during build)
function sql(strings, ...values) {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql(strings, ...values);
}

export async function initDb() {
  if (initialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS responses (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      q1_answer INTEGER NOT NULL CHECK(q1_answer BETWEEN 1 AND 100),
      q2_answer INTEGER NOT NULL CHECK(q2_answer BETWEEN 0 AND 1000),
      browser_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_submission
    ON responses(session_id, browser_id)
  `;

  initialized = true;
}

export { sql };
