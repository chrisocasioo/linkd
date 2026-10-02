import type { Request, Response } from 'express';

// The public card page is anonymous, so the owner's own test visits can only be
// told apart by marking their browser. The app's Preview button opens the card
// with ?preview=1, which sets this cookie; views and clicks from a marked
// browser are then never counted. It only ever suppresses counting.
const COOKIE = 'linkd_owner';

export function isOwnerBrowser(req: Request): boolean {
  const header = req.headers.cookie ?? '';
  return header.split(';').some((part) => part.trim() === `${COOKIE}=1`);
}

/** True when this request shouldn't be counted; also marks the browser on a preview load. */
export function isOwnerTraffic(req: Request, res?: Response): boolean {
  if (req.query?.preview === '1') {
    res?.append('Set-Cookie', `${COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure; HttpOnly`);
    return true;
  }
  return isOwnerBrowser(req);
}
