import LiveActivity from '../modules/live-activity';
import { publicCardUrl } from '../constants/config';
import { Card } from './api';

/**
 * Starts (replacing any currently running one) the Lock Screen Live
 * Activity for a single card. Returns whether it actually started — false
 * if the user has Live Activities disabled for the app, or on any platform
 * where the native module is a no-op stub.
 */
export async function startCardLiveActivity(card: Card, username: string): Promise<boolean> {
  try {
    return await LiveActivity.start({
      cardId: card.id,
      name: card.name,
      title: card.fields.find((f) => f.type === 'title')?.value ?? '',
      company: card.fields.find((f) => f.type === 'company')?.value ?? '',
      accentColor: card.accentColor,
      publicUrl: publicCardUrl(username, card.slug),
    });
  } catch {
    return false;
  }
}

export async function endCardLiveActivity(): Promise<void> {
  try {
    await LiveActivity.end();
  } catch {
    // Best-effort — ending must never throw into the caller
  }
}

export async function isCardLiveActivityRunning(): Promise<boolean> {
  try {
    return await LiveActivity.isRunning();
  } catch {
    return false;
  }
}
