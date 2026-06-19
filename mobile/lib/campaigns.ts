import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { usersCol } from './firestore';

export type CampaignStatus = 'active' | 'completed';

/** A trip-promotion campaign stored at `campaigns/{id}`. */
export type Campaign = {
  id: string;
  ownerId: string;
  tripId: string;
  tripName: string;
  budgetCents: number;
  durationDays: number;
  dailyCents: number;
  spentCents: number;
  startAt: FirebaseFirestoreTypes.Timestamp;
  endAt: FirebaseFirestoreTypes.Timestamp;
  status: CampaignStatus;
  createdAt?: FirebaseFirestoreTypes.Timestamp;
};

/** The three RevenueCat consumable top-ups, mapped to wallet credit (cents). */
export const TOPUPS = [
  { productId: 'com.flytok.topup10', cents: 1000, label: '$10' },
  { productId: 'com.flytok.topup50', cents: 5000, label: '$50' },
  { productId: 'com.flytok.topup100', cents: 10000, label: '$100' },
] as const;

export function campaignsCol() {
  return firestore().collection('campaigns');
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export async function getWalletCents(uid: string): Promise<number> {
  try {
    const snap = await usersCol().doc(uid).get();
    return (snap.data()?.walletCents as number | undefined) ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Credit the wallet. TEMP: client-side for testing the flow. For real money
 * this MUST move server-side (RevenueCat webhook → Cloud Function) so a client
 * can't mint balance. See memory: campaigns-revenuecat.
 */
export async function creditWallet(uid: string, cents: number): Promise<number> {
  return firestore().runTransaction(async (tx) => {
    const ref = usersCol().doc(uid);
    const snap = await tx.get(ref);
    const current = (snap.data()?.walletCents as number | undefined) ?? 0;
    const next = current + cents;
    tx.set(ref, { walletCents: next }, { merge: true });
    return next;
  });
}

/**
 * Create a campaign, debiting its budget from the wallet in the same
 * transaction. Throws 'insufficient_funds' if the wallet can't cover it.
 */
export async function createCampaign(args: {
  tripId: string;
  tripName: string;
  budgetCents: number;
  durationDays: number;
}): Promise<string> {
  const user = auth().currentUser;
  if (!user) throw new Error('Not signed in');
  const { tripId, tripName, budgetCents, durationDays } = args;
  if (budgetCents <= 0) throw new Error('Budget must be greater than zero');
  if (durationDays <= 0) throw new Error('Duration must be at least one day');

  const start = new Date();
  const end = new Date(start.getTime() + durationDays * 86_400_000);

  return firestore().runTransaction(async (tx) => {
    const userRef = usersCol().doc(user.uid);
    const userSnap = await tx.get(userRef);
    const balance = (userSnap.data()?.walletCents as number | undefined) ?? 0;
    if (balance < budgetCents) throw new Error('insufficient_funds');

    const campRef = campaignsCol().doc();
    tx.set(userRef, { walletCents: balance - budgetCents }, { merge: true });
    tx.set(campRef, {
      ownerId: user.uid,
      tripId,
      tripName,
      budgetCents,
      durationDays,
      dailyCents: Math.round(budgetCents / durationDays),
      spentCents: 0,
      startAt: firestore.Timestamp.fromDate(start),
      endAt: firestore.Timestamp.fromDate(end),
      status: 'active',
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    return campRef.id;
  });
}

export async function getMyCampaigns(uid: string): Promise<Campaign[]> {
  try {
    const snap = await campaignsCol().where('ownerId', '==', uid).limit(100).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Campaign, 'id'>) }));
    items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return items;
  } catch (err) {
    console.warn('[campaigns] load failed:', err);
    return [];
  }
}
