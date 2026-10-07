import { getObjectBuffer } from './purgeUserAssets';

const CONTACT_PHOTO_PX = 400;

/**
 * The picture that goes into a downloaded vCard: the card's own photo, else the
 * owner's profile photo. Contacts apps ignore remote PHOTO URLs, so the image
 * has to be embedded as base64. Shrunk to a modest square JPEG to keep the
 * .vcf small; if sharp can't load, the original bytes are embedded instead
 * (same lazy-load safety as the QR logo path). Returns null if neither exists.
 */
export async function contactPhotoBase64(cardId: string | undefined, userId: string): Promise<string | null> {
  let raw: Buffer | null = null;
  if (cardId) raw = await getObjectBuffer(`cards/${cardId}.jpg`);
  if (!raw) raw = await getObjectBuffer(`profiles/${userId}.jpg`);
  if (!raw) return null;
  try {
    const sharp = (await import('sharp')).default;
    const out = await sharp(raw, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate()
      .resize(CONTACT_PHOTO_PX, CONTACT_PHOTO_PX, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82 })
      .toBuffer();
    return out.toString('base64');
  } catch {
    return raw.length <= 300_000 ? raw.toString('base64') : null;
  }
}

/** vCard 3.0 line folding: lines over 75 octets continue on a CRLF + space. */
export function foldVcardLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(' ' + line.slice(i, i + 74));
  return parts.join('\r\n');
}
