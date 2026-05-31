# ITG Strategy 2026–2029

Internal, confidential strategy site (static, deployed on Vercel).

- `index.html` — landing page linking to the two strategy views (self-contained: fonts + logos embedded).
- `ITG Strategy - May 2026.html` — the interactive strategy document.
- `ITG Strategy House 2026.html` — the one-page strategy "house".
- `store.js` — shared browser client: server autosave + the Versions UI (loaded by both docs).
- `api/` + `lib/` — Vercel serverless functions and the Neon (Postgres) helper behind saving/versioning.

## Saving & versions

Editable content is stored in a Postgres database (Neon), so edits are shared
across people and devices — not just one browser.

- **Autosave** — every edit saves to the server automatically (a debounced
  "live draft" per document). `localStorage` is kept as an instant-load cache
  and an offline fallback, so editing still works if the network drops and
  syncs on the next successful save.
- **Versions** — the **Versions** button (top-right of each doc) saves a named,
  timestamped snapshot (optionally tagged with your name), lists all snapshots,
  and lets you **Load** any one back into the live draft or **Delete** it.
  Snapshots are immutable; restoring copies a snapshot into the working draft.

Editing is shared (single site password, no per-user accounts) and
last-write-wins: if two people edit at once, the most recent save wins.

## Database (Neon Postgres)

The API reads its connection string from the **`NEON_CONNECTION_STRING`**
environment variable.

1. Provision a Neon Postgres database (or use Vercel → Storage → Neon).
2. Vercel → Project → **Settings → Environment Variables** → add
   `NEON_CONNECTION_STRING` = your Neon connection string (Production, Preview,
   Development), then **redeploy**.
3. For local development, put `NEON_CONNECTION_STRING` (and a local
   `SITE_PASSWORD`) in a `.env` file — it is `.gitignore`d and must never be
   committed — then run `vercel dev`.

The `drafts` and `versions` tables are created automatically on first use, so
there is no manual migration step. The API lives on the same domain as the
site, so the existing `SITE_PASSWORD` gate (below) protects it too — there is no
separate API auth.

## Password protection

The whole site is gated with HTTP Basic Auth via `middleware.js`, which runs at
Vercel's edge before any file is served. The password is **not** in the repo —
it lives in an environment variable.

**Setup (required — the site returns `503` until this is done):**

1. Vercel → Project → **Settings → Environment Variables**
2. Add `SITE_PASSWORD` = your chosen password (tick Production, Preview, Development)
3. **Redeploy** (Deployments → ⋯ → Redeploy)

Any username is accepted at the login prompt; only the password is checked.
To change the password later, update the env var and redeploy.
