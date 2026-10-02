import sharp from 'sharp';

// QR logos are drawn into a ~32–44pt square. The phone shrinks whatever it is
// given with a cheap resample, so a full-size photo (1000+ px) comes out
// jagged. Pre-shrinking once, with a proper filter, to a size that still
// covers a 3x screen at the largest slot (44pt ≈ 132px, 256px leaves margin)
// keeps the downscale on the device tiny and the edges clean.
const LOGO_PX = 256;

/** Returns a LOGO_PX square PNG (alpha preserved), center-cropped to fill the
 *  square — the same crop the QR renderer applies — or throws if the bytes
 *  aren't a decodable image. */
export async function normalizeQrLogo(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: 'error', limitInputPixels: 50_000_000 })
    .rotate() // honour EXIF orientation before cropping
    .resize(LOGO_PX, LOGO_PX, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
