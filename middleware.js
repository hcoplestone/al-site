import { next } from '@vercel/edge';

// Password-gate every route (HTTP Basic Auth), running at Vercel's edge
// before any file is served. The password lives in the SITE_PASSWORD
// environment variable — never in the repo.
//
// Set it in Vercel:  Project → Settings → Environment Variables
//   SITE_PASSWORD = <your password>   (Production, Preview, Development)
// then redeploy. Any username is accepted; only the password is checked.
//
// Note: env-var changes only take effect on a new deployment, so any commit
// (like this one) triggers a fresh Vercel build that reads the latest value.

export const config = {
  // Gate everything except the favicon (avoids a second auth prompt for it).
  matcher: ['/((?!favicon.ico).*)'],
};

export default function middleware(request) {
  const expected = process.env.SITE_PASSWORD;

  // Fail closed: if no password is configured, deny rather than expose content.
  if (!expected) {
    return new Response('Site password is not configured.', { status: 503 });
  }

  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch {
      decoded = '';
    }
    const separator = decoded.indexOf(':');
    const password = separator === -1 ? decoded : decoded.slice(separator + 1);
    if (password === expected) {
      return next(); // authorised → serve the requested file
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ITG Strategy 2026-2029", charset="UTF-8"',
    },
  });
}
