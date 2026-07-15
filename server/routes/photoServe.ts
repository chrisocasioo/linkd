import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Router } from 'express';
import type { Response } from 'express';

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

// Railway's managed buckets are private-only (no public-read ACL, no public
// bucket URL), so a request still has to pass through this server — but
// only to mint a short-lived signed URL, not to stream the image bytes
// themselves. The 302 target is fetched by the client directly from the
// bucket, which is the documented Railway pattern for avoiding app-service
// egress cost on file downloads.
//
// The redirect response itself must never be cached — the Location is a
// signed URL that stops working after `expiresIn`, so a long-lived cache
// entry here would eventually redirect to a dead link. (Contrast with the
// old direct-stream version, which could cache forever since the bytes
// never changed for a given ?v= — that guarantee doesn't help here because
// it's the *redirect*, not the image, that a cache would be storing.)
async function redirectToObject(res: Response, key: string): Promise<void> {
  try {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.BUCKET_NAME ?? process.env.BUCKET ?? '', Key: key }),
      { expiresIn: 3600 }
    );
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
  } catch (err: any) {
    res.status(404).json({ error: 'Photo not found' });
  }
}

// Must precede /card/:cardId and /:userId, or its segments get swallowed
router.get('/card/:cardId/qr-logo', (req, res) => redirectToObject(res, `cards/${req.params.cardId}-qr-logo.jpg`));

router.get('/qr/:qrId/logo', (req, res) => redirectToObject(res, `qrs/${req.params.qrId}-logo.jpg`));

router.get('/contact/:contactId', (req, res) => redirectToObject(res, `contacts/${req.params.contactId}.jpg`));

// Must precede /:userId or "card" gets captured as a userId
router.get('/card/:cardId', (req, res) => redirectToObject(res, `cards/${req.params.cardId}.jpg`));

router.get('/:userId', (req, res) => redirectToObject(res, `profiles/${req.params.userId}.jpg`));

export default router;
