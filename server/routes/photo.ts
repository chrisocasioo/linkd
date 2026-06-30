import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import multer from 'multer';
import { db } from '../db';
import { users } from '../db/schema';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const key = `profiles/${userId}.jpg`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME ?? '',
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    // Cache-buster so the app sees the updated photo immediately after re-upload
    const photoUrl = `${process.env.R2_PUBLIC_URL}/${key}?v=${Date.now()}`;
    await db.update(users).set({ profilePhoto: photoUrl }).where(eq(users.id, userId));
    res.json({ photoUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
