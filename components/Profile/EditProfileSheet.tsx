import { useUser } from '@clerk/clerk-expo';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { UsernameInput } from '../Card/UsernameInput';
import { useApi, User } from '../../lib/api';
import { usePhotoUpload } from '../../lib/usePhotoUpload';
import { COLORS, FONTS } from '../../constants/colors';

interface Props {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onSaved: (updated: User) => void;
}

export function EditProfileSheet({ visible, user, onClose, onSaved }: Props) {
  const { user: clerkUser } = useUser();
  const api = useApi();
  const translateY = useRef(new Animated.Value(500)).current;

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      setDisplayName(user.displayName ?? '');
      setUsername(user.username ?? '');
      setBio(user.bio ?? '');
      setPhotoUrl(user.profilePhoto);
      Animated.spring(translateY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }).start();
    } else {
      Animated.timing(translateY, { toValue: 500, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: true }).start();
    }
  }, [visible, user]);

  const handlePhotoSuccess = useCallback((url: string) => setPhotoUrl(url), []);
  const { pick: pickPhoto, uploading } = usePhotoUpload(handlePhotoSuccess);

  const handleSave = async () => {
    if (!displayName.trim()) return Alert.alert('Display name required');
    setSaving(true);
    try {
      if (displayName !== user?.displayName) {
        await clerkUser?.update({ firstName: displayName.trim() }).catch(() => {});
      }
      const updated = await api.updateMe({
        displayName: displayName.trim(),
        username: username || undefined,
        bio: bio || undefined,
      });
      onSaved(updated);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Edit Profile</Text>

            <Pressable style={styles.photoWrapper} onPress={pickPhoto} disabled={uploading}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>+</Text>
                </View>
              )}
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText}>{uploading ? '…' : '✎'}</Text>
              </View>
            </Pressable>

            <View style={styles.field}>
              <Text style={styles.label}>DISPLAY NAME</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={COLORS.textTertiary}
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>USERNAME</Text>
              <UsernameInput value={username} onChange={setUsername} currentUsername={user?.username ?? undefined} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>BIO</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="A short bio…"
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            <Pressable
              style={[styles.saveBtn, (saving || uploading) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving || uploading}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 12 },
  content: { padding: 24, paddingBottom: 40, gap: 16 },
  title: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.3 },
  photoWrapper: { alignSelf: 'center', marginBottom: 8 },
  photo: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: COLORS.accent },
  photoPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface2, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 28, color: COLORS.textSecondary },
  photoBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  photoBadgeText: { fontSize: 12, color: '#fff' },
  field: { gap: 6 },
  label: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 1, textTransform: 'uppercase', paddingLeft: 4 },
  input: { height: 48, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 16, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.text },
  bioInput: { height: 80, paddingTop: 12, paddingBottom: 12 },
  saveBtn: { height: 52, backgroundColor: COLORS.accent, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#fff' },
});
