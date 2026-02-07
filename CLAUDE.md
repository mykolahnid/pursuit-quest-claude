# Priming/Anchoring Effect Survey

A web application to test the psychological anchoring effect. Participants answer two questions:
1. "Enter a number between 1 and 100" (the anchor)
2. "How many African countries are members of the United Nations?" (the estimate)

**Hypothesis**: Q1 anchors Q2 — higher Q1 values correlate with higher Q2 estimates. Actual answer: 54.

## Tech Stack

- **Framework**: Next.js 15 (App Router, JavaScript)
- **Database**: Neon Postgres via `@neondatabase/serverless`
- **Charts**: Chart.js + react-chartjs-2
- **Auth**: Simple admin password with httpOnly cookie
- **Hosting**: Vercel (free tier) + Neon Postgres integration

## Project Structure

```
lib/
  db.js              # Lazy Neon connection + auto table creation (CREATE IF NOT EXISTS)
  auth.js            # Admin cookie auth (makeToken, isAdmin, requireAdmin)
  correlation.js     # Pearson r, p-value via t-test, linear regression
  testdata.js        # Generates fake anchoring-effect data (Box-Muller + anchor weight)

app/
  page.js            # Survey page (client component, 2-step form)
  login/page.js      # Admin login page
  admin/page.js      # Admin dashboard (sessions, charts, correlation stats)
  globals.css        # All styles
  layout.js          # Root layout

  api/
    session/status/   # GET - check if survey is open (public)
    survey/           # POST - submit answers (public)
    auth/login/       # POST - admin login
    auth/logout/      # POST - admin logout
    auth/status/      # GET - check admin status
    admin/sessions/   # GET list, POST create
    admin/sessions/[id]/          # DELETE session
    admin/sessions/[id]/close/    # PUT close session
    admin/sessions/[id]/open/     # PUT reopen session
    admin/sessions/[id]/responses/    # GET responses, DELETE clear
    admin/sessions/[id]/correlation/  # GET correlation analysis
    admin/sessions/[id]/testdata/     # POST generate test data
```

## Key Patterns

### Database (Neon)
- `@neondatabase/serverless` returns rows as a plain array (NOT `{ rows: [...] }`)
- Connection is lazy-initialized to avoid build-time errors when `DATABASE_URL` is empty
- Pattern in `lib/db.js`: `function sql(strings, ...values) { if (!_sql) _sql = neon(process.env.DATABASE_URL); return _sql(strings, ...values); }`
- All routes call `await initDb()` before any queries (creates tables if they don't exist)

### Auth
- Single admin password stored in `ADMIN_PASSWORD` env var
- Login sets an httpOnly cookie with an HMAC token
- `requireAdmin()` returns a 401 Response or null — check with `const err = await requireAdmin(); if (err) return err;`

### Survey Duplicate Prevention
- Client generates UUID stored in `sessionStorage` as `browserId`
- `UNIQUE(session_id, browser_id)` constraint in DB
- Client also stores `submitted_{sessionId}` flag in `sessionStorage`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon Postgres connection string (auto-injected by Vercel) |
| `ADMIN_PASSWORD` | Yes | Admin password for the dashboard |

## Commands

- `npm run dev` — Start dev server (requires DATABASE_URL)
- `npm run build` — Production build
- `npm start` — Start production server

## Deployment

1. Push to GitHub
2. Import in Vercel → Add Neon Postgres integration
3. Set `ADMIN_PASSWORD` in Vercel env vars
4. Tables auto-create on first request
