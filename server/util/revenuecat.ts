// Live fallback for when our DB's cached `users.isPro` hasn't caught up with
// RevenueCat yet — normally kept in sync by the webhook in
// routes/revenuecat.ts, but that only works if the webhook is actually
// configured and reachable. This hits RevenueCat directly as a source of
// truth so a missed/misconfigured webhook doesn't permanently strand a real
// subscriber behind a free-tier gate.
export async function isEntitledLive(appUserId: string): Promise<boolean> {
  const secretKey = process.env.REVENUECAT_SECRET_KEY ?? '';
  if (!secretKey || !appUserId) return false;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) return false;
    const body = await res.json();
    const entitlement = body?.subscriber?.entitlements?.['Linkd Pro'];
    if (!entitlement) return false;
    // No expires_date means a non-expiring (lifetime) entitlement
    return !entitlement.expires_date || new Date(entitlement.expires_date).getTime() > Date.now();
  } catch {
    return false;
  }
}
