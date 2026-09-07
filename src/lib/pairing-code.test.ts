import { describe, expect, it } from "vitest";
import { generateCode, isExpired, isRedeemable, isRedeemed, PAIRING_CODE_TTL_MS } from "./pairing-code";

describe("generateCode", () => {
  it("is always a zero-padded 6-digit string", () => {
    // 0 and max-1 are the boundary values that most likely break padStart.
    expect(generateCode(() => 0)).toBe("000000");
    expect(generateCode(() => 999999)).toBe("999999");
    expect(generateCode(() => 42)).toBe("000042");
  });
});

describe("isExpired", () => {
  const createdAt = new Date("2026-08-10T12:00:00Z");
  const expiresAt = new Date(createdAt.getTime() + PAIRING_CODE_TTL_MS);

  it("is not expired before the expiry instant", () => {
    expect(isExpired({ expiresAt }, new Date(expiresAt.getTime() - 1))).toBe(false);
  });

  it("is expired exactly at and after the expiry instant", () => {
    expect(isExpired({ expiresAt }, expiresAt)).toBe(true);
    expect(isExpired({ expiresAt }, new Date(expiresAt.getTime() + 1))).toBe(true);
  });
});

describe("isRedeemed", () => {
  it("is false when redeemedAt is null", () => {
    expect(isRedeemed({ redeemedAt: null })).toBe(false);
  });

  it("is true once redeemedAt is set", () => {
    expect(isRedeemed({ redeemedAt: new Date() })).toBe(true);
  });
});

describe("isRedeemable", () => {
  const now = new Date("2026-08-10T12:05:00Z");
  const future = new Date(now.getTime() + 1000);
  const past = new Date(now.getTime() - 1000);

  it("is redeemable when not expired and not redeemed", () => {
    expect(isRedeemable({ expiresAt: future, redeemedAt: null }, now)).toBe(true);
  });

  it("is not redeemable once expired, even if never redeemed", () => {
    expect(isRedeemable({ expiresAt: past, redeemedAt: null }, now)).toBe(false);
  });

  it("is not redeemable once already redeemed, even if not expired", () => {
    expect(isRedeemable({ expiresAt: future, redeemedAt: past }, now)).toBe(false);
  });
});
