import { neon } from '@neondatabase/serverless';

// Single SQL client for the serverless functions. Neon's HTTP driver is ideal
// for serverless (no connection pool to manage or tear down). The connection
// string comes from the NEON_CONNECTION_STRING env var — set in Vercel and in a
// gitignored local .env — and is never hard-coded.
export const sql = neon(process.env.NEON_CONNECTION_STRING);

// Documents allowed to be stored. Rejecting anything else keeps the tables from
// filling with arbitrary keys from probing requests.
export const DOCS = new Set(['may2026', 'house']);

// Create the schema on first use. Idempotent (IF NOT EXISTS) and cached per warm
// instance, so it is a no-op after the first request. Acts as a safety net
// alongside the one-time psql setup, so a fresh database self-heals. On failure
// the cache is cleared so a later request can retry rather than staying wedged.
let ready;
export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      await sql`create table if not exists drafts (
        doc        text primary key,
        state      jsonb       not null,
        updated_at timestamptz not null default now()
      )`;
      await sql`create table if not exists versions (
        id         bigint generated always as identity primary key,
        doc        text        not null,
        name       text        not null,
        author     text,
        state      jsonb       not null,
        created_at timestamptz not null default now()
      )`;
      await sql`create index if not exists versions_doc_created_idx on versions (doc, created_at desc)`;
    })().catch((e) => { ready = undefined; throw e; });
  }
  return ready;
}
