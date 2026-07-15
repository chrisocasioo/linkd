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

// Every photoUrl/logoUrl the app hands out embeds a `?v=<upload timestamp>`
// cache-buster (see cards.ts, qrs.ts, photo.ts, contacts.ts) that changes on
// every re-upload, so the bytes behind any given URL never change — safe to
// cache for as long as clients/CDNs want.

// Must precede /card/:cardId and /:userId, or its segments get swallowed
router.get('/card/:cardId/qr-logo', async (req, res) => {
  try {
    const { cardId } = req.params;
    const key = `cards/${cardId}-qr-logo.jpg`;

    const result = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME ?? process.env.BUCKET ?? '',
        Key: key,
      })
    );

    res.setHeader('Content-Type', result.ContentType ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

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

router.get('/qr/:qrId/logo', async (req, res) => {
  try {
    const { qrId } = req.params;
    const key = `qrs/${qrId}-logo.jpg`;

    const result = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME ?? process.env.BUCKET ?? '',
        Key: key,
      })
    );

    res.setHeader('Content-Type', result.ContentType ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

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

router.get('/contact/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const key = `contacts/${contactId}.jpg`;

    const result = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME ?? process.env.BUCKET ?? '',
        Key: key,
      })
    );

    res.setHeader('Content-Type', result.ContentType ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

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

// Must precede /:userId or "card" gets captured as a userId
router.get('/card/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const key = `cards/${cardId}.jpg`;

    const result = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME ?? process.env.BUCKET ?? '',
        Key: key,
      })
    );

    res.setHeader('Content-Type', result.ContentType ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

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
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

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
