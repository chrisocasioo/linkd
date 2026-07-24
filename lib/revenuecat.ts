import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export async function initRevenueCat(userId: string) {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
  if (!apiKey) return;
  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey, appUserID: userId });
}

export async function getEntitlements(): Promise<{ isPro: boolean }> {
  try {
    const customer = await Purchases.getCustomerInfo();
    return { isPro: !!customer.entitlements.active['Linkd Pro'] };
  } catch {
    return { isPro: false };
  }
}

/**
 * Re-links an existing purchase to this install — a reinstall, a new
 * device, or the same Apple ID signed in elsewhere. Not a purchase itself
 * (no charge either way); Apple requires every app selling subscriptions
 * to offer this (App Store Review Guideline 3.1.1).
 */
export async function restorePurchases(): Promise<boolean> {
  const customerInfo = await Purchases.restorePurchases();
  return !!customerInfo.entitlements.active['Linkd Pro'];
}

export interface ProPackagePricing {
  priceString: string;
  price: number;
  /** Days of free trial from the product's introductory offer, if any */
  trialDays: number | null;
}

export interface ProPricing {
  monthly: ProPackagePricing | null;
  annual: ProPackagePricing | null;
}

function packagePricing(pkg: any): ProPackagePricing | null {
  if (!pkg?.product) return null;
  const p = pkg.product;
  let trialDays: number | null = null;
  const intro = p.introPrice;
  if (intro && intro.price === 0) {
    const unitDays =
      intro.periodUnit === 'DAY' ? 1 :
      intro.periodUnit === 'WEEK' ? 7 :
      intro.periodUnit === 'MONTH' ? 30 : 365;
    trialDays = (intro.periodNumberOfUnits ?? 1) * unitDays;
  }
  return { priceString: p.priceString, price: p.price, trialDays };
}

/** Live App Store prices for the paywall — null when offline or unconfigured */
export async function getProPricing(): Promise<ProPricing | null> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    return {
      monthly: packagePricing(current.monthly),
      annual: packagePricing(current.annual),
    };
  } catch {
    return null;
  }
}

export async function purchasePro(type: 'monthly' | 'annual'): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    // These used to silently `return false`, indistinguishable from a user
    // backing out of the purchase sheet below — the paywall's "if (success)"
    // check treated a genuine RevenueCat/App Store Connect misconfiguration
    // exactly like a cancel, so the button just stopped loading with zero
    // feedback. Throwing here instead surfaces it as a real error alert.
    if (!current) throw new Error('No subscription plans are available right now. Please try again later.');
    const pkg = type === 'annual' ? current.annual : current.monthly;
    if (!pkg) throw new Error(`The ${type} plan isn't available right now. Please try again later.`);
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo.entitlements.active['Linkd Pro'];
  } catch (err: any) {
    if (err?.userCancelled) return false;
    throw err;
  }
}
