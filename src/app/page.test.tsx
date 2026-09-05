import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";
import { prisma } from "@/lib/prisma";

// Home is an async Server Component that queries Postgres directly, so the
// DB access is stubbed rather than hit for real (same reasoning as not
// unit-testing src/app/admin/page.tsx) — only the query result -> markup
// mapping is under test here.
vi.mock("@/lib/prisma", () => ({
  prisma: { festival: { findMany: vi.fn() } },
}));

const mockFindMany = vi.mocked(prisma.festival.findMany);

describe("Home (archive index)", () => {
  it("lists a past festival as archived, linking to /<slug>", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "f1",
        slug: "pdc26",
        name: "Paredes de Coura 2026",
        location: "Paredes de Coura, Portugal",
        startDate: new Date("2026-08-09T00:00:00Z"),
        endDate: new Date("2026-08-16T00:00:00Z"),
        timezone: "Europe/Lisbon",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    render(await Home());

    const link = screen.getByRole("link", { name: /Paredes de Coura 2026/ });
    expect(link).toHaveAttribute("href", "/pdc26");
    expect(screen.getByText("9–16 Aug 2026")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("doesn't mark a festival whose end date hasn't passed yet as archived", async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockFindMany.mockResolvedValue([
      {
        id: "f2",
        slug: "left-of-the-dial",
        name: "Left of the Dial",
        location: "Rotterdam, Netherlands",
        startDate: future,
        endDate: future,
        timezone: "Europe/Amsterdam",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    render(await Home());

    expect(screen.getByRole("link", { name: /Left of the Dial/ })).toHaveAttribute(
      "href",
      "/left-of-the-dial",
    );
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("shows a fallback message when there are no festivals yet", async () => {
    mockFindMany.mockResolvedValue([]);
    render(await Home());
    expect(screen.getByText("No festivals yet.")).toBeInTheDocument();
  });

  it("keeps the Horários Bolachas brand link pointed at bolachas.org, not an archive route", async () => {
    mockFindMany.mockResolvedValue([]);
    render(await Home());
    expect(screen.getByRole("link", { name: "Horários Bolachas" })).toHaveAttribute(
      "href",
      "https://bolachas.org",
    );
  });
});
