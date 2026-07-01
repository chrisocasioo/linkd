import { and, count, eq, gt, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { cardViews, links, users } from '../db/schema';

const router = Router();

// Public — no auth required
router.post('/view', async (req, res) => {
  try {
    const { username, linkId } = req.body as { username?: string; linkId?: string };
    if (!username) return res.status(400).json({ error: 'username required' });

    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.insert(cardViews).values({
      userId: user.id,
      linkId: linkId ?? null,
    });
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

    const linkClickRows = await db
      .select({ linkId: cardViews.linkId, title: links.title, url: links.url, clickCount: count() })
      .from(cardViews)
      .innerJoin(links, eq(cardViews.linkId, links.id))
      .where(and(eq(cardViews.userId, userId), isNotNull(cardViews.linkId), gt(cardViews.viewedAt, thirtyDaysAgo)))
      .groupBy(cardViews.linkId, links.title, links.url)
      .orderBy(sql`count(*) DESC`);

    const [prevLinkClicksResult] = await db
      .select({ count: count() })
      .from(cardViews)
      .where(and(eq(cardViews.userId, userId), isNotNull(cardViews.linkId), gt(cardViews.viewedAt, sixtyDaysAgo), lt(cardViews.viewedAt, thirtyDaysAgo)));

    const earliestView = await db.query.cardViews.findFirst({
      where: eq(cardViews.userId, userId),
      orderBy: (cv, { asc }) => [asc(cv.viewedAt)],
    });

    const profileViews = Number(profileViewsResult?.count ?? 0);
    const prevProfileViews = Number(prevProfileViewsResult?.count ?? 0);
    const totalLinkClicks = linkClickRows.reduce((s, r) => s + Number(r.clickCount), 0);
    const prevTotalLinkClicks = Number(prevLinkClicksResult?.count ?? 0);

    res.json({
      profileViews,
      prevProfileViews,
      totalLinkClicks,
      prevTotalLinkClicks,
      trackingSince: earliestView?.viewedAt ?? null,
      linkClicks: linkClickRows.map((r) => ({ linkId: r.linkId, title: r.title, url: r.url, count: Number(r.clickCount) })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
