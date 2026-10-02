import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

/**
 * Asks for photo access before a picker opens. With iOS "Limited Photos" access
 * the system's "Keep Current Selection / Select More Photos" prompt fires on the
 * first library read — which used to be the picker's post-selection asset lookup,
 * so it appeared after the photo was chosen. Touching the library here makes it
 * appear up front instead (once per launch; iOS then stays quiet).
 */
export async function ensurePhotoAccess(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') return false;
  if ((perm as any).accessPrivileges === 'limited') {
    try {
      await MediaLibrary.getAssetsAsync({ first: 1, mediaType: 'photo' });
    } catch {
      // Only here to surface the system prompt early — never block picking
    }
  }
  return true;
}
