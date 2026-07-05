import { ExtensionStorage } from '@bacons/apple-targets';
import { publicCardUrl } from '../constants/config';
import { Card } from './api';

// Must match the App Group entitlement in app.json and targets/widget/expo-target.config.js
const APP_GROUP = 'group.com.santrico.linkd';

/**
 * Pushes every card's widget-relevant fields into the shared App Group
 * container so the WidgetKit extension can render them and list them in its
 * "Edit Widget" card picker. The widget never calls our API directly — it
 * only ever reads whatever snapshot this last wrote.
 *
 * Best-effort: on Android, or if the native module isn't present, this is a
 * silent no-op. A sync failure must never affect the app itself.
 */
export function syncWidgetData(cards: Card[], username: string): void {
  try {
    const storage = new ExtensionStorage(APP_GROUP);
    const payload = cards.map((c) => ({
      id: c.id,
      name: c.name,
      accentColor: c.accentColor,
      username,
      slug: c.slug ?? '',
      title: c.fields.find((f) => f.type === 'title')?.value ?? '',
      company: c.fields.find((f) => f.type === 'company')?.value ?? '',
      publicUrl: publicCardUrl(username, c.slug),
    }));
    storage.set('cards', payload);
    ExtensionStorage.reloadWidget();
  } catch {
    // Best-effort — widget sync must never affect the app
  }
}
