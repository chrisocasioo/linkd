import LiveActivity from '../modules/live-activity';
import { Card, User } from './api';
import { publicCardUrl } from '../constants/config';
import { buildVcard } from './vcard';

export async function endCardLiveActivity(): Promise<void> {
  try {
    await LiveActivity.end();
  } catch {
    // Best-effort — ending must never throw into the caller
  }
}

/**
 * Called whenever the user taps the SHARE button that opens the Share Sheet
 * (not the Share action within it). iOS handles the rest: it shows its own
 * Allow/Don't Allow prompt over the very first Live Activity this app ever
 * starts, and silently no-ops here (via areActivitiesEnabled) if the user
 * has since turned Live Activities off for Linkd in Settings.
 *
 * The Live Activity carries both the online (URL) and offline (vCard) QR
 * values so its own on-card toggle can flip between them without needing
 * the app running.
 */
export async function triggerLiveActivityOnShare(card: Card, user: User | null, username: string): Promise<void> {
  try {
    const onlineUrl = publicCardUrl(username, card.slug);
    const offlineValue = buildVcard(card, user, onlineUrl, { compact: true });
    await LiveActivity.start({
      cardId: card.id,
      name: card.name,
      title: card.fields.find((f) => f.type === 'title')?.value ?? '',
      company: card.fields.find((f) => f.type === 'company')?.value ?? '',
      accentColor: card.accentColor,
      onlineUrl,
      offlineValue,
      qrColor: card.qrColor ?? '#000000',
      qrBgColor: card.qrBgColor ?? '#FFFFFF',
      qrLogoUrl: card.qrLogo ?? '',
    });
  } catch {
    // Best-effort — a Live Activity failing must never affect sharing itself
  }
}
