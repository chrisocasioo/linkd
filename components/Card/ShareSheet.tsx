import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, FONTS } from '../../constants/colors';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.55;

interface Props {
  visible: boolean;
  username: string;
  onClose: () => void;
}

export function ShareSheet({ visible, username, onClose }: Props) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const url = `https://linkd.tattoo/${username}`;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleShare = async () => {
    await Share.share({ message: url });
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(url);
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <View style={styles.content}>
          <View style={styles.titleBlock}>
            <Text style={styles.heading}>Your Card QR</Text>
            <Text style={styles.sub}>Someone scans this to open your card</Text>
          </View>

          <View style={styles.qrOuter}>
            <View style={styles.qrInner}>
              <QRCode value={url} size={120} backgroundColor="#fff" color="#000" />
            </View>
          </View>

          <Pressable style={styles.btnPrimary} onPress={handleShare}>
            <Text style={styles.btnPrimaryText}>Share</Text>
          </Pressable>
          <Pressable onPress={handleCopy}>
            <Text style={styles.copyLink}>Copy Link</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#161618',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 16, marginBottom: 2 },
  content: { padding: 18, paddingBottom: 32, gap: 12, alignItems: 'center' },
  titleBlock: { alignItems: 'center', gap: 3 },
  heading: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.2 },
  sub: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  qrOuter: {
    width: '100%', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 18, alignItems: 'center', justifyContent: 'center',
  },
  qrInner: { padding: 9, backgroundColor: '#fff', borderRadius: 10 },
  btnPrimary: { width: '100%', height: 46, borderRadius: 13, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
  copyLink: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary, paddingVertical: 4 },
});
