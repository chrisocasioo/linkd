import Storage from 'expo-sqlite/kv-store';
import { Card, CardAnalytics, Contact, User } from './api';
import { clearSyncedLedger } from './nativeContacts';

// Offline cache: last-known-good copies of server data so the app works with
// no network. All errors are swallowed — the cache must never break the app.

const HOME_KEY = 'linkd.cache.home.v1'; // bump suffix on shape changes
const CONTACTS_KEY = 'linkd.cache.contacts.v1';

export interface HomeCache {
  user: User;
  cards: Card[];
  cardAnalytics: CardAnalytics[];
  savedAt: string;
}

export async function saveHomeCache(data: Omit<HomeCache, 'savedAt'>): Promise<void> {
  try {
    await Storage.setItem(HOME_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  } catch {}
}

export async function loadHomeCache(): Promise<HomeCache | null> {
  try {
    const raw = await Storage.getItem(HOME_KEY);
    return raw ? (JSON.parse(raw) as HomeCache) : null;
  } catch {
    return null;
  }
}

export async function saveContactsCache(contacts: Contact[]): Promise<void> {
  try {
    await Storage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  } catch {}
}

export async function loadContactsCache(): Promise<Contact[] | null> {
  try {
    const raw = await Storage.getItem(CONTACTS_KEY);
    return raw ? (JSON.parse(raw) as Contact[]) : null;
  } catch {
    return null;
  }
}

export async function clearAllCaches(): Promise<void> {
  try {
    await Storage.removeItem(HOME_KEY);
    await Storage.removeItem(CONTACTS_KEY);
    // A different account's ledger would make the next user's entire contact
    // list look "new" and dump it into their phone on first fetch
    await clearSyncedLedger();
  } catch {}
}
