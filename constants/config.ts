export const SHARE_BASE = 'linkd-production-fdce.up.railway.app';

export function publicCardUrl(username: string, slug?: string | null): string {
  return slug ? `https://${SHARE_BASE}/${username}/${slug}` : `https://${SHARE_BASE}/${username}`;
}
