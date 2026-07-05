import LiveActivity from '../modules/live-activity';
import { publicCardUrl } from '../constants/config';
import { Card } from './api';

export async function endCardLiveActivity(): Promise<void> {
  try {
    await LiveActivity.end();
  } catch {
    // Best-effort — ending must never throw into the caller
  }
}

/**
 * Called whenever the user taps Share on a card. The native side decides
 * whether this is the very first Live Activity ever (in which case the Lock
 * Screen card itself shows an Allow/Not Now ask instead of the QR) or
 * whether permission was already settled there — this call is identical
 * either way.
 */
export async function triggerLiveActivityOnShare(card: Card, username: string): Promise<void> {
  try {
    await LiveActivity.start({
      cardId: card.id,
      name: card.name,
      title: card.fields.find((f) => f.type === 'title')?.value ?? '',
      company: card.fields.find((f) => f.type === 'company')?.value ?? '',
      accentColor: card.accentColor,
      publicUrl: publicCardUrl(username, card.slug),
    });
  } catch {
    // Best-effort — a Live Activity failing must never affect sharing itself
  }
}
