import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

/**
 * RevenueCat integration.
 *
 * RevenueCat wraps StoreKit (iOS) and Google Play Billing (Android) behind a
 * single API. Access to Pro is granted via the `pro` *entitlement*, which you
 * attach to your subscription products in the RevenueCat dashboard.
 *
 * The public SDK keys are safe to ship in the client (they can only read/create
 * purchases for the signed-in user). The secret key lives on the backend only.
 */

/** Entitlement identifier configured in the RevenueCat dashboard. */
export const PRO_ENTITLEMENT = 'pro';

const iosKey =
  Constants.expoConfig?.extra?.revenueCatIosKey ??
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ??
  '';
const androidKey =
  Constants.expoConfig?.extra?.revenueCatAndroidKey ??
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ??
  '';
const webBillingKey =
  Constants.expoConfig?.extra?.revenueCatWebBillingKey ??
  process.env.EXPO_PUBLIC_REVENUECAT_WEB_BILLING_KEY ??
  '';

let configured = false;

/** True if the SDK is configured with a usable key for this platform. */
export function isPurchasesReady(): boolean {
  return configured;
}

/**
 * Configure the SDK once at app start. `appUserId` should be the Supabase user
 * id so purchases are tied to the account (and survive reinstalls / device
 * changes). Safe to call before the user logs in (pass undefined).
 */
export function configurePurchases(appUserId?: string): void {
  if (configured) return;
  const apiKey =
    Platform.OS === 'ios'
      ? iosKey
      : Platform.OS === 'web'
        ? webBillingKey
        : androidKey;
  if (!apiKey) return; // no key yet — paywall will surface "unavailable"
  try {
    Purchases.configure({ apiKey, appUserID: appUserId ?? null });
    configured = true;
  } catch {
    // Keep web usable even when billing key is missing/invalid.
    configured = false;
  }
}

/** Associate purchases with the signed-in Supabase user. */
export async function identifyUser(appUserId: string): Promise<void> {
  if (!configured) configurePurchases(appUserId);
  if (!configured) return;
  try {
    await Purchases.logIn(appUserId);
  } catch {
    // Non-fatal: identity will retry on next launch.
  }
}

/** Detach the current user (call on sign-out). */
export async function logOutPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Ignore — anonymous id will be used until next logIn.
  }
}

/** Does this CustomerInfo currently grant Pro? */
export function isProActive(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT] !== undefined;
}

/** The "current" offering (the set of packages you show on the paywall). */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

/**
 * Purchase a package. Returns true if Pro is now active.
 * Throws on real errors; the caller should treat `error.userCancelled === true`
 * as a silent no-op.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return isProActive(customerInfo);
}

/** Restore prior purchases (required by Apple). Returns true if Pro is active. */
export async function restorePurchases(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  return isProActive(info);
}

/** Read the live entitlement state from the store. */
export async function refreshProStatus(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.getCustomerInfo();
  return isProActive(info);
}
