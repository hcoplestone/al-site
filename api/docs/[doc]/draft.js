import { sql, DOCS, ensureSchema } from '../../../lib/db.js';
import { api, readJson } from '../../../lib/http.js';

// GET  /api/docs/:doc/draft  -> { state, updatedAt }  (204 if no draft yet)
// PUT  /api/docs/:doc/draft  -> upsert the live working draft (autosave target)
export default api(async (req, res) => {
  const { doc } = req.query;
  if (!DOCS.has(doc)) return res.status(400).json({ error: 'unknown document' });
  await ensureSchema();

  if (req.method === 'GET') {
    const rows = await sql`select state, updated_at from drafts where doc = ${doc}`;
    if (!rows.length) return res.status(204).end();
    return res.status(200).json({ state: rows[0].state, updatedAt: rows[0].updated_at });
  }

  if (req.method === 'PUT') {
    const body = readJson(req);
    if (!body || typeof body.state === 'undefined') {
      return res.status(400).json({ error: 'missing state' });
    }
    const rows = await sql`
      insert into drafts (doc, state)
      values (${doc}, ${JSON.stringify(body.state)}::jsonb)
      on conflict (doc) do update set state = excluded.state, updated_at = now()
      returning updated_at`;
    return res.status(200).json({ ok: true, updatedAt: rows[0].updated_at });
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ error: 'method not allowed' });
});
