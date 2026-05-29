# ITG Strategy 2026–2029

Internal, confidential strategy site (static, deployed on Vercel).

- `index.html` — landing page linking to the two strategy views (self-contained: fonts + logos embedded).
- `ITG Strategy - May 2026.html` — the interactive strategy document.
- `ITG Strategy House 2026.html` — the one-page strategy "house".

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
