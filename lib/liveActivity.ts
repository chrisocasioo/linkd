import { Alert } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import LiveActivity from '../modules/live-activity';
import { publicCardUrl } from '../constants/config';
import { Card } from './api';

// ActivityKit has no system permission dialog of its own — this is our own
// ask-once-then-remember flag standing in for one.
const PERMISSION_KEY = 'linkd.liveActivityPermission.v1'; // 'granted' | 'denied'

async function startCardLiveActivity(card: Card, username: string): Promise<boolean> {
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

/**
 * Called whenever the user taps Share on a card. The first time ever, asks
 * whether to keep that card's QR on the Lock Screen; every share after that
 * silently follows whatever they chose, with no repeat prompting.
 */
export async function triggerLiveActivityOnShare(card: Card, username: string): Promise<void> {
  try {
    let permission = await Storage.getItem(PERMISSION_KEY);

    if (permission === null) {
      permission = await new Promise<string>((resolve) => {
        Alert.alert(
          'Show on Lock Screen?',
          "Linkd can keep this card's QR code on your Lock Screen while it's out — people nearby can scan it straight from there.",
          [
            { text: 'Not Now', style: 'cancel', onPress: () => resolve('denied') },
            { text: 'Allow', onPress: () => resolve('granted') },
          ]
        );
      });
      await Storage.setItem(PERMISSION_KEY, permission);
    }

    if (permission === 'granted') {
      await startCardLiveActivity(card, username);
    }
  } catch {
    // Best-effort — a Live Activity failing must never affect sharing itself
  }
}
