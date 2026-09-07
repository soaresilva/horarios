import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

// Anonymous cross-device favorites identity — deliberately NOT the jose-signed
// pattern src/lib/session.ts uses for the admin cookie. That signing exists to
// protect a real authorization boundary (admin write access) from forgery;
// here the identity IS the credential, and a v4 UUID's 122 bits of entropy
// already makes it unguessable. Signing would only couple this to
// SESSION_SECRET for no real gain. See the "sync favorites across devices"
// plan for the full reasoning.
export const VISITOR_COOKIE_NAME = "pdc_visitor_id";
const VISITOR_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60; // ~400 days, the browser-enforced cap on Set-Cookie Max-Age

// Read-only: returns null for a visitor who has never opted into sync, so
// callers (listFavorites/syncFavorites/generatePairingCode) can tell "not
// synced" apart from "synced with zero favorites" without a network call.
export async function getVisitorId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? null;
}

// Only ever called from optIntoSync (first opt-in) or redeemPairingCode
// (adopting the other device's id) — never on a bare page load, so a visitor
// who never touches sync gets no new cookie at all.
export async function setVisitorId(visitorId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(VISITOR_COOKIE_NAME, visitorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function getOrCreateVisitorId(): Promise<string> {
  const existing = await getVisitorId();
  if (existing) return existing;
  const created = randomUUID();
  await setVisitorId(created);
  return created;
}
