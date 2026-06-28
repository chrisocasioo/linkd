import { useUser } from '@clerk/clerk-expo';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS } from '../../constants/colors';
import { useApi } from '../../lib/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditProfileSheet({ visible, onClose, onSaved }: Props) {
  const { user } = useUser();
  const api = useApi();
  const translateY = useRef(new Animated.Value(500)).current;

  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDisplayName(user?.fullName ?? '');
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: 500,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY, user]);

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await user?.update({ firstName: displayName.trim() });
      await api.updateMe({ displayName: displayName.trim() }).catch(() => {});
      onSaved();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not update display name.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'A password reset email will be sent to your email address.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Reset Email', onPress: () => {} },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Edit Profile</Text>

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
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyText}>
                {user?.primaryEmailAddress?.emailAddress ?? ''}
              </Text>
              <Text style={styles.readonlyBadge}>Managed by Clerk</Text>
            </View>
          </View>

          <Pressable style={styles.changePasswordBtn} onPress={handleChangePassword}>
            <Text style={styles.changePasswordText}>Change password →</Text>
          </Pressable>

          <Pressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
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
    padding: 24,
    paddingBottom: 40,
    gap: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  input: {
    height: 48,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  readonlyField: {
    height: 48,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readonlyText: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  readonlyBadge: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  changePasswordBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  changePasswordText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.accent },
  saveBtn: {
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#fff' },
});
