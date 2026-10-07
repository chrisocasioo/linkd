import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { cards, contacts, savedQrs } from '../db/schema';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'auto',
  endpoint: process.env.AWS_ENDPOINT_URL_S3 ?? process.env.ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? process.env.ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? process.env.SECRET_ACCESS_KEY ?? '',
  },
  forcePathStyle: true,
});

/**
 * Deletes every object this user has in the bucket. Must run BEFORE the user
 * row is deleted: the keys are derived from the rows that cascade away with
 * it, so afterwards there is no index left to find the objects by.
 *
 * Returns the keys that failed to delete. Throws only when EVERY delete failed
 * (bucket unreachable / bad credentials) so callers can abort before
 * destroying the rows — individual stragglers are logged and returned.
 */
export async function purgeUserAssets(userId: string): Promise<string[]> {
  const bucket = process.env.BUCKET_NAME ?? process.env.BUCKET ?? '';

  const [userCards, userContacts, userSavedQrs] = await Promise.all([
    db.select({ id: cards.id }).from(cards).where(eq(cards.userId, userId)),
    db.select({ id: contacts.id }).from(contacts).where(eq(contacts.userId, userId)),
    db.select({ id: savedQrs.id }).from(savedQrs).where(eq(savedQrs.userId, userId)),
  ]);

  const keys = [
    `profiles/${userId}.jpg`,
    ...userCards.flatMap((c) => [`cards/${c.id}.jpg`, `cards/${c.id}-qr-logo.jpg`]),
    ...userContacts.map((c) => `contacts/${c.id}.jpg`),
    ...userSavedQrs.map((q) => `qrs/${q.id}-logo.jpg`),
  ];

  const results = await Promise.all(
    keys.map((Key) =>
      s3
        .send(new DeleteObjectCommand({ Bucket: bucket, Key }))
        .then(() => null)
        .catch((err: any) => ({ key: Key, error: err?.message ?? String(err) }))
    )
  );
  const failures = results.filter((r): r is { key: string; error: string } => r !== null);

  if (failures.length) {
    console.error(`purgeUserAssets(${userId}): ${failures.length}/${keys.length} deletes failed`, failures.slice(0, 5));
  }
  if (failures.length === keys.length) {
    throw new Error('Could not reach file storage to delete this account’s photos');
  }
  return failures.map((f) => f.key);
}

/** Copies one user's profile photo object to another user id (best effort). */
export async function copyProfilePhoto(fromUserId: string, toUserId: string): Promise<boolean> {
  const bucket = process.env.BUCKET_NAME ?? process.env.BUCKET ?? '';
  try {
    await s3.send(new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/profiles/${fromUserId}.jpg`,
      Key: `profiles/${toUserId}.jpg`,
    }));
    return true;
  } catch {
    return false;
  }
}

/** Reads one bucket object into memory; null if it doesn't exist or can't be read. */
export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  const bucket = process.env.BUCKET_NAME ?? process.env.BUCKET ?? '';
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await out.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch {
    return null;
  }
}
