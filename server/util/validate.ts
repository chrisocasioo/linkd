// Colors are interpolated straight into HTML attributes and <style> blocks on
// the public card page, so they must be validated on write (and re-checked at
// render). Strict 6-digit hex only — same shape pass.ts already enforces.
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

/** Returns the color if valid, else the fallback. Use at render time. */
export function safeHexColor(value: unknown, fallback: string): string {
  return isHexColor(value) ? value : fallback;
}

// Only https links (and the app-store schemes) are allowed as hrefs built from
// user-supplied JSON — a `javascript:` URL in an <a href> executes on click.
const SAFE_LINK_RE = /^(https:\/\/|itms-apps:\/\/|market:\/\/)/i;

export function isSafeLink(value: unknown): value is string {
  return typeof value === 'string' && SAFE_LINK_RE.test(value.trim());
}

// Top-level paths the server itself answers (or may later) — a username equal
// to one of these would be shadowed by, or shadow, a real route.
const RESERVED_USERNAMES = new Set([
  'api', 'health', 'privacy', 'support', 'terms', 'icon', 'favicon', 'robots', 'sitemap',
  'pass', 'exchange', 'vcard', 'www', 'admin', 'app', 'linkd', 'static', 'assets', 'login',
  'signin', 'signup', 'sign-in', 'sign-up', 'settings', 'about', 'help', 'contact', 'home',
  'download', 'pricing', 'legal', 'status', 'blog', 'null', 'undefined',
]);

export function isReservedUsername(value: string): boolean {
  return RESERVED_USERNAMES.has(value.toLowerCase());
}
