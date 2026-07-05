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
 * Called whenever the user taps Share on a card. iOS handles the rest: it
 * shows its own Allow/Don't Allow prompt over the very first Live Activity
 * this app ever starts, and silently no-ops here (via areActivitiesEnabled)
 * if the user has since turned Live Activities off for Linkd in Settings.
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
