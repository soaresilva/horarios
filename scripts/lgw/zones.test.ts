import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stageMapsUrls } from "../../src/lib/venues";
import { buildStructureSql, SQL_BEGIN, SQL_END, stageAddress } from "./migration-sql";
import type { LgwSnapshot } from "./snapshot";
import { parseVenuePage } from "./venue-page";
import { HUB_ZONE, ROOMS, ZONES, roomFor } from "./venues";
import { haversineMetres, walkFromHub, walkMinutes, zoneWalkRows } from "./zones";

const root = path.join(__dirname, "..", "..");
const committed = JSON.parse(readFileSync(path.join(root, "scripts", "data", "lgw26.json"), "utf8")) as LgwSnapshot;

describe("walking model", () => {
  it("measures a known distance: TivoliVredenburg to De Helling is about 2km as the crow flies", () => {
    const tivoli = { lat: 52.09259518484675, lng: 5.11307810638248 };
    const helling = { lat: 52.0768317, lng: 5.1217475 };
    expect(haversineMetres(tivoli, helling)).toBeGreaterThan(1800);
    expect(haversineMetres(tivoli, helling)).toBeLessThan(1900);
    // x1.3 detour at 80 m/min, rounded up.
    expect(walkMinutes(tivoli, helling)).toBe(Math.ceil((haversineMetres(tivoli, helling) * 1.3) / 80));
  });

  it("is symmetric and zero for the same point", () => {
    const a = { lat: 52.1, lng: 5.08 };
    const b = { lat: 52.09, lng: 5.12 };
    expect(walkMinutes(a, b)).toBe(walkMinutes(b, a));
    expect(walkMinutes(a, a)).toBe(0);
  });
});

describe("zones from the committed snapshot", () => {
  it("has one walk row per unordered zone pair", () => {
    expect(zoneWalkRows(committed.venues)).toHaveLength((ZONES.length * (ZONES.length - 1)) / 2);
  });

  it("orders zones by walking time from TivoliVredenburg", () => {
    const fromHub = walkFromHub(committed.venues);
    expect(fromHub.get(HUB_ZONE)).toBeNull();
    const minutes = ZONES.slice(1).map((z) => fromHub.get(z.slug)!);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
  });

  it("keeps the city-centre zones within a short walk of each other", () => {
    const rows = zoneWalkRows(committed.venues);
    const between = (a: string, b: string) => rows.find((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a))!.minutes;
    expect(between("neude", "domplein")).toBeLessThanOrEqual(10);
    expect(between("nijverheidskade", "werkspoorkwartier")).toBeLessThanOrEqual(10);
    expect(between("tivolivredenburg", "werkspoorkwartier")).toBeGreaterThan(30);
  });

  it("has facts for every venue a room uses", () => {
    for (const r of ROOMS) expect(committed.venues[r.venue], r.venue).toBeTruthy();
  });
});

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

  it("looks up a room by venue and room, and refuses an unknown one", () => {
    expect(roomFor("TivoliVredenburg", "Ronda").slug).toBe("ronda");
    expect(roomFor("ACU", null).slug).toBe("acu");
    expect(() => roomFor("TivoliVredenburg", "Kelder")).toThrow(/Unknown room/);
  });
});

describe("maps links from the committed snapshot", () => {
  const stages = ROOMS.map((r) => ({ id: r.slug, name: r.name, address: stageAddress(committed.venues[r.venue]!), venue: r.venue }));
  const urls = stageMapsUrls(stages);

  it("sends all six TivoliVredenburg rooms to the same address", () => {
    const tivoli = stages.filter((s) => s.venue === "TivoliVredenburg");
    expect(tivoli).toHaveLength(6);
    expect(new Set(tivoli.map((s) => urls.get(s.id)))).toEqual(
      new Set(["https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Vredenburgkade 11, 3511 WC Utrecht")]),
    );
  });

  it("gives every room of one venue one link", () => {
    for (const venue of new Set(stages.map((s) => s.venue))) {
      const links = new Set(stages.filter((s) => s.venue === venue).map((s) => urls.get(s.id)));
      expect(links.size, venue).toBe(1);
    }
  });
});

describe("migration drift", () => {
  it("the latest lgw26 structure migration carries exactly the SQL --sql generates now", () => {
    const migrationsDir = path.join(root, "prisma", "migrations");
    const latest = readdirSync(migrationsDir)
      .filter((d) => !d.endsWith(".toml"))
      .sort()
      .map((d) => readFileSync(path.join(migrationsDir, d, "migration.sql"), "utf8"))
      .filter((sql) => sql.includes(SQL_BEGIN))
      .at(-1)!;
    const begin = latest.indexOf(SQL_BEGIN);
    const end = latest.indexOf(SQL_END) + SQL_END.length;
    expect(latest.slice(begin, end)).toBe(buildStructureSql(committed.venues));
  });
});

describe("parseVenuePage", () => {
  const html = readFileSync(path.join(__dirname, "__fixtures__", "venue-hof-van-cartesius.html"), "utf8");

  it("reads the address and the marker pin, skipping the map's world-bounds LatLngs", () => {
    expect(parseVenuePage("hof-van-cartesius", html)).toEqual({
      slug: "hof-van-cartesius",
      address: "Vlampijpstraat 94, 3534 AR",
      lat: 52.10397177949616,
      lng: 5.087463215581846,
    });
  });

  it("throws on a page with no pin or no address", () => {
    expect(() => parseVenuePage("x", "<p>Address</p><p>Somewhere 1</p>")).toThrow(/no map pin/);
    expect(() => parseVenuePage("x", "new google.maps.LatLng(52.1,5.08)")).toThrow(/no street address/);
  });
});
