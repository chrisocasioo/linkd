import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { scanHistory } from '../db/schema';

const router = Router();

const VALID_TYPES = new Set(['contact', 'qr']);

router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const rows = await db.query.scanHistory.findMany({
      where: eq(scanHistory.userId, userId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { type, contactId, label, qrData, qrFormat } = req.body as {
      type?: string;
      contactId?: string;
      label?: string;
      qrData?: string;
      qrFormat?: string;
    };
    if (!VALID_TYPES.has(type ?? '') || !label) {
      return res.status(400).json({ error: 'type (contact|qr) and label are required' });
    }
    const [created] = await db
      .insert(scanHistory)
      .values({ userId, type: type!, contactId: contactId ?? null, label, qrData: qrData ?? null, qrFormat: qrFormat ?? null })
      .returning();
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const [deleted] = await db
      .delete(scanHistory)
      .where(and(eq(scanHistory.id, id), eq(scanHistory.userId, userId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
