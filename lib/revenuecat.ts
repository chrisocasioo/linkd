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

export async function purchasePro(type: 'monthly' | 'annual'): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return false;
    const pkg = type === 'annual' ? current.annual : current.monthly;
    if (!pkg) return false;
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return !!customerInfo.entitlements.active['Linkd Pro'];
  } catch (err: any) {
    if (err?.userCancelled) return false;
    throw err;
  }
}
