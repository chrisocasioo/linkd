import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { promises as fs } from 'fs';
import multer from 'multer';
import path from 'path';
import { db } from '../db';
import { users } from '../db/schema';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/data';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const dir = path.join(UPLOAD_DIR, 'profiles');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${userId}.jpg`), req.file.buffer);

    const base = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${process.env.PORT ?? 3000}`;

    const photoUrl = `${base}/photos/profiles/${userId}.jpg?v=${Date.now()}`;
    await db.update(users).set({ profilePhoto: photoUrl }).where(eq(users.id, userId));
    res.json({ photoUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
