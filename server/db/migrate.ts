import { sql } from 'drizzle-orm';
import { db } from './index';

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
  `);
  console.log('✓ Database tables ready');
}
