// QR logos are drawn into a ~32–44pt square. The phone shrinks whatever it is
// given with a cheap resample, so a full-size photo (1000+ px) comes out
// jagged. Pre-shrinking once, with a proper filter, to a size that still
// covers a 3x screen at the largest slot (44pt ≈ 132px; 256px leaves margin)
// keeps the downscale on the device tiny and the edges clean.
const LOGO_PX = 256;

export type LogoResult =
  | { ok: true; buffer: Buffer; contentType: string | null } // null = stored as uploaded
  | { ok: false };                                             // not a readable image

/**
 * Center-crops to a LOGO_PX square PNG (alpha kept, EXIF rotation honoured).
 *
 * sharp is loaded lazily, inside the function, and any failure to load or run
 * it falls back to storing the upload untouched: an image-library problem can
 * only cost the sharpening, never the server (a top-level import of sharp
 * once crashed the whole API on boot when the host ran an unsupported Node).
 * A file sharp loads but cannot decode is reported as not-an-image.
 */
export async function normalizeQrLogo(input: Buffer): Promise<LogoResult> {
  let sharp: typeof import('sharp').default;
  try {
    sharp = (await import('sharp')).default;
  } catch (err: any) {
    console.error('sharp unavailable, storing logo unprocessed:', err?.message ?? err);
    return { ok: true, buffer: input, contentType: null };
  }
  try {
    const buffer = await sharp(input, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate()
      .resize(LOGO_PX, LOGO_PX, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { ok: true, buffer, contentType: 'image/png' };
  } catch {
    return { ok: false };
  }
}
