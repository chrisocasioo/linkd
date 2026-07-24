import { ExtensionStorage } from '@bacons/apple-targets';
import * as FileSystem from 'expo-file-system/legacy';
import { publicCardUrl } from '../constants/config';
import { Card, User } from './api';
import { buildVcard } from './vcard';

// Must match the App Group entitlement in app.json and targets/widget/expo-target.config.js
const APP_GROUP = 'group.com.santrico.linkd';

// The widget extension avoids making its own network calls during timeline
// generation — the logo is fetched here instead and shipped as base64 in the
// same JSON payload the rest of the card data already travels through.
async function fetchLogoBase64(url: string): Promise<string> {
  const dest = `${FileSystem.cacheDirectory}widget-qr-logo-${Date.now()}.jpg`;
  try {
    const { uri } = await FileSystem.downloadAsync(url, dest);
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
    return base64;
  } catch {
    return '';
  } finally {
    FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
  }
}

/**
 * Pushes every card's widget-relevant fields into the shared App Group
 * container so the WidgetKit extension can render them and list them in its
 * "Edit Widget" card picker. The widget never calls our API directly — it
 * only ever reads whatever snapshot this last wrote.
 *
 * Best-effort: on Android, or if the native module isn't present, this is a
 * silent no-op. A sync failure must never affect the app itself.
 */
export async function syncWidgetData(cards: Card[], user: User | null, username: string): Promise<void> {
  try {
    const storage = new ExtensionStorage(APP_GROUP);
    const payload = await Promise.all(cards.map(async (c) => {
      const publicUrl = publicCardUrl(username, c.slug);
      return {
        id: c.id,
        // The card's own label (e.g. "Work") — kept separate from
        // personName below since this is what lets someone tell their cards
        // apart in the "Edit Widget" picker; it was never meant to be shown
        // as a person's name on the widget face itself.
        name: c.name,
        personName: c.displayName ?? user?.displayName ?? user?.username ?? c.name,
        accentColor: c.accentColor,
        username,
        slug: c.slug ?? '',
        title: c.fields.find((f) => f.type === 'title')?.value ?? '',
        company: c.fields.find((f) => f.type === 'company')?.value ?? '',
        publicUrl,
        // The medium "card" widget's online/offline toggle needs both values
        // up front — it can't call the app to build a vCard on the fly.
        offlineValue: buildVcard(c, user, publicUrl, { compact: true }),
        // Applies the card's actual QR branding instead of a hardcoded
        // black-on-white QR — no reason the widget should look different
        // from what the user configured in the app.
        qrColor: c.qrColor ?? '#000000',
        qrBgColor: c.qrBgColor ?? '#FFFFFF',
        qrLogoBase64: c.qrLogo ? await fetchLogoBase64(c.qrLogo) : '',
      };
    }));
    storage.set('cards', payload);
    ExtensionStorage.reloadWidget();
  } catch {
    // Best-effort — widget sync must never affect the app
  }
}
