import { sql, DOCS, ensureSchema } from '../../../../lib/db.js';
import { api } from '../../../../lib/http.js';

// GET    /api/docs/:doc/versions/:id  -> { id, name, author, createdAt, state }
// DELETE /api/docs/:doc/versions/:id  -> 204
export default api(async (req, res) => {
  const { doc, id } = req.query;
  if (!DOCS.has(doc)) return res.status(400).json({ error: 'unknown document' });
  if (!/^\d+$/.test(String(id))) return res.status(400).json({ error: 'invalid id' });
  await ensureSchema();

  if (req.method === 'GET') {
    const rows = await sql`
      select id, name, author, state, created_at
      from versions where doc = ${doc} and id = ${id}::bigint`;
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    const r = rows[0];
    return res.status(200).json({
      id: String(r.id), name: r.name, author: r.author,
      createdAt: r.created_at, state: r.state,
    });
  }

  if (req.method === 'DELETE') {
    const rows = await sql`delete from versions where doc = ${doc} and id = ${id}::bigint returning id`;
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
});
