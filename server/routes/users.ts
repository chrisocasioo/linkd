import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { savedQrs, users } from '../db/schema';

const router = Router();

router.get('/me', async (req, res) => {
  const userId = (req as any).userId as string;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.patch('/me', async (req, res) => {
  const userId = (req as any).userId as string;
  const { displayName } = req.body as { displayName?: string };
  if (!displayName) return res.status(400).json({ error: 'displayName required' });

  const [updated] = await db
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  res.json(updated);
});

router.delete('/me', async (req, res) => {
  const userId = (req as any).userId as string;
  await db.delete(savedQrs).where(eq(savedQrs.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  res.json({ success: true });
});

export default router;
