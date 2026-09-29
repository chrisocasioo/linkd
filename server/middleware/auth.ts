import { createClerkClient, verifyToken } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { db } from '../db';
import { users } from '../db/schema';

export const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? '' });

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
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY ?? '' });
    const userId = payload.sub;
    (req as any).userId = userId;

    if (!syncedUsers.has(userId)) {
      // Fetch the Clerk profile first: a JWT can outlive its account (deleted
      // in-app or from the Clerk dashboard), and creating a row for a user
      // Clerk no longer has would resurrect an empty ghost account.
      let clerkUser: Awaited<ReturnType<typeof clerk.users.getUser>> | null = null;
      try {
        clerkUser = await clerk.users.getUser(userId);
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
