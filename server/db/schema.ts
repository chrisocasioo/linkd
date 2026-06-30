import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  username: text('username').unique(),
  bio: text('bio'),
  profilePhoto: text('profile_photo'),
  theme: text('theme').default('dark'),
  accentColor: text('accent_color'),
  buttonStyle: text('button_style').default('filled'),
  font: text('font').default('dm-sans'),
  customDomain: text('custom_domain'),
  isPro: boolean('is_pro').default(false).notNull(),
  revenueCatId: text('revenue_cat_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const savedQrs = pgTable('saved_qrs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  label: text('label'),
  data: text('data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const links = pgTable('links', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  type: text('type').default('link').notNull(),
  metadata: text('metadata'),
  order: integer('order').default(0),
  goLiveAt: timestamp('go_live_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const cardViews = pgTable('card_views', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  linkId: uuid('link_id').references(() => links.id),
  viewedAt: timestamp('viewed_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type SavedQr = typeof savedQrs.$inferSelect;
export type Link = typeof links.$inferSelect;
export type CardView = typeof cardViews.$inferSelect;
