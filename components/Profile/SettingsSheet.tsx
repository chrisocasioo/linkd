import { useAuth } from '@clerk/clerk-expo';
import { useClerk } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRevenueCat } from '../../lib/RevenueCatContext';
import { useApi } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onReorderLinks: () => void;
  onShowPaywall: () => void;
}

interface RowProps {
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function SettingsRow({ label, onPress, danger }: RowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function SettingsSheet({ visible, onClose, onEditProfile, onReorderLinks, onShowPaywall }: Props) {
  const { signOut } = useAuth();
  const { user } = useClerk();
  const api = useApi();
  const router = useRouter();
  const { isPro } = useRevenueCat();
  const translateY = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }).start();
    } else {
      Animated.timing(translateY, { toValue: 500, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: true }).start();
    }
  }, [visible, translateY]);

  const handleSignOut = async () => {
    onClose();
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch {}
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteMe().catch(() => {});
              await user?.delete();
              await signOut();
              router.replace('/(auth)/sign-in');
            } catch {
              Alert.alert('Error', 'Could not delete account. Try again later.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.flex}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Settings</Text>

          <View style={styles.list}>
            <SettingsRow label="Edit Profile" onPress={() => { onClose(); setTimeout(onEditProfile, 300); }} />
            <View style={styles.separator} />
            <SettingsRow label="Reorder Links" onPress={() => { onClose(); setTimeout(onReorderLinks, 300); }} />
            <View style={styles.separator} />
            <SettingsRow
              label={isPro ? 'Analytics' : 'Analytics  🔒'}
              onPress={() => {
                onClose();
                if (isPro) {
                  setTimeout(() => router.push('/analytics'), 300);
                } else {
                  setTimeout(onShowPaywall, 300);
                }
              }}
            />
          </View>

          <View style={styles.list}>
            <SettingsRow
              label="Privacy Policy"
              onPress={() => WebBrowser.openBrowserAsync('https://chrisocasioo.github.io/Linkd-Legal/privacy.html')}
            />
            <View style={styles.separator} />
            <SettingsRow
              label="Support"
              onPress={() => WebBrowser.openBrowserAsync('https://chrisocasioo.github.io/Linkd-Legal/support.html')}
            />
          </View>

          <View style={styles.list}>
            <SettingsRow label="Sign Out" onPress={handleSignOut} />
            <View style={styles.separator} />
            <SettingsRow label="Delete Account" onPress={handleDeleteAccount} danger />
          </View>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
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
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 4 },
  title: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.3 },
  list: { backgroundColor: COLORS.surface2, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  row: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 15, fontFamily: FONTS.regular, color: COLORS.text },
  rowLabelDanger: { color: COLORS.danger },
  chevron: { fontSize: 18, color: COLORS.textTertiary },
  separator: { height: 1, backgroundColor: COLORS.border },
  cancelBtn: { height: 52, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.textSecondary },
});
