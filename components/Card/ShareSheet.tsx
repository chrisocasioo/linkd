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
          <Text style={styles.heading}>Share Your Card</Text>
          <Text style={styles.url}>{url}</Text>

          <View style={styles.qrContainer}>
            <QRCode value={url} size={180} backgroundColor="#fff" color="#000" />
          </View>

          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleShare}>
              <Text style={styles.btnPrimaryText}>Share</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={handleCopy}>
              <Text style={styles.btnSecondaryText}>Copy Link</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  content: { padding: 24, alignItems: 'center', gap: 16 },
  heading: { fontSize: 20, fontFamily: FONTS.semiBold, color: COLORS.text },
  url: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  qrContainer: { padding: 12, backgroundColor: '#fff', borderRadius: 16 },
  buttons: { flexDirection: 'row', gap: 12, width: '100%' },
  btn: { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: COLORS.accent },
  btnPrimaryText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#fff' },
  btnSecondary: { backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border },
  btnSecondaryText: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.text },
});
