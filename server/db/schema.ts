import { boolean, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

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
  // Custom styling, independent of any card's own branding
  color: text('color'),
  bgColor: text('bg_color'),
  logo: text('logo'),
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
  accentColor: text('accent_color').notNull().default('#C9973A'),
  font: text('font').default('dm-sans'),
  photo: text('photo'),
  slug: text('slug'),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  // QR branding — independent from the card's own accentColor/photo, so a
  // card's colors and its QR code's colors/logo don't have to match.
  qrColor: text('qr_color'),
  qrLogo: text('qr_logo'),
  qrBgColor: text('qr_bg_color'),
}, (table) => ({
  // Slugs read as /username/slug, so only need to be unique per user —
  // lets different users both have a "work" card
  userSlugUnique: unique('cards_user_slug_unique').on(table.userId, table.slug),
}));

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
  // User-picked Ionicons name — only meaningful for type 'custom'; other
  // types render from the fixed per-type icon map instead
  icon: text('icon'),
  displayOrder: integer('display_order').default(0),
});

export const fieldClicks = pgTable('field_clicks', {
  id: uuid('id').defaultRandom().primaryKey(),
  fieldId: uuid('field_id').notNull().references(() => cardFields.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clickedAt: timestamp('clicked_at').defaultNow(),
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
  fax: text('fax'),
  address: text('address'),
  notes: text('notes'),
  // How the contact was added: 'manual' (+ button), 'scan' (business card
  // OCR), or 'card' (someone shared their info via a public card exchange).
  source: text('source').notNull().default('manual'),
  // Cropped photo of the scanned business card itself (source: 'scan' only)
  // — lets users double-check the parsed fields against the original card.
  photo: text('photo'),
  createdAt: timestamp('created_at').defaultNow(),
});

// A log of scan events from the Scans tab camera — business-card scans that
// became a contact, and QR codes read/decoded. Deleting an entry here only
// removes it from this log; a 'contact' entry's contactId is a snapshot
// reference (no FK), so the underlying contact is untouched either way.
export const scanHistory = pgTable('scan_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'contact' | 'qr'
  contactId: uuid('contact_id'),
  label: text('label').notNull(),
  qrData: text('qr_data'),
  qrFormat: text('qr_format'), // 'url' | 'wifi' | 'text'
  createdAt: timestamp('created_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type SavedQr = typeof savedQrs.$inferSelect;
export type Link = typeof links.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type CardView = typeof cardViews.$inferSelect;
export type CardField = typeof cardFields.$inferSelect;
export type FieldClick = typeof fieldClicks.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type ScanHistoryEntry = typeof scanHistory.$inferSelect;
