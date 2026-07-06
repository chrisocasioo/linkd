import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { savedQrs } from '../db/schema';

const router = Router();

router.get('/', async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const qrs = await db.query.savedQrs.findMany({
      where: eq(savedQrs.userId, userId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    res.json(qrs);
  } catch (err: any) {
    console.error('QR fetch failed:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

router.post('/', async (req, res) => {
  const userId = (req as any).userId as string;
  const { type, label, data, color, bgColor } = req.body as {
    type?: string;
    label?: string;
    data?: string;
    color?: string;
    bgColor?: string;
  };

  if (!type || !data) {
    return res.status(400).json({ error: 'type and data are required' });
  }

  try {
    const [qr] = await db
      .insert(savedQrs)
      .values({ userId, type, label: label ?? null, data, color: color ?? null, bgColor: bgColor ?? null })
      .returning();
    res.status(201).json(qr);
  } catch (err: any) {
    console.error('QR insert failed:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to save QR code', detail: err?.message ?? String(err) });
  }
});

router.delete('/:id', async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  try {
    await db
      .delete(savedQrs)
      .where(and(eq(savedQrs.id, id), eq(savedQrs.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    console.error('QR delete failed:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to delete QR code' });
  }
});

export default router;
