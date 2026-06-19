import { Platform } from 'react-native';
import Purchases, {
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { TOPUPS } from './campaigns';

export { PAYWALL_RESULT };

// RevenueCat Apple App Store public SDK key (safe to embed in the client).
const IOS_API_KEY = 'appl_qfENhDaGMHVrcqSehjJeaMeDowb';
const ANDROID_API_KEY = 'goog_HRBCrWnmFKeeGUYuesbgoblDjyC';

let configured = false;

/** Configure RevenueCat once at app start. */
export function configurePurchases() {
  if (configured) return;
  const apiKey = Platform.select({
    ios: IOS_API_KEY,
    android: ANDROID_API_KEY,
  });
  if (!apiKey) return;
  try {
    Purchases.configure({ apiKey });
    configured = true;
  } catch (err) {
    console.warn('[purchases] configure failed', err);
  }
}

export function purchasesConfigured() {
  return configured;
}

/** Tie purchases to the Firebase uid so the webhook can credit the right user. */
export async function setPurchasesUser(uid: string | null) {
  if (!configured) return;
  try {
    if (uid) await Purchases.logIn(uid);
    else await Purchases.logOut();
  } catch (err) {
    console.warn('[purchases] identity update failed', err);
  }
}

/**
 * The top-up offering. Prefers the offering marked "current" in RevenueCat,
 * then known identifiers (Base / topups), then any offering. The "current"
 * offering is also the one whose paywall is presented by default.
 */
export async function getTopupOffering(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return (
    offerings.current ??
    offerings.all['Base'] ??
    offerings.all['topups'] ??
    Object.values(offerings.all)[0] ??
    null
  );
}

export async function getTopupPackages(): Promise<PurchasesPackage[]> {
  const offering = await getTopupOffering();
  return offering?.availablePackages ?? [];
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<void> {
  await Purchases.purchasePackage(pkg);
}

/**
 * Present the RevenueCat-hosted paywall for the top-up offering (configured in
 * the RevenueCat dashboard). Returns the PAYWALL_RESULT so callers can react to
 * a purchase. Falls back to the "current" offering if the top-up offering can't
 * be resolved.
 */
export async function presentTopupPaywall(): Promise<PAYWALL_RESULT> {
  const offering = await getTopupOffering();
  return offering
    ? RevenueCatUI.presentPaywall({ offering })
    : RevenueCatUI.presentPaywall();
}

/**
 * Snapshot of the user's current consumable transaction ids. Capture this
 * before presenting the paywall so a purchase made inside it can be detected
 * afterwards (the native paywall returns only a result, not the transaction).
 */
export async function topupTransactionIds(): Promise<Set<string>> {
  try {
    const info = await Purchases.getCustomerInfo();
    return new Set(
      info.nonSubscriptionTransactions.map((t) => t.transactionIdentifier),
    );
  } catch {
    return new Set();
  }
}

/**
 * Wallet credit (cents) owed for consumable transactions that appeared since
 * `seen` was captured — i.e. purchases made during the paywall session.
 *
 * TEMP: this credits client-side to mirror the previous flow. Production should
 * credit via the RevenueCat webhook → Cloud Function (see memory:
 * campaigns-revenuecat) and drop this.
 */
export async function newTopupCreditCents(seen: Set<string>): Promise<number> {
  try {
    const info = await Purchases.getCustomerInfo();
    return info.nonSubscriptionTransactions
      .filter((t) => !seen.has(t.transactionIdentifier))
      .reduce((sum, t) => sum + centsForProduct(t.productIdentifier), 0);
  } catch {
    return 0;
  }
}

/** Map a purchased product id → wallet credit in cents (from TOPUPS). */
export function centsForProduct(productId: string): number {
  const exact = TOPUPS.find((t) => t.productId === productId);
  if (exact) return exact.cents;
  const loose = TOPUPS.find(
    (t) => productId.endsWith(t.productId) || productId.includes(t.productId),
  );
  return loose?.cents ?? 0;
}
