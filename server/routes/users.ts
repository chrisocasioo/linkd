import { eq, ne, and } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { clerk, evictSyncedUser } from '../middleware/auth';
import { users } from '../db/schema';
import { purgeUserAssets } from '../util/purgeUserAssets';
import { isHexColor, isReservedUsername } from '../util/validate';

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
    if (isReservedUsername(raw)) return res.json({ available: false, error: 'That username is reserved' });
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

    if (accentColor !== undefined && !isHexColor(accentColor)) {
      return res.status(400).json({ error: 'accentColor must be a #RRGGBB hex color' });
    }

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
      if (isReservedUsername(normalized)) return res.status(400).json({ error: 'That username is reserved' });
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
//
// Order matters and every step is idempotent, so a client can simply retry:
//   1. purge bucket objects (keys come from rows that step 2 destroys)
//   2. delete the user row (cascades to cards/contacts/etc.)
//   3. delete the Clerk identity — only when the client opts in with
//      `x-linkd-delete-identity: server`. Older builds delete the Clerk user
//      themselves right after this call; deleting it here first would make
//      that call fail and show them an error for an account that is gone.
router.delete('/me', async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    await purgeUserAssets(userId);
    await db.delete(users).where(eq(users.id, userId));
    evictSyncedUser(userId);

    if (req.headers['x-linkd-delete-identity'] === 'server') {
      try {
        await ((req as any).clerkClient ?? clerk).users.deleteUser(userId);
      } catch (err: any) {
        // Already gone is fine (retry after a partial run)
        if (err?.status !== 404) {
          console.error(`Clerk deleteUser(${userId}) failed:`, err?.message ?? err);
          return res.status(502).json({ error: 'Could not finish deleting your sign-in. Please try again.' });
        }
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error(`Account deletion failed for ${userId}:`, err?.message ?? err);
    res.status(500).json({ error: 'Could not delete your account right now. Please try again.' });
  }
});

export default router;
