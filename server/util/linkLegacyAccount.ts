import { sql } from 'drizzle-orm';
import { db } from '../db';
import { copyProfilePhoto } from './purgeUserAssets';

// Linkd moved from a development Clerk instance (build 99) to a production one.
// A person signing in on the production instance gets a brand-new Clerk user id,
// so without this they would land on an empty account while their cards,
// contacts and username stay attached to the old id.
//
// When a production user first appears, and exactly one existing account has the
// same VERIFIED email AND that account's id really exists in the legacy Clerk
// instance with that same verified email, everything is moved onto the new id.
//
// Emails here are never trusted from the client: both addresses come straight
// from Clerk's Backend API, and the old id is checked against the legacy
// instance, so an attacker can't claim someone else's data without controlling
// a verified mailbox on both sides.

// Accounts that must stay separate on both instances (App Review signs into the
// legacy one with build 99, the new one backs the production demo account).
const NO_MERGE_EMAILS = new Set(
  ['linkd.review@santrico.app', ...(process.env.NO_MERGE_EMAILS ?? '').split(',')]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

type ClerkUserLike = {
  primaryEmailAddressId?: string | null;
  emailAddresses: Array<{ id: string; emailAddress: string; verification?: { status?: string | null } | null }>;
};

function verifiedPrimaryEmail(u: ClerkUserLike): string | null {
  const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0];
  if (!primary || primary.verification?.status !== 'verified') return null;
  return primary.emailAddress.trim().toLowerCase();
}

const inFlight = new Map<string, Promise<void>>();

export function linkLegacyAccount(
  newId: string,
  clerkUser: ClerkUserLike,
  legacyClerk: { users: { getUser(id: string): Promise<ClerkUserLike> } } | null
): Promise<void> {
  if (!legacyClerk) return Promise.resolve();
  const existing = inFlight.get(newId);
  if (existing) return existing;
  const run = doLink(newId, clerkUser, legacyClerk).finally(() => inFlight.delete(newId));
  inFlight.set(newId, run);
  return run;
}

async function doLink(
  newId: string,
  clerkUser: ClerkUserLike,
  legacyClerk: { users: { getUser(id: string): Promise<ClerkUserLike> } }
): Promise<void> {
  const email = verifiedPrimaryEmail(clerkUser);
  if (!email || NO_MERGE_EMAILS.has(email)) return;

  // An account that already has a username or cards is a real, in-use account
  const mine: any[] = ((await db.execute(sql`
    SELECT u.username, (SELECT count(*) FROM cards c WHERE c.user_id = u.id)::int AS cards
    FROM users u WHERE u.id = ${newId};
  `)) as any).rows;
  if (mine[0] && (mine[0].username || mine[0].cards > 0)) return;

  const candidates: any[] = ((await db.execute(sql`
    SELECT id FROM users WHERE lower(email) = ${email} AND id <> ${newId};
  `)) as any).rows;
  if (candidates.length !== 1) return;
  const oldId: string = candidates[0].id;

  // The old id must exist in the legacy Clerk instance with this same verified email
  let legacyUser: ClerkUserLike;
  try {
    legacyUser = await legacyClerk.users.getUser(oldId);
  } catch {
    return;
  }
  if (verifiedPrimaryEmail(legacyUser) !== email) return;

  const fks: any[] = ((await db.execute(sql`
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass;
  `)) as any).rows;

  await db.transaction(async (tx) => {
    const old: any[] = ((await tx.execute(sql`SELECT username FROM users WHERE id = ${oldId} FOR UPDATE;`)) as any).rows;
    if (!old[0]) return; // someone else already merged it
    const username: string | null = old[0].username ?? null;
    await tx.execute(sql`DELETE FROM users WHERE id = ${newId};`); // empty shell, if any
    await tx.execute(sql`
      INSERT INTO users (id, email, display_name, bio, profile_photo, theme, accent_color, button_style, font, custom_domain, is_pro, revenue_cat_id, created_at, updated_at)
      SELECT ${newId}, email, display_name, bio, profile_photo, theme, accent_color, button_style, font, custom_domain, is_pro, revenue_cat_id, created_at, NOW()
      FROM users WHERE id = ${oldId};
    `);
    for (const fk of fks) {
      await tx.execute(sql`UPDATE ${sql.raw(fk.tbl)} SET ${sql.identifier(fk.col)} = ${newId} WHERE ${sql.identifier(fk.col)} = ${oldId};`);
    }
    await tx.execute(sql`DELETE FROM users WHERE id = ${oldId};`);
    if (username) await tx.execute(sql`UPDATE users SET username = ${username} WHERE id = ${newId};`);
  });
  await copyProfilePhoto(oldId, newId);
  console.log(`✓ Linked legacy account ${oldId} -> ${newId}`);
}
