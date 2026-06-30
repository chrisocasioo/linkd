import { and, asc, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db';
import { cardViews, links, users } from '../db/schema';

const router = Router();

async function getActiveLinks(userId: string) {
  const now = new Date();
  return db
    .select()
    .from(links)
    .where(
      and(
        eq(links.userId, userId),
        or(isNull(links.goLiveAt), lt(links.goLiveAt, now)),
        or(isNull(links.expiresAt), gt(links.expiresAt, now))
      )
    )
    .orderBy(asc(links.order));
}

router.get('/api/cards/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const activeLinks = await getActiveLinks(user.id);
    res.json({ user, links: activeLinks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:username/vcard', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return res.status(404).send('Not found');
    const name = user.displayName ?? username;
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${name}`,
      `NICKNAME:${username}`,
      user.bio ? `NOTE:${user.bio.replace(/\n/g, '\\n')}` : null,
      user.profilePhoto ? `PHOTO;VALUE=URI:${user.profilePhoto}` : null,
      `URL:https://linkd.tattoo/${username}`,
      `EMAIL:${user.email}`,
      'END:VCARD',
    ];
    const vcard = lines.filter(Boolean).join('\r\n');
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${username}.vcf"`);
    res.send(vcard);
  } catch (err: any) {
    res.status(500).send('Error');
  }
});

router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return res.status(404).send('<!DOCTYPE html><html><body><h1>Card not found</h1></body></html>');
    const activeLinks = await getActiveLinks(user.id);

    db.insert(cardViews).values({ userId: user.id, linkId: null }).catch(() => {});

    const themeMap: Record<string, { bg: string; text: string; card: string; accent: string }> = {
      dark: { bg: '#000000', text: '#FFFFFF', card: '#1A1A1A', accent: '#C9A84C' },
      light: { bg: '#FFFFFF', text: '#1A1A1A', card: '#F5F5F5', accent: '#C9A84C' },
      midnight: { bg: '#0A0A2E', text: '#FFFFFF', card: '#1A1A3E', accent: '#7C3AED' },
      forest: { bg: '#0A2E1A', text: '#FFFFFF', card: '#1A3E2A', accent: '#22C55E' },
      rose: { bg: '#2E0A1A', text: '#FFFFFF', card: '#3E1A2A', accent: '#F43F5E' },
      ocean: { bg: '#0A1A2E', text: '#FFFFFF', card: '#1A2A3E', accent: '#0EA5E9' },
      sand: { bg: '#F5E6D3', text: '#1A1A1A', card: '#EAD5BC', accent: '#C9A84C' },
      slate: { bg: '#1E293B', text: '#FFFFFF', card: '#334155', accent: '#94A3B8' },
      purple: { bg: '#1A0A2E', text: '#FFFFFF', card: '#2A1A3E', accent: '#A855F7' },
    };

    const t = themeMap[user.theme ?? 'dark'] ?? themeMap.dark;
    const accent = user.accentColor ?? t.accent;
    const name = (user.displayName ?? username).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));
    const bio = user.bio ? user.bio.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c)) : '';

    const linkItems = activeLinks
      .map(
        (l) =>
          `<a href="${l.url.replace(/"/g, '&quot;')}" class="link-btn" onclick="logClick('${l.id}');return true;">${l.title.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c))}</a>`
      )
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} | Linkd</title>
  <meta property="og:title" content="${name}" />
  <meta property="og:description" content="${bio || 'Digital business card'}" />
  ${user.profilePhoto ? `<meta property="og:image" content="${user.profilePhoto}" />` : ''}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${t.bg};color:${t.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:48px 20px 80px}
    .card{width:100%;max-width:480px;display:flex;flex-direction:column;align-items:center;gap:16px}
    .avatar{width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid ${accent}}
    .avatar-ph{width:96px;height:96px;border-radius:50%;background:${t.card};border:3px solid ${accent}}
    .name{font-size:24px;font-weight:700;text-align:center}
    .bio{font-size:14px;opacity:.7;text-align:center;max-width:320px;line-height:1.5;white-space:pre-wrap}
    .links{width:100%;display:flex;flex-direction:column;gap:12px;margin-top:8px}
    .link-btn{display:block;width:100%;padding:14px 20px;background:${t.card};color:${t.text};border:1px solid ${accent};border-radius:12px;text-align:center;text-decoration:none;font-size:16px;font-weight:500;transition:opacity .15s}
    .link-btn:hover{opacity:.8}
    .footer{position:fixed;bottom:0;left:0;right:0;padding:12px;text-align:center;font-size:12px;opacity:.4}
    .footer a{color:inherit;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    ${user.profilePhoto ? `<img class="avatar" src="${user.profilePhoto}" alt="${name}" />` : '<div class="avatar-ph"></div>'}
    <div class="name">${name}</div>
    ${bio ? `<div class="bio">${bio}</div>` : ''}
    <div class="links">${linkItems}</div>
  </div>
  ${!user.isPro ? '<div class="footer"><a href="https://linkd.tattoo">Get Linkd</a></div>' : ''}
  <script>
    function logClick(linkId){
      fetch('/api/analytics/view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'${username.replace(/'/g, "\\'")}',linkId})}).catch(function(){});
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).send('<!DOCTYPE html><html><body><h1>Server error</h1></body></html>');
  }
});

export default router;
