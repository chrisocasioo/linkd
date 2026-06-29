import { createClerkClient, verifyToken } from '@clerk/backend';
import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { Webhook } from 'svix';
import { db } from './db';
import { savedQrs, users } from './db/schema';
import { runMigrations } from './db/migrate';
import qrsRouter from './routes/qrs';
import usersRouter from './routes/users';

const app = express();
const PORT = process.env.PORT ?? 3000;
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? '' });

app.use(cors());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Clerk webhook — raw body needed for signature verification, no auth required
app.post(
  '/api/users/sync',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET ?? '';
    const wh = new Webhook(webhookSecret);
    const headers = {
      'svix-id': req.headers['svix-id'] as string,
      'svix-timestamp': req.headers['svix-timestamp'] as string,
      'svix-signature': req.headers['svix-signature'] as string,
    };
    let event: any;
    try {
      event = wh.verify(req.body, headers);
    } catch {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    if (event.type === 'user.created') {
      const { id, email_addresses, first_name, last_name } = event.data;
      const email = email_addresses?.[0]?.email_address ?? '';
      const displayName = [first_name, last_name].filter(Boolean).join(' ') || null;
      await db.insert(users).values({ id, email, displayName }).onConflictDoNothing();
    }

    if (event.type === 'user.updated') {
      const { id, email_addresses, first_name, last_name } = event.data;
      const email = email_addresses?.[0]?.email_address ?? '';
      const displayName = [first_name, last_name].filter(Boolean).join(' ') || null;
      await db.update(users).set({ email, displayName, updatedAt: new Date() }).where(eq(users.id, id));
    }

    if (event.type === 'user.deleted') {
      const { id } = event.data;
      await db.delete(users).where(eq(users.id, id));
    }

    res.json({ success: true });
  }
);

app.use(express.json());

// JWT auth middleware for all other /api/* routes
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY ?? '' });
    const userId = payload.sub;
    (req as any).userId = userId;

    // Ensure user row exists so FK constraints are satisfied.
    // Insert with placeholder values first (always works), then enrich from Clerk API.
    await db.insert(users).values({ id: userId, email: '', displayName: null }).onConflictDoNothing();
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

app.use('/api/users', requireAuth, usersRouter);
app.use('/api/qrs', requireAuth, qrsRouter);

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Linkd server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
