import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { contacts } from '../db/schema';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'auto',
  endpoint: process.env.AWS_ENDPOINT_URL_S3 ?? process.env.ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? process.env.ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? process.env.SECRET_ACCESS_KEY ?? '',
  },
  forcePathStyle: true,
});

const router = Router();

const VALID_SOURCES = new Set(['manual', 'scan', 'card']);

// GET / — list all contacts for the authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .orderBy(desc(contacts.createdAt));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — save a confirmed contact
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { firstName, lastName, email, phone, fax, company, jobTitle, website, address, notes, source } = req.body;
    const [created] = await db
      .insert(contacts)
      .values({
        userId, firstName, lastName, email, phone, fax, company, jobTitle, website, address, notes,
        source: VALID_SOURCES.has(source) ? source : 'manual',
      })
      .returning();
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id — update contact fields
router.patch('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const { firstName, lastName, email, phone, fax, company, jobTitle, website, address, notes } = req.body;
    const [updated] = await db
      .update(contacts)
      .set({ firstName, lastName, email, phone, fax, company, jobTitle, website, address, notes })
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/photo — attach a cropped photo of the scanned business card
router.post('/:id/photo', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const contact = await db.query.contacts.findFirst({ where: and(eq(contacts.id, id), eq(contacts.userId, userId)) });
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const { photo: base64, mimeType = 'image/jpeg' } = req.body as { photo?: string; mimeType?: string };
    if (!base64) return res.status(400).json({ error: 'No photo provided' });

    const buffer = Buffer.from(base64, 'base64');
    const bucket = process.env.BUCKET_NAME ?? process.env.BUCKET ?? '';
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `contacts/${id}.jpg`,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const base = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : (process.env.SERVER_URL ?? '');
    const photoUrl = `${base}/api/photos/contact/${id}?v=${Date.now()}`;
    await db.update(contacts).set({ photo: photoUrl }).where(eq(contacts.id, id));
    res.json({ photoUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const [deleted] = await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning();
    if (!deleted || deleted.userId !== userId) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
