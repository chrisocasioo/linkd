import { eq } from 'drizzle-orm';
import cors from 'cors';
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { Webhook } from 'svix';
import { db } from './db';
import { users } from './db/schema';
import { runMigrations } from './db/migrate';
import { clerk, evictSyncedUser, requireAuth } from './middleware/auth';
import analyticsRouter from './routes/analytics';
import cardsRouter from './routes/cards';
import contactsRouter from './routes/contacts';
import linksRouter from './routes/links';
import passRouter from './routes/pass';
import photoRouter from './routes/photo';
import photoServeRouter from './routes/photoServe';
import publicRouter from './routes/public';
import qrsRouter from './routes/qrs';
import revenuecatRouter from './routes/revenuecat';
import scanHistoryRouter from './routes/scanHistory';
import usersRouter from './routes/users';
import { purgeUserAssets } from './util/purgeUserAssets';

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
    if (!webhookSecret) {
      console.error('Clerk webhook rejected: CLERK_WEBHOOK_SECRET is not set');
      return res.status(503).json({ error: 'Webhook not configured' });
    }
    const headers = {
      'svix-id': req.headers['svix-id'] as string,
      'svix-timestamp': req.headers['svix-timestamp'] as string,
      'svix-signature': req.headers['svix-signature'] as string,
    };
    // The old (development) Clerk instance keeps posting here with its own
    // signing secret until it is retired — accept either.
    const secrets = [webhookSecret, process.env.CLERK_WEBHOOK_SECRET_LEGACY ?? ''].filter(Boolean);
    let event: any;
    for (const secret of secrets) {
      try {
        event = new Webhook(secret).verify(req.body, headers);
        break;
      } catch {}
    }
    if (!event) return res.status(400).json({ error: 'Invalid webhook signature' });

    // Express 4 doesn't catch async throws — without this a DB/S3 error left
    // the request hanging and Clerk saw a timeout instead of a retryable 5xx.
    try {
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
        // Deleting from the Clerk dashboard/API lands here rather than in
        // DELETE /api/users/me — purge the bucket too (before the row goes,
        // since the keys are derived from it) or every photo is orphaned.
        if (id) {
          await purgeUserAssets(id);
          await db.delete(users).where(eq(users.id, id));
          evictSyncedUser(id);
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error(`Clerk webhook ${event?.type} failed:`, err?.message ?? err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
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

// 6d. Saved QR codes (Scans tab generator)
app.use('/api/qrs', requireAuth, qrsRouter);

// 6e. Scan history (Scans tab — contact scans + QR reads)
app.use('/api/scan-history', requireAuth, scanHistoryRouter);

// 7. Analytics routes (POST /view is public; GET /me applies requireAuth internally)
app.use('/api/analytics', analyticsRouter);

// 7b. Marketing + legal pages on the brand domain (Google's OAuth consent screen
// and Apple require a homepage and privacy policy on a domain we control).
// Explicit file list only — before the public card catch-all so /privacy etc.
// can't be read as usernames.
const STATIC_DIR = path.join(__dirname, 'static');
const sendPage = (file: string) => (_req: Request, res: Response) => res.sendFile(path.join(STATIC_DIR, file));
app.get('/', sendPage('index.html'));
app.get(['/privacy', '/privacy.html'], sendPage('privacy.html'));
app.get(['/support', '/support.html'], sendPage('support.html'));
app.get('/icon.png', sendPage('icon.png'));

// 8. Apple Wallet passes — must precede the public catch-all (/:username/:slug)
app.use('/', passRouter);

// 9. Public card pages — catch-all, must be last
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
