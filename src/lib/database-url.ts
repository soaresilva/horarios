// Which connection string Prisma's CLI work (migrate deploy/dev, studio)
// should use — deliberately NOT the same choice the runtime makes.
//
// The runtime (src/lib/prisma.ts) connects through DATABASE_URL, which on
// Neon points at the *pooled* endpoint (`...-pooler...`). That is the right
// choice there: serverless functions open many short-lived connections and
// the pooler is what keeps that from exhausting Postgres.
//
// Migrations are the opposite case. `prisma migrate` takes a session-level
// advisory lock (SELECT pg_advisory_lock(...)) to stop two deploys migrating
// at once, and a transaction-mode pooler cannot hold a session-level lock —
// the underlying backend connection gets swapped out from under it. The
// result is an intermittent, ~50%-of-builds `P1002 ... Timed out trying to
// acquire a postgres advisory lock`, which is exactly what was failing
// Vercel production deploys on 2026-09-07.
//
// Neon exposes the direct (non-pooled) endpoint as DATABASE_URL_UNPOOLED, so
// prefer it whenever it exists. Local dev has no such variable — plain
// localhost Postgres has no pooler in front of it — so fall back to
// DATABASE_URL there.
// Structural rather than NodeJS.ProcessEnv: this only needs two variables,
// and ProcessEnv is augmented here to require NODE_ENV, which would force
// every caller (and test) to supply an irrelevant field.
interface DatabaseUrlEnv {
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
}

export function migrationDatabaseUrl(env: DatabaseUrlEnv = process.env as DatabaseUrlEnv): string | undefined {
  const unpooled = env.DATABASE_URL_UNPOOLED?.trim();
  return unpooled ? unpooled : env.DATABASE_URL;
}
