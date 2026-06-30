import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Router } from 'express';
import { Readable } from 'stream';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.ENDPOINT,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.SECRET_ACCESS_KEY ?? '',
  },
  forcePathStyle: true,
});

const router = Router();

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const key = `profiles/${userId}.jpg`;

    const result = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET ?? '',
        Key: key,
      })
    );

    res.setHeader('Content-Type', result.ContentType ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=60');

    if (result.Body instanceof Readable) {
      result.Body.pipe(res);
    } else {
      const stream = result.Body as any;
      Readable.from(stream).pipe(res);
    }
  } catch (err: any) {
    res.status(404).json({ error: 'Photo not found' });
  }
});

export default router;
