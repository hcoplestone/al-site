// Small shared helpers for the JSON API functions.

// Read a JSON request body whether the runtime delivered it pre-parsed (Vercel
// Node functions do this for application/json) or as a raw string/Buffer.
export function readJson(req) {
  if (req.body == null) return null;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  if (Buffer.isBuffer(req.body)) {
    try { return JSON.parse(req.body.toString('utf8')); } catch { return null; }
  }
  return req.body;
}

// Wrap a handler so every response is uncached and any thrown error becomes a
// clean JSON 500 (logged server-side) instead of an opaque crash.
export function api(handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[api error]', err);
      if (!res.headersSent) res.status(500).json({ error: 'internal error' });
    }
  };
}
