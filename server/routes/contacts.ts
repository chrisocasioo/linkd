import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { contacts } from '../db/schema';

const router = Router();

const VALID_SOURCES = new Set(['manual', 'scan', 'card']);

// GET / — list all contacts for the authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .orderBy(desc(contacts.createdAt));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — save a confirmed contact
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { firstName, lastName, email, phone, fax, company, jobTitle, website, address, notes, source } = req.body;
    const [created] = await db
      .insert(contacts)
      .values({
        userId, firstName, lastName, email, phone, fax, company, jobTitle, website, address, notes,
        source: VALID_SOURCES.has(source) ? source : 'manual',
      })
      .returning();
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id — update contact fields
router.patch('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const { firstName, lastName, email, phone, fax, company, jobTitle, website, address, notes } = req.body;
    const [updated] = await db
      .update(contacts)
      .set({ firstName, lastName, email, phone, fax, company, jobTitle, website, address, notes })
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const [deleted] = await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning();
    if (!deleted || deleted.userId !== userId) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
