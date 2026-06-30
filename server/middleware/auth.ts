import { createClerkClient, verifyToken } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import { NextFunction, Request, Response } from 'express';
import { db } from '../db';
import { users } from '../db/schema';

export const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? '' });

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

    await db
      .insert(users)
      .values({ id: userId, email: `${userId}@placeholder.local`, displayName: null })
      .onConflictDoNothing();
    try {
      const clerkUser = await clerk.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
      const displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;
      if (email) await db.update(users).set({ email, displayName }).where(eq(users.id, userId));
    } catch {}

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
