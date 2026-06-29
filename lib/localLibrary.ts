import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedQR } from './api';

const KEY = '@linkd/qr_library';

export async function getLocalQRs(): Promise<SavedQR[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveLocalQR(
  qr: Pick<SavedQR, 'type' | 'label' | 'data'>
): Promise<SavedQR> {
  const all = await getLocalQRs();
  const entry: SavedQR = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type: qr.type,
    label: qr.label,
    data: qr.data,
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify([entry, ...all]));
  return entry;
}

export async function deleteLocalQR(id: string): Promise<void> {
  const all = await getLocalQRs();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((q) => q.id !== id)));
}
