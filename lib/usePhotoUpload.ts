import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useApi } from './api';

export function usePhotoUpload(onSuccess: (photoUrl: string) => void) {
  const api = useApi();
  const [uploading, setUploading] = useState(false);

  const pick = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setUploading(true);
    try {
      const { photoUrl } = await api.uploadPhoto(result.assets[0].uri);
      onSuccess(photoUrl);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [api, onSuccess]);

  return { pick, uploading };
}
