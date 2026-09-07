import { describe, expect, it } from "vitest";
import { stageMapsUrl } from "./venues";

describe("stageMapsUrl", () => {
  it("searches by name and address when an address is known", () => {
    const url = stageMapsUrl({ name: "Worm 1", address: "Boomgaardsstraat 71, Rotterdam" });
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("Worm 1, Boomgaardsstraat 71, Rotterdam"),
    );
  });

  // No hardcoded city fallback: a PdC stage with no address must not get
  // silently pointed at Rotterdam just because that used to be the only
  // festival this helper served.
  it("searches by name alone when there's no address, without guessing a city", () => {
    const url = stageMapsUrl({ name: "Vodafone", address: null });
    expect(url).toBe("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Vodafone"));
  });
});
