import { asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import fs from 'fs';
import Jimp from 'jimp';
import path from 'path';
import { PKPass } from 'passkit-generator';
import { db } from '../db';
import { cardFields, cards, users } from '../db/schema';

const router = Router();

const PASS_TYPE_ID = process.env.PASS_TYPE_ID ?? 'pass.com.santrico.linkd';
const PASS_TEAM_ID = process.env.PASS_TEAM_ID ?? 'GQ725BQR6F';
const SHARE_BASE = process.env.SHARE_BASE ?? 'linkd-production-fdce.up.railway.app';

const ASSETS_DIR = path.join(__dirname, '..', 'pass-assets');
const WWDR_PATH = path.join(__dirname, '..', 'certs', 'wwdr-g4.pem');

function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'rgb(201, 168, 76)';
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// Banner strip across the top of the pass (like the in-app card's banner):
// the profile photo cover-cropped and dimmed for text legibility, or a solid
// accent block when there's no photo. Wallet wants 375x123pt at 1x/2x/3x.
const STRIP_W = 375;
const STRIP_H = 123;

async function buildStripImages(photoUrl: string | null, accentHex: string): Promise<Record<string, Buffer>> {
  let base: Jimp | null = null;
  if (photoUrl && /^https?:\/\//.test(photoUrl)) {
    try {
      const resp = await (globalThis as any).fetch(photoUrl);
      if (resp.ok) {
        base = await Jimp.read(Buffer.from(await resp.arrayBuffer()));
      }
    } catch {}
  }
  const m = /^#?([0-9a-f]{6})$/i.exec(accentHex.trim());
  // >>> 0 must come last: bitwise ops re-sign to int32, and Jimp needs uint32
  const accentNum = ((parseInt(m ? m[1] : 'C9A84C', 16) << 8) | 0xff) >>> 0;

  const out: Record<string, Buffer> = {};
  for (const [name, scale] of [['strip.png', 1], ['strip@2x.png', 2], ['strip@3x.png', 3]] as const) {
    const img = base
      ? base.clone().cover(STRIP_W * scale, STRIP_H * scale).brightness(-0.25)
      : new Jimp(STRIP_W * scale, STRIP_H * scale, accentNum);
    out[name] = await img.getBufferAsync(Jimp.MIME_PNG);
  }
  return out;
}


// Env values arrive via copy-paste; strip any whitespace/newlines picked up on the way
function cleanB64(v: string | undefined): string | null {
  const s = (v ?? '').replace(/\s+/g, '');
  return s.length > 0 ? s : null;
}

// Signing-config self check — reports parse/pair status, no secrets in the response
router.get('/pass/health', (_req, res) => {
  const certB64 = cleanB64(process.env.PASS_CERT_PEM_BASE64);
  const keyB64 = cleanB64(process.env.PASS_KEY_PEM_BASE64);
  const out: Record<string, unknown> = {
    certPresent: !!certB64,
    keyPresent: !!keyB64,
    certParses: false,
    keyParses: false,
    pairMatches: false,
    assetsPresent: fs.existsSync(path.join(ASSETS_DIR, 'icon.png')),
    wwdrPresent: fs.existsSync(WWDR_PATH),
  };
  try {
    const crypto = require('crypto');
    let key: any = null;
    if (keyB64) {
      try {
        key = crypto.createPrivateKey(Buffer.from(keyB64, 'base64'));
        out.keyParses = true;
      } catch (e: any) {
        out.keyError = e?.message ?? String(e);
      }
    }
    if (certB64) {
      const cert = new crypto.X509Certificate(Buffer.from(certB64, 'base64'));
      out.certParses = true;
      out.certSubject = cert.subject.split('\n').pop();
      out.certValidTo = cert.validTo;
      if (key) out.pairMatches = cert.checkPrivateKey(key);
    }
  } catch (err: any) {
    out.error = err?.message ?? String(err);
  }
  res.json(out);
});

// Signed .pkpass for a card — opening this URL in Safari shows the native
// "Add to Apple Wallet" sheet. Public, like the card page itself.
router.get('/pass/:cardId', async (req, res) => {
  try {
    const certB64 = cleanB64(process.env.PASS_CERT_PEM_BASE64);
    const keyB64 = cleanB64(process.env.PASS_KEY_PEM_BASE64);
    if (!certB64 || !keyB64) {
      return res.status(503).send('Wallet passes are not configured');
    }

    const card = await db.query.cards.findFirst({ where: eq(cards.id, req.params.cardId) });
    if (!card) return res.status(404).send('Card not found');
    const user = await db.query.users.findFirst({ where: eq(users.id, card.userId) });
    if (!user?.username) return res.status(404).send('Card not found');

    const fields = await db
      .select()
      .from(cardFields)
      .where(eq(cardFields.cardId, card.id))
      .orderBy(asc(cardFields.displayOrder));

    const displayName = user.displayName ?? user.username;
    const title = fields.find((f) => f.type === 'title')?.value;
    const company = fields.find((f) => f.type === 'company')?.value;
    const publicUrl = card.slug
      ? `https://${SHARE_BASE}/${user.username}/${card.slug}`
      : `https://${SHARE_BASE}/${user.username}`;

    const secondaryFields: Array<{ key: string; label: string; value: string }> = [];
    if (title) secondaryFields.push({ key: 'title', label: 'TITLE', value: title });
    if (company) secondaryFields.push({ key: 'company', label: 'COMPANY', value: company });

    // Contact row under title/company — fills the fixed gap above the QR
    // (Apple pins barcode size/position; content is the only lever)
    const email = fields.find((f) => f.type === 'email')?.value;
    const phone = fields.find((f) => f.type === 'phone')?.value;
    const website = fields.find((f) => f.type === 'website')?.value;
    const auxiliaryFields: Array<{ key: string; label: string; value: string }> = [];
    if (email) auxiliaryFields.push({ key: 'email', label: 'EMAIL', value: email });
    if (phone) auxiliaryFields.push({ key: 'phone', label: 'PHONE', value: phone });
    if (auxiliaryFields.length < 2 && website) {
      auxiliaryFields.push({ key: 'website', label: 'WEBSITE', value: website });
    }

    const accent = card.accentColor ?? '#C9A84C';
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: PASS_TEAM_ID,
      serialNumber: card.id,
      organizationName: 'Linkd',
      description: `${displayName} — digital business card`,
      logoText: 'Linkd',
      // Match the in-app card design: charcoal card, white text, accent labels
      backgroundColor: 'rgb(22, 22, 22)',
      foregroundColor: 'rgb(255, 255, 255)',
      labelColor: hexToRgb(accent),
      // storeCard style: name renders on the banner strip, secondary +
      // auxiliary merge into one row beneath it — fills the dead zone the
      // generic layout left above the QR
      storeCard: {
        headerFields: [{ key: 'cardName', value: card.name.toUpperCase() }],
        primaryFields: [{ key: 'name', value: displayName }],
        secondaryFields,
        auxiliaryFields,
      },
      barcodes: [
        {
          format: 'PKBarcodeFormatQR',
          message: publicUrl,
          messageEncoding: 'iso-8859-1',
        },
      ],
    };

    const files: Record<string, Buffer> = {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
    };
    // icon.png set is required by Wallet (notifications/previews only, never the
    // pass face). No logo.png: the squished app icon next to the wordmark made
    // the top row feel cramped — logoText alone renders cleaner.
    for (const asset of ['icon.png', 'icon@2x.png', 'icon@3x.png']) {
      files[asset] = fs.readFileSync(path.join(ASSETS_DIR, asset));
    }
    Object.assign(files, await buildStripImages(user.profilePhoto ?? null, accent));

    const pass = new PKPass(files, {
      wwdr: fs.readFileSync(WWDR_PATH),
      signerCert: Buffer.from(certB64, 'base64'),
      signerKey: Buffer.from(keyB64, 'base64'),
    });

    const buffer = pass.getAsBuffer();
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename="${user.username}-linkd.pkpass"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('pkpass error:', err?.message ?? err);
    res.status(500).send(`Could not generate pass: ${err?.message ?? 'unknown error'}`);
  }
});

export default router;
