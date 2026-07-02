import { and, asc, count, eq, gt, isNull, lt } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { cards, cardViews, users } from '../db/schema';

const router = Router();

// Public — no auth required
router.post('/view', async (req, res) => {
  try {
    const { username } = req.body as { username?: string };
    if (!username) return res.status(400).json({ error: 'username required' });
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await db.insert(cardViews).values({ userId: user.id, linkId: null });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Protected
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const [profileViewsResult] = await db
      .select({ count: count() })
      .from(cardViews)
      .where(and(eq(cardViews.userId, userId), isNull(cardViews.linkId), gt(cardViews.viewedAt, thirtyDaysAgo)));

    const [prevProfileViewsResult] = await db
      .select({ count: count() })
      .from(cardViews)
      .where(and(eq(cardViews.userId, userId), isNull(cardViews.linkId), gt(cardViews.viewedAt, sixtyDaysAgo), lt(cardViews.viewedAt, thirtyDaysAgo)));

    const earliestView = await db.query.cardViews.findFirst({
      where: eq(cardViews.userId, userId),
      orderBy: (cv, { asc }) => [asc(cv.viewedAt)],
    });

    const userCards = await db
      .select()
      .from(cards)
      .where(eq(cards.userId, userId))
      .orderBy(asc(cards.displayOrder));

    const cardViewsCurrent = await db
      .select({ cardId: cardViews.cardId, count: count() })
      .from(cardViews)
      .where(and(eq(cardViews.userId, userId), gt(cardViews.viewedAt, thirtyDaysAgo)))
      .groupBy(cardViews.cardId);

    const cardViewsPrev = await db
      .select({ cardId: cardViews.cardId, count: count() })
      .from(cardViews)
      .where(and(eq(cardViews.userId, userId), gt(cardViews.viewedAt, sixtyDaysAgo), lt(cardViews.viewedAt, thirtyDaysAgo)))
      .groupBy(cardViews.cardId);

    const cardBreakdown = userCards.map((card) => ({
      cardId: card.id,
      cardName: card.name,
      accentColor: card.accentColor,
      views: Number(cardViewsCurrent.find((cv) => cv.cardId === card.id)?.count ?? 0),
      prevViews: Number(cardViewsPrev.find((cv) => cv.cardId === card.id)?.count ?? 0),
    }));

    res.json({
      profileViews: Number(profileViewsResult?.count ?? 0),
      prevProfileViews: Number(prevProfileViewsResult?.count ?? 0),
      trackingSince: earliestView?.viewedAt ?? null,
      cardBreakdown,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
