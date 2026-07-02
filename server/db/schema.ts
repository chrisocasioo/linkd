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

export const cards = pgTable('cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('Card'),
  accentColor: text('accent_color').notNull().default('#C9A84C'),
  slug: text('slug').unique(),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const cardViews = pgTable('card_views', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  linkId: uuid('link_id').references(() => links.id),
  cardId: uuid('card_id').references(() => cards.id, { onDelete: 'set null' }),
  viewedAt: timestamp('viewed_at').defaultNow(),
});

export const cardFields = pgTable('card_fields', {
  id: uuid('id').defaultRandom().primaryKey(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  label: text('label'),
  value: text('value').notNull(),
  displayOrder: integer('display_order').default(0),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  jobTitle: text('job_title'),
  website: text('website'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type SavedQr = typeof savedQrs.$inferSelect;
export type Link = typeof links.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type CardView = typeof cardViews.$inferSelect;
export type CardField = typeof cardFields.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
