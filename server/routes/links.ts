import { and, asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { links } from '../db/schema';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const rows = await db
      .select()
      .from(links)
      .where(eq(links.userId, userId))
      .orderBy(asc(links.order));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { title, url, type, metadata } = req.body as {
      title?: string; url?: string; type?: string; metadata?: string;
    };
    if (!title || !url) return res.status(400).json({ error: 'title and url required' });

    const existing = await db
      .select()
      .from(links)
      .where(eq(links.userId, userId))
      .orderBy(asc(links.order));
    const nextOrder = existing.length;

    const [created] = await db
      .insert(links)
      .values({ userId, title, url, type: type ?? 'link', metadata: metadata ?? null, order: nextOrder })
      .returning();
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// IMPORTANT: /reorder must be before /:id
router.patch('/reorder', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { items } = req.body as { items: Array<{ id: string; order: number }> };
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

    await Promise.all(
      items.map(({ id, order }) =>
        db
          .update(links)
          .set({ order })
          .where(and(eq(links.id, id), eq(links.userId, userId)))
      )
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const { title, url, goLiveAt, expiresAt, metadata } = req.body as {
      title?: string;
      url?: string;
      goLiveAt?: string | null;
      expiresAt?: string | null;
      metadata?: string | null;
    };

    const update: Partial<typeof links.$inferInsert> = {};
    if (title !== undefined) update.title = title;
    if (url !== undefined) update.url = url;
    if (goLiveAt !== undefined) update.goLiveAt = goLiveAt ? new Date(goLiveAt) : null;
    if (expiresAt !== undefined) update.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (metadata !== undefined) update.metadata = metadata;

    const [updated] = await db
      .update(links)
      .set(update)
      .where(and(eq(links.id, id), eq(links.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Link not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    await db.delete(links).where(and(eq(links.id, id), eq(links.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
