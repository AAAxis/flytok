/**
 * Sync the `role` field on `users/{uid}` docs into the Firebase Auth custom
 * claim of the same name. The admin panel edits the Firestore field; the apps
 * gate access on `tokenResult.claims.role` — this trigger keeps them in sync
 * so granting admin/advertiser from the UI actually takes effect.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

const KNOWN_ROLES = ['admin', 'advertiser'];

export const syncUserRoleClaim = onDocumentWritten('users/{uid}', async (event) => {
  const uid = event.params.uid;
  const before = event.data?.before.data()?.role ?? null;
  const afterRaw = event.data?.after.data()?.role ?? null;
  const after = KNOWN_ROLES.includes(afterRaw) ? afterRaw : null;

  // Doc deleted, or role unchanged (normalizing unknown values to null).
  if (!event.data?.after.exists) return;
  if (before === afterRaw && (event.data.before.exists || after === null)) return;

  try {
    const user = await admin.auth().getUser(uid);
    const currentClaim = (user.customClaims?.role as string | undefined) ?? null;
    if (currentClaim === after) return;

    await admin.auth().setCustomUserClaims(uid, { ...user.customClaims, role: after ?? undefined });
    // Force existing sessions to mint a fresh ID token so the change applies
    // on next refresh instead of up to an hour later.
    await admin.auth().revokeRefreshTokens(uid);
    logger.info(`Synced role claim for ${uid}: ${currentClaim ?? 'none'} → ${after ?? 'none'}`);
  } catch (err) {
    // Seeded/orphaned Firestore docs with no matching Auth user land here.
    logger.warn(`Could not sync role claim for ${uid}`, err);
  }
});
