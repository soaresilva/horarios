import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Force the Postgres session timezone to UTC on every connection, regardless
// of the target server's own default. Without this, timestamptz parameters
// sent by @prisma/adapter-pg get interpreted using the server's session
// timezone when no explicit offset is present, so the same code could store
// a different absolute instant depending on which Postgres instance (local
// Homebrew default, Neon, etc.) it talks to. Verified empirically: a DB
// defaulted to Europe/Amsterdam silently stored times 2 hours off until this
// was added. Do not remove.
function withUtcSession(connectionString: string | undefined) {
  if (!connectionString) return connectionString;
  const url = new URL(connectionString);
  url.searchParams.set("options", "-c TimeZone=UTC");
  return url.toString();
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: withUtcSession(process.env.DATABASE_URL) });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
