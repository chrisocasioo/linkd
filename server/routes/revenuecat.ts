import crypto from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';

const router = Router();

// RevenueCat event semantics (docs: "Event types and fields"):
//  - CANCELLATION only means auto-renew was switched off — the customer keeps
//    access until EXPIRATION, so it must NOT revoke anything.
//  - BILLING_ISSUE starts a grace period; access continues until EXPIRATION.
//  - EXPIRATION is the only event that ends access.
//  - TRANSFER moves entitlements between app user ids.
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
]);

router.post('/', async (req, res) => {
  // Fail closed: with no secret configured there is no way to tell RevenueCat
  // from anyone else, and this endpoint can grant Pro to any user id.
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET ?? '';
  if (!secret) {
    console.error('RevenueCat webhook rejected: REVENUECAT_WEBHOOK_SECRET is not set');
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const authHeader = (req.headers['authorization'] as string | undefined) ?? '';
  const expected = Buffer.from(secret);
  const received = Buffer.from(authHeader);
  const valid = expected.length === received.length && crypto.timingSafeEqual(expected, received);
  if (!valid) return res.status(401).json({ error: 'Invalid authorization header' });

  // A malformed body is a permanent failure — 400 (not 500) so RevenueCat
  // doesn't retry it forever.
  let evt: any;
  try {
    evt = JSON.parse((req.body as Buffer).toString())?.event ?? {};
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  try {
    const type: string = evt.type ?? '';
    const revenueCatId: string = evt.app_user_id ?? '';

    if (type === 'TRANSFER') {
      const to: string[] = Array.isArray(evt.transferred_to) ? evt.transferred_to : [];
      const from: string[] = Array.isArray(evt.transferred_from) ? evt.transferred_from : [];
      if (to.length) await db.update(users).set({ isPro: true }).where(inArray(users.id, to));
      if (from.length) await db.update(users).set({ isPro: false }).where(inArray(users.id, from));
    } else if (revenueCatId && GRANT_EVENTS.has(type)) {
      await db.update(users).set({ isPro: true, revenueCatId }).where(eq(users.id, revenueCatId));
    } else if (revenueCatId && type === 'EXPIRATION') {
      await db.update(users).set({ isPro: false }).where(eq(users.id, revenueCatId));
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('RevenueCat webhook failed:', err?.message ?? err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
