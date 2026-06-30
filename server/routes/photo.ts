import { v2 as cloudinary } from 'cloudinary';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import { db } from '../db';
import { users } from '../db/schema';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'linkd/profiles',
          public_id: userId,
          overwrite: true,
          transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      Readable.from(req.file!.buffer).pipe(stream);
    });

    await db.update(users).set({ profilePhoto: result.secure_url }).where(eq(users.id, userId));
    res.json({ photoUrl: result.secure_url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
