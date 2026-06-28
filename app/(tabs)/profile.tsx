import { useAuth, useUser } from '@clerk/clerk-expo';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { EditProfileSheet } from '../../components/Profile/EditProfileSheet';
import { QRDetail } from '../../components/Profile/QRDetail';
import { QRLibrary } from '../../components/Profile/QRLibrary';
import { SettingsSheet } from '../../components/Profile/SettingsSheet';
import { COLORS, FONTS } from '../../constants/colors';
import { SavedQR, useApi } from '../../lib/api';

function GearIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={2.5} stroke="rgba(245,245,245,0.7)" strokeWidth={1.5} />
      <Path
        d="M10 1v2M10 17v2M1 10h2M17 10h2M3.22 3.22l1.42 1.42M15.36 15.36l1.42 1.42M3.22 16.78l1.42-1.42M15.36 4.64l1.42-1.42"
        stroke="rgba(245,245,245,0.7)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function ProfileScreen() {
  const { user } = useUser();
  const api = useApi();

  const [qrs, setQRs] = useState<SavedQR[]>([]);
  const [loadingQRs, setLoadingQRs] = useState(true);
  const [selectedQR, setSelectedQR] = useState<SavedQR | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const displayName =
    user?.fullName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const initial = displayName.charAt(0).toUpperCase();

  const loadQRs = useCallback(async () => {
    try {
      const data = await api.getQRs();
      setQRs(data);
    } catch {
      // API may not be configured yet
    } finally {
      setLoadingQRs(false);
    }
  }, [api]);

  useEffect(() => {
    loadQRs();
  }, [loadQRs]);

  const handleDeleteQR = async (id: string) => {
    try {
      await api.deleteQR(id);
      setQRs((prev) => prev.filter((q) => q.id !== id));
      setSelectedQR(null);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Pressable style={styles.gearBtn} onPress={() => setShowSettings(true)}>
          <GearIcon />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{email}</Text>
          </View>
          <Pressable style={styles.editBtn} onPress={() => setShowEdit(true)}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionHeader}>Saved QR Codes</Text>

        <QRLibrary
          qrs={qrs}
          loading={loadingQRs}
          onSelect={setSelectedQR}
        />
      </ScrollView>

      {selectedQR && (
        <QRDetail
          qr={selectedQR}
          onClose={() => setSelectedQR(null)}
          onDelete={handleDeleteQR}
        />
      )}

      <EditProfileSheet
        visible={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={loadQRs}
      />

      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 12, paddingBottom: 40 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.accentDim,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontFamily: FONTS.semiBold,
    color: COLORS.accent,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  sectionHeader: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
});
