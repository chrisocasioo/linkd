import { asc, eq, and } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { cardFields, cards, cardViews, users } from '../db/schema';

const router = Router();

type UserRow = typeof users.$inferSelect;
type CardRow = typeof cards.$inferSelect;
type FieldRow = typeof cardFields.$inferSelect;

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));

const ICON_NAME: Record<string, string> = {
  email: 'mail', phone: 'call', website: 'globe-outline',
  instagram: 'logo-instagram', twitter: 'logo-twitter', linkedin: 'logo-linkedin',
  tiktok: 'logo-tiktok', youtube: 'logo-youtube', facebook: 'logo-facebook',
  whatsapp: 'logo-whatsapp', spotify: 'musical-notes-outline', custom: 'ellipsis-horizontal',
};

function fieldUrl(type: string, value: string): string {
  const v = value.trim();
  switch (type) {
    case 'email':     return `mailto:${v}`;
    case 'phone':     return `tel:${v}`;
    case 'instagram': return `https://instagram.com/${v.replace('@', '')}`;
    case 'twitter':   return `https://twitter.com/${v.replace('@', '')}`;
    case 'linkedin':  return `https://linkedin.com/in/${v.replace('@', '')}`;
    case 'tiktok':    return `https://tiktok.com/@${v.replace('@', '')}`;
    case 'youtube':   return `https://youtube.com/@${v.replace('@', '')}`;
    case 'facebook':  return `https://facebook.com/${v.replace('@', '')}`;
    case 'whatsapp':  return `https://wa.me/${v.replace(/\D/g, '')}`;
    case 'spotify':   return `https://open.spotify.com/user/${v.replace('@', '')}`;
    default:          return v.startsWith('http') ? v : `https://${v}`;
  }
}

function buildCardHtml(user: UserRow, card: CardRow, fields: FieldRow[], username: string): string {
  const name = esc(user.displayName ?? username);
  const accent = card.accentColor ?? '#C9A84C';
  const initial = esc((user.displayName ?? username ?? '?')[0].toUpperCase());

  const titleVal   = fields.find(f => f.type === 'title')?.value;
  const companyVal = fields.find(f => f.type === 'company')?.value;
  const headlineVal = fields.find(f => f.type === 'headline')?.value;
  const linkFields = fields.filter(f => !['title', 'company', 'department', 'headline'].includes(f.type));

  const bannerHtml = user.profilePhoto
    ? `<img class="banner-img" src="${esc(user.profilePhoto)}" alt="${name}" />`
    : `<div class="banner-placeholder" style="background:${accent}22"><span class="banner-initial" style="color:${accent}">${initial}</span></div>`;

  const fieldRowsHtml = linkFields.map(f => {
    const url  = fieldUrl(f.type, f.value);
    const icon = ICON_NAME[f.type] ?? 'ellipsis-horizontal';
    const display = esc(f.label ?? f.value);
    return `<a href="${esc(url)}" class="field-row">
      <span class="field-icon" style="background:${accent}"><ion-icon name="${icon}"></ion-icon></span>
      <span class="field-value">${display}</span>
    </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>${name} | Linkd</title>
  <meta property="og:title" content="${name}" />
  ${user.profilePhoto ? `<meta property="og:image" content="${esc(user.profilePhoto)}" />` : ''}
  <script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
  <script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0C0C0E;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 20px 80px;
    }
    .card {
      width: 100%;
      max-width: 420px;
      background: #161616;
      border-radius: 22px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .banner {
      position: relative;
      width: 100%;
      height: 190px;
    }
    .banner-img {
      width: 100%; height: 100%;
      object-fit: cover; display: block;
    }
    .banner-placeholder {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
    }
    .banner-initial {
      font-size: 64px; font-weight: 600; line-height: 1;
    }
    .card-label {
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.55); color: #fff;
      font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
      padding: 5px 12px; border-radius: 20px; white-space: nowrap;
    }
    .identity { padding: 16px 18px 8px; }
    .name { font-size: 20px; font-weight: 600; color: #fff; letter-spacing: -0.3px; }
    .job-title { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.85); margin-top: 3px; }
    .company { font-size: 14px; font-style: italic; color: rgba(255,255,255,0.65); margin-top: 1px; }
    .headline { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 5px; line-height: 16px; }
    .field-row {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 18px; color: #fff; text-decoration: none;
      border-top: 1px solid rgba(255,255,255,0.06);
      transition: background 0.15s;
    }
    .field-row:hover { background: rgba(255,255,255,0.04); }
    .field-icon {
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .field-icon ion-icon { font-size: 16px; color: #fff; }
    .field-value { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .footer {
      position: fixed; bottom: 0; left: 0; right: 0;
      padding: 12px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.4);
    }
    .footer a { color: inherit; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="banner">
      ${bannerHtml}
      <div class="card-label">${esc(card.name)}</div>
    </div>
    <div class="identity">
      <div class="name">${name}</div>
      ${titleVal   ? `<div class="job-title">${esc(titleVal)}</div>`   : ''}
      ${companyVal ? `<div class="company">${esc(companyVal)}</div>`   : ''}
      ${headlineVal ? `<div class="headline">${esc(headlineVal)}</div>` : ''}
    </div>
    ${fieldRowsHtml}
  </div>
  ${!user.isPro ? '<div class="footer"><a href="https://linkd-production-fdce.up.railway.app">Get Linkd</a></div>' : ''}
</body>
</html>`;
}

async function buildVcard(user: UserRow, fields: FieldRow[], username: string): Promise<string> {
  const displayName = user.displayName ?? username;
  const nameParts = displayName.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  const fn = [firstName, lastName].filter(Boolean).join(' ');

  const email = fields.find((f) => f.type === 'email')?.value ?? user.email;
  const phone = fields.find((f) => f.type === 'phone')?.value;
  const website = fields.find((f) => f.type === 'website')?.value;

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fn}`,
    `N:${lastName};${firstName};;;`,
    email ? `EMAIL;TYPE=WORK:${email}` : null,
    phone ? `TEL;TYPE=CELL:${phone}` : null,
    website ? `URL:${website}` : `URL:https://linkd.tattoo/${username}`,
    user.profilePhoto ? `PHOTO;VALUE=URI:${user.profilePhoto}` : null,
    'END:VCARD',
  ];
  return lines.filter(Boolean).join('\r\n');
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/:username/vcard', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return res.status(404).send('Not found');
    const [firstCard] = await db
      .select()
      .from(cards)
      .where(eq(cards.userId, user.id))
      .orderBy(asc(cards.displayOrder))
      .limit(1);
    const fields = firstCard
      ? await db.select().from(cardFields).where(eq(cardFields.cardId, firstCard.id)).orderBy(asc(cardFields.displayOrder))
      : [];
    const vcf = await buildVcard(user, fields, username);
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${username}.vcf"`);
    res.send(vcf);
  } catch {
    res.status(500).send('Error');
  }
});

router.get('/:username/:slug', async (req, res) => {
  try {
    const { username, slug } = req.params;
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return res.status(404).send('<!DOCTYPE html><html><body><h1>Card not found</h1></body></html>');
    const card = await db.query.cards.findFirst({ where: and(eq(cards.userId, user.id), eq(cards.slug, slug)) });
    if (!card) return res.status(404).send('<!DOCTYPE html><html><body><h1>Card not found</h1></body></html>');
    const fields = await db
      .select()
      .from(cardFields)
      .where(eq(cardFields.cardId, card.id))
      .orderBy(asc(cardFields.displayOrder));
    db.insert(cardViews).values({ userId: user.id, linkId: null, cardId: card.id }).catch(() => {});
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildCardHtml(user, card, fields, username));
  } catch {
    res.status(500).send('<!DOCTYPE html><html><body><h1>Server error</h1></body></html>');
  }
});

router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return res.status(404).send('<!DOCTYPE html><html><body><h1>Card not found</h1></body></html>');
    const [firstCard] = await db
      .select()
      .from(cards)
      .where(eq(cards.userId, user.id))
      .orderBy(asc(cards.displayOrder))
      .limit(1);
    if (!firstCard) return res.status(404).send('<!DOCTYPE html><html><body><h1>No cards yet</h1></body></html>');
    const fields = await db
      .select()
      .from(cardFields)
      .where(eq(cardFields.cardId, firstCard.id))
      .orderBy(asc(cardFields.displayOrder));
    db.insert(cardViews).values({ userId: user.id, linkId: null, cardId: firstCard.id }).catch(() => {});
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildCardHtml(user, firstCard, fields, username));
  } catch (err: any) {
    res.status(500).send('<!DOCTYPE html><html><body><h1>Server error</h1></body></html>');
  }
});

export default router;
