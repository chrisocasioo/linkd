import * as FileSystem from 'expo-file-system/legacy';
import { Card, User } from './api';

/**
 * Downloads the picture that should represent this card in someone's Contacts:
 * the card's own photo, else the owner's profile photo. Returns a local file
 * URI plus its base64 (for embedding in a .vcf), or null if there is none.
 */
export async function downloadContactPhoto(
  card: Card,
  user: User | null
): Promise<{ uri: string; base64: string } | null> {
  const source = card.photo ?? user?.profilePhoto ?? null;
  if (!source) return null;
  const dest = `${FileSystem.cacheDirectory}contact-photo-${card.id}.jpg`;
  try {
    const { uri } = await FileSystem.downloadAsync(source, dest);
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
    return base64 ? { uri, base64 } : null;
  } catch {
    // A missing photo must never block adding the contact
    return null;
  }
}
