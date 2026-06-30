import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET ?? '';
    const signature = req.headers['x-revenuecat-signature'] as string | undefined;

    if (secret && signature) {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(req.body as Buffer)
        .digest('hex');
      if (signature !== expected) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const payload = JSON.parse((req.body as Buffer).toString());
    const evt = payload?.event ?? {};
    const revenueCatId: string = evt.app_user_id ?? '';
    const type: string = evt.type ?? '';

    if (!revenueCatId) return res.json({ success: true });

    if (['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION'].includes(type)) {
      await db.update(users).set({ isPro: true, revenueCatId }).where(eq(users.id, revenueCatId));
    } else if (['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'].includes(type)) {
      await db.update(users).set({ isPro: false }).where(eq(users.id, revenueCatId));
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
