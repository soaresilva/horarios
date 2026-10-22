import { describe, expect, it } from "vitest";
import { stageMapsUrl, stageMapsUrls } from "./venues";

const search = (query: string) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);

describe("stageMapsUrl", () => {
  it("searches by name and address when an address is known", () => {
    const url = stageMapsUrl({ name: "Worm 1", address: "Boomgaardsstraat 71, Rotterdam" });
    expect(url).toBe(search("Worm 1, Boomgaardsstraat 71, Rotterdam"));
  });

  // No hardcoded city fallback: a PdC stage with no address must not get
  // silently pointed at Rotterdam just because that used to be the only
  // festival this helper served.
  it("searches by name alone when there's no address, without guessing a city", () => {
    const url = stageMapsUrl({ name: "Vodafone", address: null });
    expect(url).toBe(search("Vodafone"));
  });

  it("searches the address alone for a room in a shared building", () => {
    const url = stageMapsUrl({ name: "Pandora", address: "Vredenburgkade 11, 3511 WC Utrecht" }, { sharedAddress: true });
    expect(url).toBe(search("Vredenburgkade 11, 3511 WC Utrecht"));
  });
});

describe("stageMapsUrls", () => {
  const tivoli = "Vredenburgkade 11, 3511 WC Utrecht";

  it("gives every room of one building the same link", () => {
    const urls = stageMapsUrls([
      { id: "grote-zaal", name: "Grote Zaal", address: tivoli },
      { id: "pandora", name: "Pandora", address: tivoli },
      // Same address, typed a little differently.
      { id: "hertz", name: "Hertz", address: " vredenburgkade 11,  3511 WC Utrecht" },
    ]);
    expect(urls.get("grote-zaal")).toBe(search(tivoli));
    expect(urls.get("pandora")).toBe(search(tivoli));
    expect(urls.get("hertz")).toBe(search(" vredenburgkade 11,  3511 WC Utrecht"));
  });

  it("keeps name + address for a one-room venue, and name alone without an address", () => {
    const urls = stageMapsUrls([
      { id: "ekko", name: "EKKO", address: "Bemuurde Weerd Westzijde 3, 3513 BH Utrecht" },
      { id: "grote-zaal", name: "Grote Zaal", address: tivoli },
      { id: "pandora", name: "Pandora", address: tivoli },
      { id: "vodafone", name: "Vodafone", address: null },
      { id: "xapas", name: "Xapas Lounge", address: null },
    ]);
    expect(urls.get("ekko")).toBe(search("EKKO, Bemuurde Weerd Westzijde 3, 3513 BH Utrecht"));
    // Two address-less stages are not "one building".
    expect(urls.get("vodafone")).toBe(search("Vodafone"));
    expect(urls.get("xapas")).toBe(search("Xapas Lounge"));
  });
});
