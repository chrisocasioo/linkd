import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { savedQrs } from '../db/schema';

const router = Router();

router.get('/', async (req, res) => {
  const userId = (req as any).userId as string;
  const qrs = await db.query.savedQrs.findMany({
    where: eq(savedQrs.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(qrs);
});

router.post('/', async (req, res) => {
  const userId = (req as any).userId as string;
  const { type, label, data } = req.body as {
    type?: string;
    label?: string;
    data?: string;
  };

  if (!type || !data) {
    return res.status(400).json({ error: 'type and data are required' });
  }

  const [qr] = await db
    .insert(savedQrs)
    .values({ userId, type, label: label ?? null, data })
    .returning();

  res.status(201).json(qr);
});

router.delete('/:id', async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  await db
    .delete(savedQrs)
    .where(and(eq(savedQrs.id, id), eq(savedQrs.userId, userId)));

  res.json({ success: true });
});

export default router;
