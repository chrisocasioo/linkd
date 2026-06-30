import { eq, ne, and } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';

const router = Router();

const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;

router.get('/me', async (req, res) => {
  const userId = (req as any).userId as string;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.get('/me/check-username/:username', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const raw = req.params.username.toLowerCase();
    if (!USERNAME_RE.test(raw)) {
      return res.json({ available: false, error: 'Invalid format' });
    }
    const existing = await db.query.users.findFirst({
      where: and(eq(users.username, raw), ne(users.id, userId)),
    });
    res.json({ available: !existing });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/me', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { displayName, username, bio, theme, accentColor, buttonStyle, font, customDomain, revenueCatId } =
      req.body as Record<string, string | undefined>;

    const update: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

    if (displayName !== undefined) update.displayName = displayName;
    if (bio !== undefined) update.bio = bio;
    if (theme !== undefined) update.theme = theme;
    if (accentColor !== undefined) update.accentColor = accentColor;
    if (buttonStyle !== undefined) update.buttonStyle = buttonStyle;
    if (font !== undefined) update.font = font;
    if (customDomain !== undefined) update.customDomain = customDomain;
    if (revenueCatId !== undefined) update.revenueCatId = revenueCatId;

    if (username !== undefined) {
      const normalized = username.toLowerCase();
      if (!USERNAME_RE.test(normalized)) {
        return res.status(400).json({ error: 'Username must be 3–30 characters: letters, numbers, _ or -' });
      }
      const conflict = await db.query.users.findFirst({
        where: and(eq(users.username, normalized), ne(users.id, userId)),
      });
      if (conflict) return res.status(409).json({ error: 'Username already taken' });
      update.username = normalized;
    }

    const [updated] = await db.update(users).set(update).where(eq(users.id, userId)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/me', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    await db.delete(users).where(eq(users.id, userId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
