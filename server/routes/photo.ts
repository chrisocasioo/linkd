import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';

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

router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { photo: base64, mimeType = 'image/jpeg' } = req.body;
    if (!base64) return res.status(400).json({ error: 'No photo provided' });

    const buffer = Buffer.from(base64, 'base64');
    const bucket = process.env.BUCKET_NAME ?? process.env.BUCKET ?? '';
    const key = `profiles/${userId}.jpg`;
    console.log(`[photo] uploading to bucket="${bucket}" key="${key}" endpoint="${process.env.AWS_ENDPOINT_URL_S3 ?? process.env.ENDPOINT}"`);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    console.log(`[photo] upload success for ${userId}`);

    const base = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : (process.env.SERVER_URL ?? '');
    const photoUrl = `${base}/api/photos/${userId}?v=${Date.now()}`;
    await db.update(users).set({ profilePhoto: photoUrl }).where(eq(users.id, userId));
    res.json({ photoUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
