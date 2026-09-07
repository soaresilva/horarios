import { describe, expect, it } from "vitest";
import { migrationDatabaseUrl } from "./database-url";

const POOLED = "postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb";
const DIRECT = "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb";

describe("migrationDatabaseUrl", () => {
  // The regression this exists for: migrations run through Neon's pooled
  // endpoint fail intermittently with P1002 (a transaction-mode pooler can't
  // hold pg_advisory_lock), which broke roughly half of production deploys.
  it("prefers the unpooled endpoint when Neon provides one", () => {
    expect(migrationDatabaseUrl({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT })).toBe(DIRECT);
  });

  it("falls back to DATABASE_URL when there is no unpooled variant (local dev)", () => {
    const local = "postgresql://diogosilva@localhost:5432/horarios_dev?schema=public";
    expect(migrationDatabaseUrl({ DATABASE_URL: local })).toBe(local);
  });

  it("treats an empty or whitespace-only unpooled value as absent", () => {
    // Vercel/Neon can hand back a defined-but-empty var; falling through to
    // the pooled URL is far better than handing Prisma an empty string.
    expect(migrationDatabaseUrl({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: "" })).toBe(POOLED);
    expect(migrationDatabaseUrl({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: "   " })).toBe(POOLED);
  });

  it("returns undefined when neither is set, rather than inventing a value", () => {
    expect(migrationDatabaseUrl({})).toBeUndefined();
  });
});
