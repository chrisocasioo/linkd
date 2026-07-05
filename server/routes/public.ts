import { asc, eq, and } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { cardFields, cards, cardViews, contacts, users } from '../db/schema';
import { formatPhone } from '../util/format';

const router = Router();

const APP_STORE_URL = 'https://apps.apple.com/us/app/linkd-qr-code-generator/id6785300260';

type UserRow = typeof users.$inferSelect;
type CardRow = typeof cards.$inferSelect;
type FieldRow = typeof cardFields.$inferSelect;

const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));

const ICON_NAME: Record<string, string> = {
  email: 'mail', phone: 'call', website: 'globe-outline',
  instagram: 'logo-instagram', twitter: 'logo-twitter', linkedin: 'logo-linkedin',
  tiktok: 'logo-tiktok', youtube: 'logo-youtube', facebook: 'logo-facebook',
  whatsapp: 'logo-whatsapp', spotify: 'musical-notes-outline',
  app: 'logo-apple-appstore', custom: 'ellipsis-horizontal',
  venmo: 'logo-venmo', paypal: 'logo-paypal', cashapp: 'cash-outline', zelle: 'card-outline',
  telegram: 'paper-plane-outline', discord: 'logo-discord', signal: 'chatbubble-ellipses-outline',
  zoom: 'videocam-outline', soundcloud: 'logo-soundcloud', applemusic: 'logo-apple',
  vimeo: 'logo-vimeo', twitch: 'logo-twitch', behance: 'logo-behance', dribbble: 'logo-dribbble',
  github: 'logo-github', snapchat: 'logo-snapchat', pinterest: 'logo-pinterest', threads: 'logo-threads',
  calendly: 'calendar-outline', patreon: 'heart-outline', address: 'location-outline',
  cal: 'time-outline', acuity: 'calendar-clear-outline', booksy: 'today-outline',
};

// 'app' fields store both store links as JSON: {"ios":"…","android":"…"}
function parseAppLinks(value: string): { ios: string; android: string } {
  try {
    const o = JSON.parse(value);
    return {
      ios: typeof o.ios === 'string' ? o.ios : '',
      android: typeof o.android === 'string' ? o.android : '',
    };
  } catch {
    return { ios: '', android: '' };
  }
}

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
    case 'venmo':      return `https://venmo.com/${v.replace('@', '')}`;
    case 'paypal':     return v.includes('paypal.me') ? (v.startsWith('http') ? v : `https://${v}`) : `https://paypal.me/${v.replace('@', '')}`;
    case 'cashapp':    return `https://cash.app/$${v.replace(/^\$/, '').replace('@', '')}`;
    case 'zelle':      return v.includes('@') ? `mailto:${v}` : `tel:${v.replace(/[^\d+]/g, '')}`;
    case 'telegram':   return `https://t.me/${v.replace('@', '')}`;
    case 'soundcloud': return `https://soundcloud.com/${v.replace('@', '')}`;
    case 'vimeo':      return `https://vimeo.com/${v.replace('@', '')}`;
    case 'twitch':     return `https://twitch.tv/${v.replace('@', '')}`;
    case 'behance':    return `https://behance.net/${v.replace('@', '')}`;
    case 'dribbble':   return `https://dribbble.com/${v.replace('@', '')}`;
    case 'github':     return `https://github.com/${v.replace('@', '')}`;
    case 'snapchat':   return `https://snapchat.com/add/${v.replace('@', '')}`;
    case 'pinterest':  return `https://pinterest.com/${v.replace('@', '')}`;
    case 'threads':    return `https://threads.net/@${v.replace('@', '')}`;
    case 'calendly':   return v.includes('calendly.com') ? (v.startsWith('http') ? v : `https://${v}`) : `https://calendly.com/${v.replace('@', '')}`;
    case 'cal':        return v.includes('cal.com') ? (v.startsWith('http') ? v : `https://${v}`) : `https://cal.com/${v.replace('@', '')}`;
    case 'acuity':     return (v.includes('acuityscheduling.com') || v.includes('as.me')) ? (v.startsWith('http') ? v : `https://${v}`) : `https://${v.replace('@', '')}.as.me`;
    case 'booksy':     return v.includes('booksy.com') ? (v.startsWith('http') ? v : `https://${v}`) : `https://booksy.com/en-us/${v.replace('@', '')}`;
    case 'patreon':    return v.includes('patreon.com') ? (v.startsWith('http') ? v : `https://${v}`) : `https://patreon.com/${v.replace('@', '')}`;
    case 'address':    return `https://maps.apple.com/?q=${encodeURIComponent(v)}`;
    default:          return v.startsWith('http') ? v : `https://${v}`;
  }
}

function buildCardHtml(user: UserRow, card: CardRow, fields: FieldRow[], username: string): string {
  const name = esc(user.displayName ?? username);
  const accent = card.accentColor ?? '#C9973A';
  const initial = esc((user.displayName ?? username ?? '?')[0].toUpperCase());

  const titleVal   = fields.find(f => f.type === 'title')?.value;
  const companyVal = fields.find(f => f.type === 'company')?.value;
  const headlineVal = fields.find(f => f.type === 'headline')?.value;
  const linkFields = fields.filter(f => !['title', 'company', 'department', 'headline'].includes(f.type));

  const bannerHtml = card.photo
    ? `<img class="banner-img" src="${esc(card.photo)}" alt="${name}" />`
    : `<div class="banner-placeholder" style="background:${accent}22"><span class="banner-initial" style="color:${accent}">${initial}</span></div>`;

  const fieldRowsHtml = linkFields.map(f => {
    const icon = esc(f.icon || ICON_NAME[f.type] || 'ellipsis-horizontal');
    if (f.type === 'app') {
      // Server-rendered fallback href; a script swaps in the visitor's store
      const { ios, android } = parseAppLinks(f.value);
      const display = esc(f.label ?? 'Download the App');
      return `<a href="${esc(ios || android)}" data-app-ios="${esc(ios)}" data-app-android="${esc(android)}" onclick="trackField('${esc(f.id)}')" class="field-row">
      <span class="field-icon" style="background:${accent}"><ion-icon name="${icon}"></ion-icon></span>
      <span class="field-value">${display}</span>
    </a>`;
    }
    const url  = fieldUrl(f.type, f.value);
    const display = esc(f.label ?? (f.type === 'phone' ? formatPhone(f.value) : f.value));
    return `<a href="${esc(url)}" onclick="trackField('${esc(f.id)}')" class="field-row">
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
  ${card.photo ? `<meta property="og:image" content="${esc(card.photo)}" />` : ''}
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
      padding: 12px; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .footer-text { font-size: 12px; color: rgba(255,255,255,0.4); }
    .footer-badge { height: 42px; width: auto; }
    .exchange { padding: 14px 18px 18px; border-top: 1px solid rgba(255,255,255,0.06); }
    .save-contact {
      display: block; width: 100%; padding: 13px; border-radius: 13px;
      background: ${accent}; color: #0C0C0E; font-size: 14px; font-weight: 600;
      text-align: center; text-decoration: none; margin-bottom: 10px;
      font-family: inherit;
    }
    .exchange-toggle {
      width: 100%; padding: 13px; border-radius: 13px;
      background: transparent; border: 1px solid ${accent}55; color: ${accent};
      font-size: 14px; font-weight: 600;
      cursor: pointer; font-family: inherit;
    }
    .exchange-form { display: none; flex-direction: column; gap: 10px; margin-top: 12px; }
    .exchange-form input {
      padding: 12px 14px; border-radius: 12px; font-size: 15px; font-family: inherit;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #fff;
      outline: none;
    }
    .exchange-form input:focus { border-color: ${accent}; }
    .exchange-form input::placeholder { color: rgba(255,255,255,0.35); }
    .exchange-submit {
      padding: 13px; border: none; border-radius: 12px;
      background: ${accent}; color: #0C0C0E; font-size: 14px; font-weight: 600;
      cursor: pointer; font-family: inherit;
    }
    .exchange-done {
      display: none; text-align: center; padding: 13px;
      color: ${accent}; font-size: 14px; font-weight: 600;
    }
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
    <div class="exchange">
      <a class="save-contact" href="/${esc(username)}/${esc(card.slug ?? '')}/vcard">Add to Contacts</a>
      <button class="exchange-toggle" id="xToggle" onclick="toggleExchange()">Share your info with ${name}</button>
      <form class="exchange-form" id="xForm" onsubmit="return submitExchange(event)">
        <input id="xName" placeholder="Your name" maxlength="120" required />
        <input id="xEmail" type="email" placeholder="Email" maxlength="120" />
        <input id="xPhone" type="tel" placeholder="Phone" maxlength="40" />
        <input id="xCompany" placeholder="Company (optional)" maxlength="120" />
        <button type="submit" class="exchange-submit">Send</button>
      </form>
      <div class="exchange-done" id="xDone">&#10003; Sent to ${name} — thanks!</div>
    </div>
  </div>
  <div class="footer">
    <span class="footer-text">Get your own Linkd card</span>
    <a href="${APP_STORE_URL}">
      <img class="footer-badge" src="https://toolbox.marketingtools.apple.com/api/badges/download-on-the-app-store/black/en-us" alt="Download on the App Store" />
    </a>
  </div>
<script>
// App fields: send Android visitors to Google Play, everyone else to the
// App Store, falling back to whichever store link exists
(function () {
  var isAndroid = /android/i.test(navigator.userAgent);
  var rows = document.querySelectorAll('a[data-app-ios]');
  for (var i = 0; i < rows.length; i++) {
    var ios = rows[i].getAttribute('data-app-ios');
    var android = rows[i].getAttribute('data-app-android');
    var url = isAndroid ? (android || ios) : (ios || android);
    if (url) rows[i].setAttribute('href', url);
  }
})();
function trackField(fieldId) {
  try { fetch('/api/analytics/field-click/' + fieldId, { method: 'POST', keepalive: true }).catch(function(){}); } catch(e) {}
}
function toggleExchange() {
  var f = document.getElementById('xForm');
  var open = f.style.display === 'flex';
  f.style.display = open ? 'none' : 'flex';
  if (!open) document.getElementById('xName').focus();
}
function submitExchange(e) {
  e.preventDefault();
  var name = document.getElementById('xName').value.trim();
  var parts = name.split(/\\s+/);
  var btn = document.querySelector('.exchange-submit');
  btn.disabled = true;
  fetch('/exchange/${esc(card.id)}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' '),
      email: document.getElementById('xEmail').value.trim(),
      phone: document.getElementById('xPhone').value.trim(),
      company: document.getElementById('xCompany').value.trim(),
    }),
  }).then(function (r) {
    if (!r.ok) throw new Error();
    document.getElementById('xForm').style.display = 'none';
    document.getElementById('xToggle').style.display = 'none';
    document.getElementById('xDone').style.display = 'block';
  }).catch(function () {
    btn.disabled = false;
    alert('Could not send — please try again.');
  });
  return false;
}
</script>
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
  const title = fields.find((f) => f.type === 'title')?.value;
  const company = fields.find((f) => f.type === 'company')?.value;

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fn}`,
    `N:${lastName};${firstName};;;`,
    title ? `TITLE:${title}` : null,
    company ? `ORG:${company}` : null,
    email ? `EMAIL;TYPE=WORK:${email}` : null,
    phone ? `TEL;TYPE=CELL:${phone}` : null,
    website ? `URL:${website}` : `URL:https://linkd.tattoo/${username}`,
    user.profilePhoto ? `PHOTO;VALUE=URI:${user.profilePhoto}` : null,
    'END:VCARD',
  ];
  return lines.filter(Boolean).join('\r\n');
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Exchange: a card viewer shares their info back — lands in the owner's contacts
router.post('/exchange/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
    const firstName = clip(req.body?.firstName, 60);
    const lastName  = clip(req.body?.lastName, 60);
    const email     = clip(req.body?.email, 120);
    const phone     = clip(req.body?.phone, 40);
    const company   = clip(req.body?.company, 120);
    if (!firstName && !lastName && !email && !phone) {
      return res.status(400).json({ error: 'Name, email, or phone required' });
    }

    await db.insert(contacts).values({
      userId: card.userId,
      firstName: firstName || null,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      company: company || null,
      notes: 'Shared their info via your Linkd card',
      source: 'card',
    });
    res.status(201).json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

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

// Card-specific vCard — the Add to Contacts button on each public card
router.get('/:username/:slug/vcard', async (req, res) => {
  try {
    const { username, slug } = req.params;
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return res.status(404).send('Not found');
    const card = await db.query.cards.findFirst({ where: and(eq(cards.userId, user.id), eq(cards.slug, slug)) });
    if (!card) return res.status(404).send('Not found');
    const fields = await db
      .select()
      .from(cardFields)
      .where(eq(cardFields.cardId, card.id))
      .orderBy(asc(cardFields.displayOrder));
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
