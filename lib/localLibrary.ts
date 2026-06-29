import * as FileSystem from 'expo-file-system/legacy';
import { SavedQR } from './api';

const FILE = `${FileSystem.documentDirectory}linkd_library.json`;

export async function getLocalQRs(): Promise<SavedQR[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FILE);
    return JSON.parse(raw);
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
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify([entry, ...all]));
  return entry;
}

export async function deleteLocalQR(id: string): Promise<void> {
  const all = await getLocalQRs();
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(all.filter((q) => q.id !== id)));
}
