import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { eq, ne, and } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { cards, contacts, savedQrs, users } from '../db/schema';

const router = Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'auto',
  endpoint: process.env.AWS_ENDPOINT_URL_S3 ?? process.env.ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? process.env.ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? process.env.SECRET_ACCESS_KEY ?? '',
  },
  forcePathStyle: true,
});

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

// Deletes everything Linkd itself stores for this account — DB rows (via
// cascade) and every photo/logo in the bucket, which cascade alone never
// touches. Nothing here is retained: Linkd doesn't hold payment records at
// all (Apple/RevenueCat process and retain those independently, under
// their own policies), so there's nothing of that kind to carve out.
router.delete('/me', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const bucket = process.env.BUCKET_NAME ?? process.env.BUCKET ?? '';

    // Gathered before the cascade delete removes our ability to look them up.
    const [userCards, userContacts, userSavedQrs] = await Promise.all([
      db.select({ id: cards.id }).from(cards).where(eq(cards.userId, userId)),
      db.select({ id: contacts.id }).from(contacts).where(eq(contacts.userId, userId)),
      db.select({ id: savedQrs.id }).from(savedQrs).where(eq(savedQrs.userId, userId)),
    ]);

    const keys = [
      `profiles/${userId}.jpg`,
      ...userCards.flatMap((c) => [`cards/${c.id}.jpg`, `cards/${c.id}-qr-logo.jpg`]),
      ...userContacts.map((c) => `contacts/${c.id}.jpg`),
      ...userSavedQrs.map((q) => `qrs/${q.id}-logo.jpg`),
    ];
    await Promise.all(
      keys.map((Key) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key })).catch(() => {}))
    );

    await db.delete(users).where(eq(users.id, userId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
