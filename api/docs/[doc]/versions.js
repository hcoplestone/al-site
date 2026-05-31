import { sql, DOCS, ensureSchema } from '../../../lib/db.js';
import { api, readJson } from '../../../lib/http.js';

// GET  /api/docs/:doc/versions  -> [{ id, name, author, createdAt }]  (metadata only)
// POST /api/docs/:doc/versions  -> create a named snapshot from { name, author?, state }
export default api(async (req, res) => {
  const { doc } = req.query;
  if (!DOCS.has(doc)) return res.status(400).json({ error: 'unknown document' });
  await ensureSchema();

  if (req.method === 'GET') {
    const rows = await sql`
      select id, name, author, created_at
      from versions where doc = ${doc}
      order by created_at desc, id desc`;
    return res.status(200).json(rows.map(toMeta));
  }

  if (req.method === 'POST') {
    const body = readJson(req);
    if (!body || typeof body.state === 'undefined') {
      return res.status(400).json({ error: 'missing state' });
    }
    const name = ((body.name ?? '').toString().trim() || 'Untitled version').slice(0, 200);
    const author = body.author ? body.author.toString().trim().slice(0, 120) || null : null;
    const rows = await sql`
      insert into versions (doc, name, author, state)
      values (${doc}, ${name}, ${author}, ${JSON.stringify(body.state)}::jsonb)
      returning id, name, author, created_at`;
    return res.status(201).json(toMeta(rows[0]));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
});

function toMeta(r) {
  return { id: String(r.id), name: r.name, author: r.author, createdAt: r.created_at };
}
