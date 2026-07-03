import { asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { PKPass } from 'passkit-generator';
import { db } from '../db';
import { cardFields, cards, users } from '../db/schema';
import { formatPhone } from '../util/format';

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

    // Grid: TITLE | PHONE on the top row, COMPANY | EMAIL below. Putting the
    // long email next to the (usually short) company keeps Wallet from
    // shrinking the row's font, which it did when email and phone shared a
    // line. Right column pinned flush to the pass edge so the rows line up.
    const RIGHT = 'PKTextAlignmentRight';
    type PassField = { key: string; label: string; value: string; textAlignment?: string };
    const email = fields.find((f) => f.type === 'email')?.value;
    const rawPhone = fields.find((f) => f.type === 'phone')?.value;
    const phone = rawPhone ? formatPhone(rawPhone) : undefined;
    const website = fields.find((f) => f.type === 'website')?.value;

    // Website stands in for whichever right-column slot is missing (only once)
    const topRight = phone ?? website;
    const topRightIsWebsite = !phone && !!website;
    const bottomRight = email ?? (topRightIsWebsite ? undefined : website);

    const secondaryFields: PassField[] = [];
    if (title) secondaryFields.push({ key: 'title', label: 'TITLE', value: title });
    if (topRight) {
      secondaryFields.push({
        key: 'topRight',
        label: topRightIsWebsite ? 'WEBSITE' : 'PHONE',
        value: topRight,
        textAlignment: RIGHT,
      });
    }

    const auxiliaryFields: PassField[] = [];
    if (company) auxiliaryFields.push({ key: 'company', label: 'COMPANY', value: company });
    if (bottomRight) {
      auxiliaryFields.push({
        key: 'bottomRight',
        label: email ? 'EMAIL' : 'WEBSITE',
        value: bottomRight,
        textAlignment: RIGHT,
      });
    }
    // If a row ends up with a single field, drop the right-pin so it reads naturally
    if (secondaryFields.length === 1) delete secondaryFields[0].textAlignment;
    if (auxiliaryFields.length === 1) delete auxiliaryFields[0].textAlignment;

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
      generic: {
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
          // Caption under the code doubles as a lift: Wallet raises the
          // barcode to make room for altText (there's no position key)
          altText: 'Scan to connect',
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
