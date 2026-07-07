import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { savedQrs } from '../db/schema';

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

router.get('/', async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const qrs = await db.query.savedQrs.findMany({
      where: eq(savedQrs.userId, userId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    res.json(qrs);
  } catch (err: any) {
    console.error('QR fetch failed:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

router.post('/', async (req, res) => {
  const userId = (req as any).userId as string;
  const { type, label, data, color, bgColor } = req.body as {
    type?: string;
    label?: string;
    data?: string;
    color?: string;
    bgColor?: string;
  };

  if (!type || !data) {
    return res.status(400).json({ error: 'type and data are required' });
  }

  try {
    const [qr] = await db
      .insert(savedQrs)
      .values({ userId, type, label: label ?? null, data, color: color ?? null, bgColor: bgColor ?? null })
      .returning();
    res.status(201).json(qr);
  } catch (err: any) {
    console.error('QR insert failed:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to save QR code', detail: err?.message ?? String(err) });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const { type, label, data, color, bgColor, logo } = req.body as {
      type?: string;
      label?: string;
      data?: string;
      color?: string | null;
      bgColor?: string | null;
      logo?: string | null;
    };
    const update: Partial<typeof savedQrs.$inferInsert> = {};
    if (type !== undefined) update.type = type;
    if (label !== undefined) update.label = label;
    if (data !== undefined) update.data = data;
    if (color !== undefined) update.color = color;
    if (bgColor !== undefined) update.bgColor = bgColor;
    if (logo !== undefined) update.logo = logo;

    const [updated] = await db
      .update(savedQrs)
      .set(update)
      .where(and(eq(savedQrs.id, id), eq(savedQrs.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'QR code not found' });
    res.json(updated);
  } catch (err: any) {
    console.error('QR update failed:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to update QR code' });
  }
});

router.post('/:id/logo', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { id: qrId } = req.params;
    const qr = await db.query.savedQrs.findFirst({ where: and(eq(savedQrs.id, qrId), eq(savedQrs.userId, userId)) });
    if (!qr) return res.status(404).json({ error: 'QR code not found' });

    const { photo: base64, mimeType = 'image/jpeg' } = req.body as { photo?: string; mimeType?: string };
    if (!base64) return res.status(400).json({ error: 'No photo provided' });

    const buffer = Buffer.from(base64, 'base64');
    const bucket = process.env.BUCKET_NAME ?? process.env.BUCKET ?? '';
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `qrs/${qrId}-logo.jpg`,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const base = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : (process.env.SERVER_URL ?? '');
    const logoUrl = `${base}/api/photos/qr/${qrId}/logo?v=${Date.now()}`;
    await db.update(savedQrs).set({ logo: logoUrl }).where(eq(savedQrs.id, qrId));
    res.json({ logoUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  try {
    await db
      .delete(savedQrs)
      .where(and(eq(savedQrs.id, id), eq(savedQrs.userId, userId)));
    res.json({ success: true });
  } catch (err: any) {
    console.error('QR delete failed:', err?.message ?? err);
    res.status(500).json({ error: 'Failed to delete QR code' });
  }
});

export default router;
