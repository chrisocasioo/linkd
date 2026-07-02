import { and, asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { cards, cardFields, users } from '../db/schema';

const router = Router();

async function getCardsWithFields(userId: string) {
  const userCards = await db
    .select()
    .from(cards)
    .where(eq(cards.userId, userId))
    .orderBy(asc(cards.displayOrder));

  const withFields = await Promise.all(
    userCards.map(async (card) => {
      const fields = await db
        .select()
        .from(cardFields)
        .where(eq(cardFields.cardId, card.id))
        .orderBy(asc(cardFields.displayOrder));
      return { ...card, fields };
    })
  );
  return withFields;
}

router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    res.json(await getCardsWithFields(userId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { name, accentColor } = req.body as { name?: string; accentColor?: string };
    if (!name) return res.status(400).json({ error: 'name required' });

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const existing = await db.select().from(cards).where(eq(cards.userId, userId));
    if (!user?.isPro && existing.length >= 3) {
      return res.status(403).json({ error: 'Upgrade to Pro for unlimited cards' });
    }

    const slug = Math.random().toString(36).slice(2, 10);
    const [created] = await db
      .insert(cards)
      .values({ userId, name, accentColor: accentColor ?? '#C9A84C', slug, displayOrder: existing.length })
      .returning();
    res.status(201).json({ ...created, fields: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// IMPORTANT: /reorder before /:id
router.patch('/reorder', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { items } = req.body as { items: Array<{ id: string; order: number }> };
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
    await Promise.all(
      items.map(({ id, order }) =>
        db.update(cards).set({ displayOrder: order }).where(and(eq(cards.id, id), eq(cards.userId, userId)))
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
    const { name, accentColor } = req.body as { name?: string; accentColor?: string };
    const update: Partial<typeof cards.$inferInsert> = {};
    if (name !== undefined) update.name = name;
    if (accentColor !== undefined) update.accentColor = accentColor;
    const [updated] = await db
      .update(cards)
      .set(update)
      .where(and(eq(cards.id, id), eq(cards.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Card not found' });
    const fields = await db.select().from(cardFields).where(eq(cardFields.cardId, id)).orderBy(asc(cardFields.displayOrder));
    res.json({ ...updated, fields });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    await db.delete(cards).where(and(eq(cards.id, id), eq(cards.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Field routes ──────────────────────────────────────────────────────────────

router.post('/:id/fields', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id: cardId } = req.params;
    const card = await db.query.cards.findFirst({ where: and(eq(cards.id, cardId), eq(cards.userId, userId)) });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    const { type, value, label } = req.body as { type?: string; value?: string; label?: string };
    if (!type || !value) return res.status(400).json({ error: 'type and value required' });
    const existing = await db.select().from(cardFields).where(eq(cardFields.cardId, cardId));
    const [created] = await db
      .insert(cardFields)
      .values({ cardId, type, value, label: label ?? null, displayOrder: existing.length })
      .returning();
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/fields/reorder', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id: cardId } = req.params;
    const card = await db.query.cards.findFirst({ where: and(eq(cards.id, cardId), eq(cards.userId, userId)) });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    const { items } = req.body as { items: Array<{ id: string; order: number }> };
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
    await Promise.all(
      items.map(({ id, order }) =>
        db.update(cardFields).set({ displayOrder: order }).where(and(eq(cardFields.id, id), eq(cardFields.cardId, cardId)))
      )
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/fields/:fieldId', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id: cardId, fieldId } = req.params;
    const card = await db.query.cards.findFirst({ where: and(eq(cards.id, cardId), eq(cards.userId, userId)) });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    const { value, label } = req.body as { value?: string; label?: string };
    const update: Partial<typeof cardFields.$inferInsert> = {};
    if (value !== undefined) update.value = value;
    if (label !== undefined) update.label = label;
    const [updated] = await db
      .update(cardFields)
      .set(update)
      .where(and(eq(cardFields.id, fieldId), eq(cardFields.cardId, cardId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Field not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/fields/:fieldId', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id: cardId, fieldId } = req.params;
    const card = await db.query.cards.findFirst({ where: and(eq(cards.id, cardId), eq(cards.userId, userId)) });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    await db.delete(cardFields).where(and(eq(cardFields.id, fieldId), eq(cardFields.cardId, cardId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
