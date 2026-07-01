import { eq } from 'drizzle-orm';
import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { Webhook } from 'svix';
import { db } from './db';
import { users } from './db/schema';
import { runMigrations } from './db/migrate';
import { clerk, requireAuth } from './middleware/auth';
import analyticsRouter from './routes/analytics';
import cardsRouter from './routes/cards';
import contactsRouter from './routes/contacts';
import linksRouter from './routes/links';
import photoRouter from './routes/photo';
import photoServeRouter from './routes/photoServe';
import publicRouter from './routes/public';
import revenuecatRouter from './routes/revenuecat';
import usersRouter from './routes/users';

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled rejection:', reason?.message ?? reason);
});

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 1. Clerk webhook — raw body, no auth
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

// 2. RevenueCat webhook — raw body, no auth (signature verified inside router)
app.use('/api/revenuecat/webhook', express.raw({ type: 'application/json' }), revenuecatRouter);

// 3. JSON body parser for all other routes
app.use(express.json({ limit: '20mb' }));

// 4a. Public photo proxy — no auth, before JSON parser
app.use('/api/photos', photoServeRouter);

// 4b. Photo upload — must be before generic /api/users mount (multer handles its own body parsing)
app.use('/api/users/me/photo', requireAuth, photoRouter);

// 5. User routes
app.use('/api/users', requireAuth, usersRouter);

// 6. Link routes
app.use('/api/links', requireAuth, linksRouter);

// 6b. Card routes (new multi-card system)
app.use('/api/cards', requireAuth, cardsRouter);

// 6c. Contacts routes
app.use('/api/contacts', requireAuth, contactsRouter);

// 7. Analytics routes (POST /view is public; GET /me applies requireAuth internally)
app.use('/api/analytics', analyticsRouter);

// 8. Public card pages — catch-all, must be last
app.use('/', publicRouter);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Express error:', err?.message ?? err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message ?? 'Internal server error' });
  }
});

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
