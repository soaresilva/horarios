import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stageMapsUrls } from "../../src/lib/venues";
import { TOUO_VENUE_TO_STAGE_SLUG } from "../touo/venues";
import { buildStructureSql, SQL_BEGIN, SQL_END, walkIdPart } from "./migration-sql";
import { ROOMS, TICKET_DESK, ZONES } from "./rooms";
import { VENUE_TO_STAGE_SLUG } from "./venues";
import { lotdWalkMinutes, walkFromTicketDesk, zoneWalkRows } from "./zones";

const root = path.join(__dirname, "..", "..");
const room = (slug: string) => ROOMS.find((r) => r.slug === slug)!;

describe("ROOMS", () => {
  it("has unique slugs and only known zones", () => {
    expect(new Set(ROOMS.map((r) => r.slug)).size).toBe(ROOMS.length);
    const zones = new Set(ZONES.map((z) => z.slug));
    for (const r of ROOMS) expect(zones.has(r.zone), r.slug).toBe(true);
  });

  it("lists rooms zone by zone, so `order` reads as a walk across the city", () => {
    const zoneIndex = ROOMS.map((r) => ZONES.findIndex((z) => z.slug === r.zone));
    expect(zoneIndex).toEqual([...zoneIndex].sort((a, b) => a - b));
  });

  it("covers every room both importers map a venue string to", () => {
    const slugs = new Set(ROOMS.map((r) => r.slug));
    for (const slug of [...Object.values(VENUE_TO_STAGE_SLUG), ...Object.values(TOUO_VENUE_TO_STAGE_SLUG)]) {
      expect(slugs.has(slug), slug).toBe(true);
    }
  });

  it("puts every point in central Rotterdam", () => {
    for (const r of ROOMS) {
      expect(r.point.lat, r.slug).toBeGreaterThan(51.9);
      expect(r.point.lat, r.slug).toBeLessThan(51.94);
      expect(r.point.lng, r.slug).toBeGreaterThan(4.46);
      expect(r.point.lng, r.slug).toBeLessThan(4.5);
    }
  });
});

describe("Theater Rotterdam", () => {
  // Regression: the three halls were filed under TR8 (William Boothlaan 8)
  // in the Witte de With zone. The festival plays the main building.
  it("puts all three halls at Schouwburgplein 25, in the Schouwburgplein zone", () => {
    for (const slug of ["tr-up", "tr-down", "tr-foyer"]) {
      expect(room(slug).address, slug).toBe("Schouwburgplein 25, 3012 CL Rotterdam");
      expect(room(slug).zone, slug).toBe("schouwburgplein");
    }
    expect(ROOMS.some((r) => r.address.includes("William Boothlaan"))).toBe(false);
  });

  it("sends all three halls to one address-only maps search", () => {
    const urls = stageMapsUrls(ROOMS.map((r) => ({ id: r.slug, name: r.name, address: r.address })));
    expect(new Set(["tr-up", "tr-down", "tr-foyer"].map((s) => urls.get(s)))).toEqual(
      new Set(["https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Schouwburgplein 25, 3012 CL Rotterdam")]),
    );
  });
});

describe("addresses from the festival's venue chart", () => {
  it("matches the chart where the chart is right", () => {
    expect(room("stalles").address).toMatch(/^Westersingel 50A,/);
    expect(room("arminius-down").address).toMatch(/^Westersingel 76,/);
    expect(room("arminius-up").address).toMatch(/^Museumpark 3,/);
    expect(room("barrio").address).toMatch(/^Schiestraat 18,/);
    expect(room("bird").address).toMatch(/^Raampoortstraat 24,/);
    expect(room("waalse-kerk").address).toMatch(/^Pierre Baylestraat 1,/);
  });

  it("keeps the register's address where the chart has a typo", () => {
    // Chart: "Karel Doormanstraat 23" (another building) and "Schiestraat 22" (not in BAG).
    expect(room("de-doelen-up").address).toMatch(/^Karel Doormanstraat 223,/);
    expect(room("salsability").address).toMatch(/^Delftseplein 36,/);
  });
});

describe("walking model", () => {
  it("agrees with the festival's chart of minutes from the ticket desk", () => {
    const charted = ROOMS.filter((r) => r.chartMinutes !== undefined);
    expect(charted.length).toBeGreaterThanOrEqual(25);
    const errors = charted.map((r) => lotdWalkMinutes(TICKET_DESK, r.point) - r.chartMinutes!);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // No lean either way, under a minute off on average, and no room more
    // than 3 off (Reijngoud: the chart has it a minute past Mono, 30 m away).
    expect(Math.abs(mean(errors))).toBeLessThanOrEqual(0.5);
    expect(mean(errors.map(Math.abs))).toBeLessThanOrEqual(1);
    for (const [i, e] of errors.entries()) expect(Math.abs(e), charted[i].slug).toBeLessThanOrEqual(3);
  });

  it("has one walk row per unordered zone pair, each a positive number of minutes", () => {
    const rows = zoneWalkRows();
    expect(rows).toHaveLength((ZONES.length * (ZONES.length - 1)) / 2);
    for (const r of rows) expect(r.minutes, `${r.from}-${r.to}`).toBeGreaterThan(0);
  });

  it("never shortcuts the triangle by more than rounding", () => {
    const rows = zoneWalkRows();
    const between = (a: string, b: string) =>
      rows.find((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a))!.minutes;
    for (const a of ZONES) for (const b of ZONES) for (const c of ZONES) {
      if (new Set([a.slug, b.slug, c.slug]).size < 3) continue;
      expect(between(a.slug, c.slug), `${a.slug}-${c.slug} via ${b.slug}`).toBeLessThanOrEqual(
        between(a.slug, b.slug) + between(b.slug, c.slug) + 1,
      );
    }
  });

  it("gives Schouwburgplein to Witte de With a real walk, not the old 6 minutes", () => {
    const row = zoneWalkRows().find((r) => r.from === "schouwburgplein" && r.to === "witte-de-with")!;
    expect(row.minutes).toBeGreaterThanOrEqual(10);
  });

  it("measures every zone from the ticket desk, the Eendrachtsplein one included", () => {
    const fromDesk = walkFromTicketDesk();
    for (const z of ZONES) expect(fromDesk.get(z.slug), z.slug).toBeGreaterThan(0);
    expect(fromDesk.get("eendrachtsplein")).toBeLessThanOrEqual(2);
  });
});

describe("migration SQL", () => {
  it("keeps the ZoneWalk ids the first lotd26 migration created", () => {
    expect(ZONES.map((z) => walkIdPart(z.slug))).toEqual(["eend", "muse", "scho", "witt", "schi", "will", "wijn", "zoho"]);
  });

  it("the latest lotd26 structure migration carries exactly the SQL --sql generates now", () => {
    const migrationsDir = path.join(root, "prisma", "migrations");
    const latest = readdirSync(migrationsDir)
      .filter((d) => !d.endsWith(".toml"))
      .sort()
      .map((d) => readFileSync(path.join(migrationsDir, d, "migration.sql"), "utf8"))
      .filter((sql) => sql.includes(SQL_BEGIN))
      .at(-1)!;
    const begin = latest.indexOf(SQL_BEGIN);
    const end = latest.indexOf(SQL_END) + SQL_END.length;
    expect(latest.slice(begin, end)).toBe(buildStructureSql());
  });
});
