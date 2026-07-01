import { asc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { cardFields, cards, cardViews, users } from '../db/schema';

const router = Router();

type UserRow = typeof users.$inferSelect;
type CardRow = typeof cards.$inferSelect;
type FieldRow = typeof cardFields.$inferSelect;

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));

const FIELD_ICONS: Record<string, string> = {
  email: '✉', phone: '📞', website: '🌐',
  instagram: '📸', twitter: '𝕏', linkedin: '💼',
  tiktok: '🎵', youtube: '▶', custom: '•',
};

function fieldAction(field: FieldRow): string {
  const v = esc(field.value);
  switch (field.type) {
    case 'email':    return `<a href="mailto:${v}" class="field-row">${FIELD_ICONS.email} ${v}</a>`;
    case 'phone':    return `<a href="tel:${v}" class="field-row">${FIELD_ICONS.phone} ${v}</a>`;
    case 'instagram': return `<a href="https://instagram.com/${v.replace('@','')}" class="field-row">${FIELD_ICONS.instagram} ${v}</a>`;
    case 'twitter':  return `<a href="https://twitter.com/${v.replace('@','')}" class="field-row">${FIELD_ICONS.twitter} ${v}</a>`;
    case 'linkedin': return `<a href="https://linkedin.com/in/${v.replace('@','')}" class="field-row">${FIELD_ICONS.linkedin} ${v}</a>`;
    case 'tiktok':   return `<a href="https://tiktok.com/@${v.replace('@','')}" class="field-row">${FIELD_ICONS.tiktok} ${v}</a>`;
    case 'youtube':  return `<a href="https://youtube.com/@${v.replace('@','')}" class="field-row">${FIELD_ICONS.youtube} ${v}</a>`;
    default:         return `<a href="${v.startsWith('http') ? v : 'https://'+v}" class="field-row">${FIELD_ICONS[field.type] ?? FIELD_ICONS.custom} ${v}</a>`;
  }
}

function buildCardHtml(user: UserRow, card: CardRow, fields: FieldRow[], username: string): string {
  const name = esc(user.displayName ?? username);
  const fieldRows = fields.map(fieldAction).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} | Linkd</title>
  <meta property="og:title" content="${name}" />
  ${user.profilePhoto ? `<meta property="og:image" content="${esc(user.profilePhoto)}" />` : ''}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0C0C0E;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:32px 20px 80px}
    .card{width:100%;max-width:420px;background:#1A1A1A;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5)}
    .banner{position:relative;width:100%;height:200px;background:#222}
    .banner img{width:100%;height:100%;object-fit:cover}
    .card-label{position:absolute;top:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:#fff;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:5px 12px;border-radius:20px;white-space:nowrap}
    .info{padding:20px 20px 8px}
    .name{font-size:22px;font-weight:700;margin-bottom:4px}
    .field-row{display:flex;align-items:center;gap:12px;padding:12px 20px;color:#fff;text-decoration:none;font-size:15px;border-top:1px solid rgba(255,255,255,0.06)}
    .field-row:hover{background:rgba(255,255,255,0.04)}
    .footer{position:fixed;bottom:0;left:0;right:0;padding:12px;text-align:center;font-size:12px;opacity:.4}
    .footer a{color:inherit;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <div class="banner">
      ${user.profilePhoto ? `<img src="${esc(user.profilePhoto)}" alt="${name}" />` : ''}
      <div class="card-label">${esc(card.name)}</div>
    </div>
    <div class="info"><div class="name">${name}</div></div>
    <div class="fields">${fieldRows}</div>
  </div>
  ${!user.isPro ? '<div class="footer"><a href="https://linkd.tattoo">Get Linkd</a></div>' : ''}
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
    db.insert(cardViews).values({ userId: user.id, linkId: null }).catch(() => {});
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildCardHtml(user, firstCard, fields, username));
  } catch (err: any) {
    res.status(500).send('<!DOCTYPE html><html><body><h1>Server error</h1></body></html>');
  }
});

export default router;
