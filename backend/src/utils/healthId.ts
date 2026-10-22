/**
 * backend/src/utils/healthId.ts
 *
 * Generates unique, non-guessable, human-readable Health IDs for Sanjivni patient profiles.
 *
 * Format: SNJ-XXXX-XXXX-XXXX
 * - Prefix 'SNJ' identifies Sanjivani application-generated health memory IDs.
 * - Distinct from Government IDs (ABHA / Aadhaar).
 * - Opaque cryptographic randomness ensures uniqueness and unguessability.
 */

import crypto from 'node:crypto';

export function generateHealthId(): string {
  // Generate 6 random bytes = 12 hex characters
  const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
  // Split into 3 groups of 4 characters: XXXX-XXXX-XXXX
  const part1 = randomHex.slice(0, 4);
  const part2 = randomHex.slice(4, 8);
  const part3 = randomHex.slice(8, 12);
  return `SNJ-${part1}-${part2}-${part3}`;
}
