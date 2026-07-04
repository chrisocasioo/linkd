import * as ExpoContacts from 'expo-contacts/legacy';
import Storage from 'expo-sqlite/kv-store';
import type { Contact } from './api';

// iOS shows the system prompt only on the first call; afterwards this just
// reports the remembered choice.
export async function requestContactsPermission(): Promise<boolean> {
  try {
    const { status } = await ExpoContacts.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// Mirrors a Linkd contact into the phone's native address book. A denied
// permission or a native failure never blocks the in-app save. Returns
// whether the contact was actually written.
export async function saveContactToPhone(c: Partial<Contact>): Promise<boolean> {
  try {
    const { status } = await ExpoContacts.getPermissionsAsync();
    if (status !== 'granted') return false;

    const native: any = {
      contactType: 'person',
      firstName: c.firstName ?? '',
      lastName: c.lastName ?? '',
      company: c.company ?? '',
      jobTitle: c.jobTitle ?? '',
      emails: c.email ? [{ label: 'work', email: c.email }] : [],
      phoneNumbers: c.phone ? [{ label: 'mobile', number: c.phone }] : [],
      urlAddresses: c.website ? [{ label: 'website', url: c.website }] : [],
      note: c.notes ?? '',
    };
    await ExpoContacts.addContactAsync(native);
    return true;
  } catch {
    return false;
  }
}

// ── Synced-to-phone ledger ────────────────────────────────────────────────────
// Contacts can also be created server-side (someone fills the exchange form on
// a public card), so the app can't write them to the phone at creation time.
// Instead we track which contact IDs have been mirrored and, on every fetch,
// write the ones the phone hasn't seen yet.

const SYNCED_KEY = 'linkd.contacts.syncedToPhone.v1';

async function loadSyncedIds(): Promise<Set<string> | null> {
  try {
    const raw = await Storage.getItem(SYNCED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

async function saveSyncedIds(ids: Set<string>): Promise<void> {
  try {
    await Storage.setItem(SYNCED_KEY, JSON.stringify([...ids]));
  } catch {}
}

export async function markSyncedToPhone(id: string): Promise<void> {
  const ids = await loadSyncedIds();
  // No ledger yet means the seeding pass below hasn't run; it will pick this
  // contact up along with everything else already in the list.
  if (!ids) return;
  ids.add(id);
  await saveSyncedIds(ids);
}

export async function syncNewContactsToPhone(contacts: Contact[]): Promise<void> {
  const synced = await loadSyncedIds();

  // First run: seed the ledger with everything already in the list instead of
  // dumping the user's whole history into their phone (some of it may already
  // be there). Only contacts that arrive after this point get mirrored.
  if (!synced) {
    await saveSyncedIds(new Set(contacts.map((c) => c.id)));
    return;
  }

  const fresh = contacts.filter((c) => !synced.has(c.id));
  if (fresh.length === 0) return;

  let changed = false;
  for (const c of fresh) {
    // A failed write (e.g. permission denied) stays unmarked so it retries
    // on a later fetch once permission is granted.
    if (await saveContactToPhone(c)) {
      synced.add(c.id);
      changed = true;
    }
  }
  if (changed) await saveSyncedIds(synced);
}

export async function clearSyncedLedger(): Promise<void> {
  try {
    await Storage.removeItem(SYNCED_KEY);
  } catch {}
}
