export const SHARE_BASE = 'linkd.biz';
export const PASS_TYPE_ID = 'pass.com.santrico.linkd';

export function publicCardUrl(username: string, slug?: string | null): string {
  return slug ? `https://${SHARE_BASE}/${username}/${slug}` : `https://${SHARE_BASE}/${username}`;
}
