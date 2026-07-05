import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { inferQrFormat, parseWifiQr } from '../../lib/qrFormat';
import { COLORS, FONTS } from '../../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  value: string | null;
  onClose: () => void;
}

export function QrScanResultSheet({ visible, value, onClose }: Props) {
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!value) return null;

  const format = inferQrFormat(value);
  const wifi = format === 'wifi' ? parseWifiQr(value) : null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.icon}>
              <Ionicons
                name={format === 'wifi' ? 'wifi' : format === 'url' ? 'link' : 'qr-code-outline'}
                size={20}
                color={COLORS.accent}
              />
            </View>
            <Text style={styles.title}>
              {format === 'wifi' ? 'Wi-Fi Network' : format === 'url' ? 'Link' : 'QR Code'}
            </Text>
          </View>

          <View style={styles.body}>
            {wifi ? (
              <>
                <Row label="Network" value={wifi.ssid} />
                {wifi.password ? <Row label="Password" value={wifi.password} /> : null}
                {wifi.password && (
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => Clipboard.setStringAsync(wifi.password)}
                  >
                    <Ionicons name="copy-outline" size={16} color="#0C0C0E" />
                    <Text style={styles.actionBtnText}>Copy Password</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <Text style={styles.value} numberOfLines={4}>{value}</Text>
                <View style={styles.actionRow}>
                  {format === 'url' && (
                    <Pressable
                      style={[styles.actionBtn, { flex: 1 }]}
                      onPress={() => Linking.openURL(value.startsWith('http') ? value : `https://${value}`)}
                    >
                      <Ionicons name="open-outline" size={16} color="#0C0C0E" />
                      <Text style={styles.actionBtnText}>Open Link</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.actionBtnOutline, { flex: format === 'url' ? undefined : 1 }]}
                    onPress={() => Clipboard.setStringAsync(value)}
                  >
                    <Ionicons name="copy-outline" size={16} color={COLORS.text} />
                    <Text style={styles.actionBtnOutlineText}>Copy</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>

          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 36,
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  icon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text },
  body: { paddingHorizontal: 20, gap: 10 },
  value: {
    fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text,
    backgroundColor: COLORS.surface2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 12,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    backgroundColor: COLORS.surface2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  rowLabel: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  rowValue: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.text, flexShrink: 1 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: 12, backgroundColor: COLORS.accent,
  },
  actionBtnText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
  actionBtnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  actionBtnOutlineText: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.text },
  doneBtn: { marginHorizontal: 20, marginTop: 14, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  doneBtnText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
});
