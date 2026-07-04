import * as ExpoContacts from 'expo-contacts/legacy';
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
// permission or a native failure never blocks the in-app save.
export async function saveContactToPhone(c: Partial<Contact>): Promise<void> {
  try {
    const { status } = await ExpoContacts.getPermissionsAsync();
    if (status !== 'granted') return;

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
  } catch {}
}
