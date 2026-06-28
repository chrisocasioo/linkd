import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS } from '../../constants/colors';

interface Props {
  data: string;
  type: 'url' | 'wifi' | 'text';
  onDismiss: () => void;
}

function parseWiFi(raw: string) {
  const ssid = raw.match(/S:([^;\\]+)/)?.[1] ?? '';
  const password = raw.match(/P:([^;\\]+)/)?.[1] ?? '';
  const security = raw.match(/T:([^;]+)/)?.[1] ?? '';
  return { ssid, password, security };
}

function TypeBadge({ type }: { type: 'url' | 'wifi' | 'text' }) {
  const labels = { url: 'URL', wifi: 'WiFi', text: 'Text' };
  return (
    <View style={[styles.badge, styles[`badge_${type}`]]}>
      <Text style={styles.badgeText}>{labels[type]}</Text>
    </View>
  );
}

export function ScanResult({ data, type, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: 300,
      duration: 220,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(onDismiss);
  };

  const handlePrimaryAction = async () => {
    if (type === 'url') {
      await WebBrowser.openBrowserAsync(data).catch(() =>
        Linking.openURL(data).catch(() => Alert.alert('Error', 'Cannot open URL.'))
      );
    } else if (type === 'wifi') {
      await Linking.openURL('App-prefs:WIFI').catch(() =>
        Alert.alert('WiFi', 'Go to Settings > Wi-Fi to connect manually.')
      );
    } else {
      await Clipboard.setStringAsync(data);
      Alert.alert('Copied!', 'Text copied to clipboard.');
    }
  };

  const wifiInfo = type === 'wifi' ? parseWiFi(data) : null;

  const primaryLabel = type === 'url' ? 'Open in Browser' : type === 'wifi' ? 'Connect to WiFi' : 'Copy Text';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={dismiss}
      />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <TypeBadge type={type} />
          <Text style={styles.dismiss} onPress={dismiss}>✕</Text>
        </View>

        <Text style={styles.dataText} numberOfLines={4}>
          {type === 'wifi' && wifiInfo ? `Network: ${wifiInfo.ssid}` : data}
        </Text>

        {wifiInfo && wifiInfo.password ? (
          <View style={styles.wifiDetail}>
            <Text style={styles.wifiRow}>
              <Text style={styles.wifiKey}>Security: </Text>
              <Text style={styles.wifiVal}>{wifiInfo.security}</Text>
            </Text>
            <Text style={styles.wifiRow}>
              <Text style={styles.wifiKey}>Password: </Text>
              <Text style={styles.wifiVal}>{wifiInfo.password}</Text>
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable style={styles.primaryBtn} onPress={handlePrimaryAction}>
            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={dismiss}>
            <Text style={styles.secondaryBtnText}>Scan again</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badge_url: { backgroundColor: 'rgba(201,151,58,0.12)', borderColor: COLORS.accent },
  badge_wifi: { backgroundColor: 'rgba(0,200,177,0.1)', borderColor: '#00C9B1' },
  badge_text: { backgroundColor: COLORS.surface2, borderColor: COLORS.border },
  badgeText: { fontSize: 11, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: 0.5 },
  dismiss: { fontSize: 16, color: COLORS.textSecondary, padding: 4 },
  dataText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    lineHeight: 20,
  },
  wifiDetail: {
    backgroundColor: COLORS.surface2,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wifiRow: { fontSize: 13 },
  wifiKey: { fontFamily: FONTS.medium, color: COLORS.textSecondary },
  wifiVal: { fontFamily: FONTS.regular, color: COLORS.text },
  actions: { gap: 10 },
  primaryBtn: {
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#fff' },
  secondaryBtn: {
    height: 48,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
});
