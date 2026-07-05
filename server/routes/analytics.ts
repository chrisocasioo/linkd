import { and, asc, count, eq, gt, inArray, isNotNull, lt } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { cardFields, cards, cardViews, fieldClicks, users } from '../db/schema';

const router = Router();

// Public — record a field click (called via fetch from the public card page)
router.post('/field-click/:fieldId', async (req, res) => {
  const { fieldId } = req.params;
  try {
    const field = await db.query.cardFields.findFirst({ where: eq(cardFields.id, fieldId) });
    if (field) {
      const card = await db.query.cards.findFirst({ where: eq(cards.id, field.cardId) });
      if (card) {
        await db.insert(fieldClicks).values({ fieldId, cardId: field.cardId, userId: card.userId });
      }
    }
  } catch {}
  res.json({ ok: true });
});

// Public — record a card page view
router.post('/view', async (req, res) => {
  try {
    const { username, cardId } = req.body as { username?: string; cardId?: string };
    if (!username) return res.status(400).json({ error: 'username required' });
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await db.insert(cardViews).values({ userId: user.id, linkId: null, cardId: cardId ?? null });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Protected — analytics for the authenticated user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo  = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const earliestView = await db.query.cardViews.findFirst({
      where: eq(cardViews.userId, userId),
      orderBy: (cv, { asc }) => [asc(cv.viewedAt)],
    });

    const userCards = await db
      .select()
      .from(cards)
      .where(eq(cards.userId, userId))
      .orderBy(asc(cards.displayOrder));

    const cardIds = userCards.map((c) => c.id);

    // Card page views (where a specific card was visited)
    const [totalViewsCurrent] = await db
      .select({ count: count() })
      .from(cardViews)
      .where(and(eq(cardViews.userId, userId), isNotNull(cardViews.cardId), gt(cardViews.viewedAt, thirtyDaysAgo)));

    const [totalViewsPrev] = await db
      .select({ count: count() })
      .from(cardViews)
      .where(and(eq(cardViews.userId, userId), isNotNull(cardViews.cardId), gt(cardViews.viewedAt, sixtyDaysAgo), lt(cardViews.viewedAt, thirtyDaysAgo)));

    // Per-card view breakdown
    const cardViewsCurrent = await db
      .select({ cardId: cardViews.cardId, count: count() })
      .from(cardViews)
      .where(and(eq(cardViews.userId, userId), isNotNull(cardViews.cardId), gt(cardViews.viewedAt, thirtyDaysAgo)))
      .groupBy(cardViews.cardId);

    const cardViewsPrev = await db
      .select({ cardId: cardViews.cardId, count: count() })
      .from(cardViews)
      .where(and(eq(cardViews.userId, userId), isNotNull(cardViews.cardId), gt(cardViews.viewedAt, sixtyDaysAgo), lt(cardViews.viewedAt, thirtyDaysAgo)))
      .groupBy(cardViews.cardId);

    // All fields for all user cards
    const allFields = cardIds.length > 0
      ? await db.select().from(cardFields).where(inArray(cardFields.cardId, cardIds)).orderBy(asc(cardFields.displayOrder))
      : [];

    // Per-field click breakdown
    const fieldClicksCurrent = await db
      .select({ fieldId: fieldClicks.fieldId, count: count() })
      .from(fieldClicks)
      .where(and(eq(fieldClicks.userId, userId), gt(fieldClicks.clickedAt, thirtyDaysAgo)))
      .groupBy(fieldClicks.fieldId);

    const fieldClicksPrev = await db
      .select({ fieldId: fieldClicks.fieldId, count: count() })
      .from(fieldClicks)
      .where(and(eq(fieldClicks.userId, userId), gt(fieldClicks.clickedAt, sixtyDaysAgo), lt(fieldClicks.clickedAt, thirtyDaysAgo)))
      .groupBy(fieldClicks.fieldId);

    const NON_LINK_TYPES = new Set(['title', 'company', 'department', 'headline']);

    const cardBreakdown = userCards.map((card) => {
      const linkFields = allFields.filter(
        (f) => f.cardId === card.id && !NON_LINK_TYPES.has(f.type)
      );
      return {
        cardId: card.id,
        cardName: card.name,
        accentColor: card.accentColor,
        views: Number(cardViewsCurrent.find((cv) => cv.cardId === card.id)?.count ?? 0),
        prevViews: Number(cardViewsPrev.find((cv) => cv.cardId === card.id)?.count ?? 0),
        fieldClicks: linkFields.map((f) => ({
          fieldId: f.id,
          fieldType: f.type,
          fieldValue: f.value,
          fieldIcon: f.icon,
          label: f.label,
          clicks: Number(fieldClicksCurrent.find((fc) => fc.fieldId === f.id)?.count ?? 0),
          prevClicks: Number(fieldClicksPrev.find((fc) => fc.fieldId === f.id)?.count ?? 0),
        })),
      };
    });

    res.json({
      totalCardViews: Number(totalViewsCurrent?.count ?? 0),
      prevTotalCardViews: Number(totalViewsPrev?.count ?? 0),
      trackingSince: earliestView?.viewedAt ?? null,
      cardBreakdown,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
