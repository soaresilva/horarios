import { beforeEach, describe, expect, it, vi } from "vitest";
import { setFeaturedFestivalAction, setFestivalPublishedAction } from "./actions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireSession: vi.fn(), createSession: vi.fn(), deleteSession: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const festival = { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
  return {
    prisma: {
      festival,
      $transaction: (run: (tx: { festival: typeof festival }) => Promise<unknown>) => run({ festival }),
    },
  };
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("festival publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(undefined);
  });

  it("refuses to feature an unpublished festival, leaving the current pick alone", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.festival.findUnique).mockResolvedValue({ published: false } as any);
    await expect(setFeaturedFestivalAction(form({ slug: "ps27" }))).rejects.toThrow(/unpublished/);
    expect(prisma.festival.updateMany).not.toHaveBeenCalled();
  });

  it("features a published festival", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.festival.findUnique).mockResolvedValue({ published: true } as any);
    await setFeaturedFestivalAction(form({ slug: "lgw26" }));
    expect(prisma.festival.update).toHaveBeenCalledWith({ where: { slug: "lgw26" }, data: { featured: true } });
  });

  it("still clears the pick with an empty slug", async () => {
    await setFeaturedFestivalAction(form({ slug: "" }));
    expect(prisma.festival.findUnique).not.toHaveBeenCalled();
    expect(prisma.festival.updateMany).toHaveBeenCalled();
  });

  it("publishes", async () => {
    await setFestivalPublishedAction(form({ slug: "ps27", published: "true" }));
    expect(prisma.festival.update).toHaveBeenCalledWith({ where: { slug: "ps27" }, data: { published: true } });
  });

  it("unpublishing also clears featured, so / can't redirect into a 404", async () => {
    await setFestivalPublishedAction(form({ slug: "lgw26", published: "false" }));
    expect(prisma.festival.update).toHaveBeenCalledWith({
      where: { slug: "lgw26" },
      data: { published: false, featured: false },
    });
  });

  it("is admin-only", async () => {
    vi.mocked(requireSession).mockRejectedValue(new Error("Unauthorized"));
    await expect(setFestivalPublishedAction(form({ slug: "ps27", published: "true" }))).rejects.toThrow("Unauthorized");
    expect(prisma.festival.update).not.toHaveBeenCalled();
  });
});
