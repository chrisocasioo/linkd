import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { QR_DEFAULT_LOGO } from '../constants/qrDefaults';

// The widget and Live Activity render their QR natively, so the bundled
// default logo has to be handed over as a file URI / base64 rather than a
// React Native image source.
async function localUri(): Promise<string> {
  try {
    const asset = Asset.fromModule(QR_DEFAULT_LOGO);
    if (!asset.localUri) await asset.downloadAsync();
    return asset.localUri ?? '';
  } catch {
    return '';
  }
}

export async function defaultQrLogoFileUri(): Promise<string> {
  return localUri();
}

export async function defaultQrLogoBase64(): Promise<string> {
  const uri = await localUri();
  if (!uri) return '';
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  } catch {
    return '';
  }
}
