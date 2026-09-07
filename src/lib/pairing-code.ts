// Pure pairing-code logic — no Prisma/network here, so it's cheaply
// unit-testable and the Server Action that calls it (generatePairingCode /
// redeemPairingCode in src/app/favorites/actions.ts) stays thin.

import { randomInt } from "node:crypto";

const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

// crypto.randomInt (not Math.random) so a code can't be predicted from
// observing others — cheap insurance even though the threat model here
// (see schema.prisma's PairingCode comment) doesn't call for much.
export function generateCode(random: (max: number) => number = randomInt): string {
  const max = 10 ** PAIRING_CODE_LENGTH;
  return String(random(max)).padStart(PAIRING_CODE_LENGTH, "0");
}

export interface PairingCodeRecord {
  expiresAt: Date;
  redeemedAt: Date | null;
}

export function isExpired(record: Pick<PairingCodeRecord, "expiresAt">, now: Date = new Date()): boolean {
  return now.getTime() >= record.expiresAt.getTime();
}

export function isRedeemed(record: Pick<PairingCodeRecord, "redeemedAt">): boolean {
  return record.redeemedAt !== null;
}

export function isRedeemable(record: PairingCodeRecord, now: Date = new Date()): boolean {
  return !isExpired(record, now) && !isRedeemed(record);
}
