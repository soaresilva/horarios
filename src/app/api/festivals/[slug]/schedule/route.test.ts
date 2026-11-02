import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { hasAdminSession } from "@/lib/session";

vi.mock("@/lib/session", () => ({ hasAdminSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    festival: { findUnique: vi.fn() },
    stage: { findMany: vi.fn().mockResolvedValue([]) },
    performance: { findMany: vi.fn().mockResolvedValue([]) },
    zone: { findMany: vi.fn().mockResolvedValue([]) },
    artist: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const request = (slug: string) => GET(new Request(`http://x/api/festivals/${slug}/schedule`), { params: Promise.resolve({ slug }) });
const hidden = { id: "ps27", slug: "ps27", published: false };

describe("GET /api/festivals/[slug]/schedule", () => {
  beforeEach(() => {
    vi.mocked(hasAdminSession).mockResolvedValue(false);
  });

  it("answers an unpublished festival exactly like a missing one", async () => {
    vi.mocked(prisma.festival.findUnique).mockResolvedValue(null);
    const missing = await request("nope");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.festival.findUnique).mockResolvedValue(hidden as any);
    const unpublished = await request("ps27");

    expect(unpublished.status).toBe(404);
    expect(await unpublished.json()).toEqual(await missing.json());
    expect(prisma.performance.findMany).not.toHaveBeenCalled();
  });

  it("serves an unpublished festival to an admin", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.festival.findUnique).mockResolvedValue(hidden as any);
    vi.mocked(hasAdminSession).mockResolvedValue(true);
    expect((await request("ps27")).status).toBe(200);
  });

  it("serves a published festival to anyone", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.festival.findUnique).mockResolvedValue({ ...hidden, published: true } as any);
    expect((await request("ps27")).status).toBe(200);
  });
});
