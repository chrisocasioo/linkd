import { sql } from 'drizzle-orm';
import { db } from './index';
import { slugify, uniqueSlug } from '../util/slugify';

export async function runMigrations() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS button_style TEXT DEFAULT 'filled';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS font TEXT DEFAULT 'dm-sans';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_domain TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE NOT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS revenue_cat_id TEXT;

    CREATE TABLE IF NOT EXISTS saved_qrs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      label TEXT,
      data TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS links (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      "order" INTEGER DEFAULT 0,
      go_live_at TIMESTAMP,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE links ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'link';
    ALTER TABLE links ADD COLUMN IF NOT EXISTS metadata TEXT;

    CREATE TABLE IF NOT EXISTS card_views (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      link_id UUID REFERENCES links(id),
      viewed_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cards (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Card',
      accent_color TEXT NOT NULL DEFAULT '#C9973A',
      display_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS card_fields (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      label TEXT,
      value TEXT NOT NULL,
      display_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      job_title TEXT,
      website TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await db.execute(sql`
    ALTER TABLE card_views ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES cards(id) ON DELETE SET NULL;
  `);
  await db.execute(sql`
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
    UPDATE cards SET slug = LEFT(MD5(id::TEXT), 8) WHERE slug IS NULL;
  `);
  await db.execute(sql`
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS font TEXT DEFAULT 'dm-sans';
  `);
  // Slugs are read as /username/slug, so only need to be unique per user —
  // the old single-column UNIQUE (from the ALTER above) blocked two
  // different users from both having a "work" card slug.
  await db.execute(sql`
    ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_slug_key;
    CREATE UNIQUE INDEX IF NOT EXISTS cards_user_slug_unique ON cards (user_id, slug);
  `);
  // Ledger of one-time migrations that can't be guarded by schema shape alone
  // (e.g. a data backfill whose "already done" state isn't a column to check).
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // One-time: give cards their old random 6-10 char code slugs a readable,
  // name-based one instead. Gated by the ledger (not slug shape) so a Pro
  // user's later custom slug never gets silently renamed just because it
  // happens to look like the old random format.
  const legacySlugMigration = 'legacy_slug_backfill_v1';
  const alreadyRan = await db.execute(sql`
    SELECT 1 FROM schema_migrations WHERE name = ${legacySlugMigration};
  `);
  if ((alreadyRan as any).rows.length === 0) {
    const legacySlugCards = await db.execute(sql`
      SELECT id, user_id, name FROM cards WHERE slug ~ '^[a-z0-9]{6,10}$';
    `);
    for (const row of (legacySlugCards as any).rows ?? []) {
      const base = slugify(row.name);
      if (!base) continue;
      const siblings = await db.execute(sql`
        SELECT slug FROM cards WHERE user_id = ${row.user_id} AND id != ${row.id};
      `);
      const taken: Set<string> = new Set((siblings as any).rows.map((r: any) => r.slug).filter(Boolean));
      const finalSlug = uniqueSlug(base, taken);
      await db.execute(sql`UPDATE cards SET slug = ${finalSlug} WHERE id = ${row.id};`);
    }
    await db.execute(sql`INSERT INTO schema_migrations (name) VALUES (${legacySlugMigration});`);
  }

  // The lighter gold (#C9A84C) used to be the default card accent; the app
  // now uses a single gold (#C9973A) everywhere. Update the column default
  // for future inserts, then one-time-backfill cards still on the old shade.
  await db.execute(sql`
    ALTER TABLE cards ALTER COLUMN accent_color SET DEFAULT '#C9973A';
  `);
  const legacyGoldMigration = 'legacy_gold_accent_backfill_v1';
  const goldAlreadyRan = await db.execute(sql`
    SELECT 1 FROM schema_migrations WHERE name = ${legacyGoldMigration};
  `);
  if ((goldAlreadyRan as any).rows.length === 0) {
    await db.execute(sql`
      UPDATE cards SET accent_color = '#C9973A' WHERE accent_color = '#C9A84C';
    `);
    await db.execute(sql`INSERT INTO schema_migrations (name) VALUES (${legacyGoldMigration});`);
  }

  // One-time: existing cards inherit the owner's profile photo; cards created
  // after this migration start with no photo unless the user sets one.
  const photoCol = await db.execute(sql`
    SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'photo';
  `);
  if ((photoCol as any).rows?.length === 0) {
    await db.execute(sql`
      ALTER TABLE cards ADD COLUMN photo TEXT;
      UPDATE cards SET photo = (SELECT profile_photo FROM users WHERE users.id = cards.user_id);
    `);
  }
  await db.execute(sql`
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address TEXT;
  `);
  await db.execute(sql`
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fax TEXT;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS field_clicks (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      field_id UUID NOT NULL REFERENCES card_fields(id) ON DELETE CASCADE,
      card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      clicked_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✓ Database tables ready');
}
