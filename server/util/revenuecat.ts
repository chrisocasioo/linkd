import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

const ENTITLEMENT_ID = 'Linkd Pro';

/**
 * Live entitlement check against RevenueCat — the source of truth when our
 * DB's cached `users.isPro` (kept in sync by the webhook) may be stale.
 *
 * Tri-state on purpose: `null` means "couldn't tell" (no key configured,
 * network error, RevenueCat 5xx). Callers must never treat null as "not
 * subscribed" — an outage must not downgrade a paying customer.
 */
export async function isEntitledLive(appUserId: string): Promise<boolean | null> {
  const secretKey = process.env.REVENUECAT_SECRET_KEY ?? '';
  if (!secretKey || !appUserId) return null;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) return null;
    const body: any = await res.json();
    const entitlement = body?.subscriber?.entitlements?.[ENTITLEMENT_ID];
    if (!entitlement) return false;
    // No expires_date means a non-expiring (lifetime) entitlement
    return !entitlement.expires_date || new Date(entitlement.expires_date).getTime() > Date.now();
  } catch {
    return null;
  }
}

/**
 * Is this user Pro? Trusts the DB flag when it says yes; when it says no,
 * double-checks with RevenueCat and self-heals the flag if they actually are
 * subscribed (webhook missed/misconfigured). Unknown ⇒ falls back to the DB
 * value rather than guessing.
 */
export async function ensurePro(userId: string, dbIsPro: boolean | null | undefined): Promise<boolean> {
  if (dbIsPro) return true;
  const live = await isEntitledLive(userId);
  if (live === true) {
    await db.update(users).set({ isPro: true }).where(eq(users.id, userId));
    return true;
  }
  return false;
}
