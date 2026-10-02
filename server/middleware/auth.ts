import { createClerkClient, verifyToken } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { db } from '../db';
import { users } from '../db/schema';

export const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? '' });

// During the move from Clerk's development instance to production, the build
// in the App Store still signs users in against the OLD instance, so tokens
// from both must verify until that build is retired. Set
// CLERK_SECRET_KEY_LEGACY to the old instance's secret key to enable it;
// unset, behaviour is unchanged. User ids differ per instance, so rows never
// collide. Remove once the old build is gone.
const LEGACY_KEY = process.env.CLERK_SECRET_KEY_LEGACY ?? '';
const clerkLegacy = LEGACY_KEY ? createClerkClient({ secretKey: LEGACY_KEY }) : null;

// The Clerk profile sync is first-login bootstrap work; paying a Clerk API
// round-trip + two DB writes on every request made the whole app feel slow.
const syncedUsers = new Set<string>();

/** Forget a user so their next request re-runs the bootstrap insert. Called
 *  after account deletion: the Clerk JWT can still verify afterwards, and a
 *  stale entry here would skip re-creating the row (404/FK errors until the
 *  process restarts). */
export const evictSyncedUser = (userId: string) => { syncedUsers.delete(userId); };

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    // Whichever instance issued the token is also the one that knows the user,
    // so remember its client for the profile lookup / deletion below.
    let payload: Awaited<ReturnType<typeof verifyToken>>;
    let tokenClerk = clerk;
    try {
      payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY ?? '' });
    } catch (err) {
      if (!LEGACY_KEY || !clerkLegacy) throw err;
      payload = await verifyToken(token, { secretKey: LEGACY_KEY });
      tokenClerk = clerkLegacy;
    }
    const userId = payload.sub;
    (req as any).userId = userId;
    (req as any).clerkClient = tokenClerk;

    if (!syncedUsers.has(userId)) {
      // Fetch the Clerk profile first: a JWT can outlive its account (deleted
      // in-app or from the Clerk dashboard), and creating a row for a user
      // Clerk no longer has would resurrect an empty ghost account.
      let clerkUser: Awaited<ReturnType<typeof clerk.users.getUser>> | null = null;
      try {
        clerkUser = await tokenClerk.users.getUser(userId);
      } catch (err: any) {
        if (err?.status === 404) return res.status(401).json({ error: 'Account no longer exists' });
        // Any other failure (Clerk outage, network): carry on with a
        // placeholder row so the app still works, and retry the sync on the
        // next request.
      }

      const email = clerkUser?.emailAddresses[0]?.emailAddress ?? '';
      const displayName = clerkUser
        ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null
        : null;

      await db
        .insert(users)
        .values({ id: userId, email: email || `${userId}@placeholder.local`, displayName })
        .onConflictDoNothing();

      if (email) {
        // Fill displayName from Clerk only if the user hasn't set their own
        const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
        await db.update(users)
          .set(row?.displayName ? { email } : { email, displayName })
          .where(eq(users.id, userId));
        // Only remember the user once the real profile landed — otherwise a
        // transient Clerk failure would leave the placeholder email on the
        // row for the life of the process.
        syncedUsers.add(userId);
      }
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
