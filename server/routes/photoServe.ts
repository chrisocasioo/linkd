import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Router } from 'express';
import { Readable } from 'stream';

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

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const key = `profiles/${userId}.jpg`;

    const result = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME ?? process.env.BUCKET ?? '',
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
