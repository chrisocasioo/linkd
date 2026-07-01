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
  onShowPaywall: () => void;
}

function SettingsRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function SettingsSheet({ visible, onClose, onShowPaywall }: Props) {
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

  const emailDisplay = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? '';
  const emailShort = emailDisplay.length > 16 ? emailDisplay.slice(0, 14) + '…' : emailDisplay;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.flex}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Settings</Text>

          {/* Account */}
          <View style={styles.group}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{emailShort}</Text>
            </View>
            <View style={styles.sep} />
            <SettingsRow
              label="Change Password"
              onPress={() => WebBrowser.openBrowserAsync('https://accounts.linkd.tattoo/user/security')}
            />
          </View>

          {/* Analytics */}
          <View style={styles.group}>
            <Pressable
              style={styles.row}
              onPress={() => {
                onClose();
                if (isPro) setTimeout(() => router.push('/analytics'), 300);
                else setTimeout(onShowPaywall, 300);
              }}
            >
              <Text style={styles.rowLabel}>Analytics</Text>
              <View style={styles.rowRight}>
                {!isPro && <Text style={styles.proBadge}>Pro</Text>}
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          </View>

          {/* Support */}
          <View style={styles.group}>
            <SettingsRow
              label="Support"
              onPress={() => WebBrowser.openBrowserAsync('https://chrisocasioo.github.io/Linkd-Legal/support.html')}
            />
            <View style={styles.sep} />
            <SettingsRow
              label="Privacy Policy"
              onPress={() => WebBrowser.openBrowserAsync('https://chrisocasioo.github.io/Linkd-Legal/privacy.html')}
            />
          </View>

          {/* Danger */}
          <View style={styles.group}>
            <Pressable style={styles.row} onPress={handleSignOut}>
              <Text style={[styles.rowLabel, styles.rowMuted]}>Sign Out</Text>
            </Pressable>
            <View style={styles.sep} />
            <Pressable style={styles.row} onPress={handleDeleteAccount}>
              <Text style={[styles.rowLabel, styles.rowDanger]}>Delete Account</Text>
            </Pressable>
          </View>
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    paddingBottom: 40,
    gap: 10,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 2 },
  title: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.2 },
  group: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, overflow: 'hidden' },
  row: { height: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.text },
  rowValue: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowMuted: { color: COLORS.textSecondary },
  rowDanger: { color: COLORS.danger },
  proBadge: { fontSize: 9, fontFamily: FONTS.medium, color: COLORS.textTertiary, backgroundColor: COLORS.surface2, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  chevron: { fontSize: 13, color: COLORS.textTertiary },
  sep: { height: 1, backgroundColor: COLORS.border },
});
