/** Turns a card name into a URL-safe slug, e.g. "Work Card!" -> "work-card" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (post-NFKD combining marks)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

// `/:username/vcard` is a real route, so a card can't claim that slug.
const RESERVED_SLUGS = new Set(['vcard']);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/** Appends -2, -3, ... until `taken` no longer has the candidate */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base) && !isReservedSlug(base)) return base;
  let n = 2;
  let candidate = `${base}-${n}`.slice(0, 30);
  while (taken.has(candidate) || isReservedSlug(candidate)) {
    n += 1;
    candidate = `${base}-${n}`.slice(0, 30);
  }
  return candidate;
}
