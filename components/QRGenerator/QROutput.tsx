import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, FONTS } from '../../constants/colors';
import { saveLocalQR } from '../../lib/localLibrary';
import { QRType } from '../../lib/qr';

interface Props {
  type: QRType;
  value: string;
  label: string;
}

async function captureQR(svgRef: React.MutableRefObject<any>): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!svgRef.current) {
      reject(new Error('QR ref not ready'));
      return;
    }
    svgRef.current.toDataURL((data: string) => {
      const path = `${FileSystem.cacheDirectory}qr_${Date.now()}.png`;
      const base64 = data.replace(/^data:image\/\w+;base64,/, '');
      FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      })
        .then(() => resolve(path))
        .catch(reject);
    });
  });
}

export function QROutput({ type, value, label }: Props) {
  const svgRef = useRef<any>(null);

  useEffect(() => {
    saveLocalQR({ type, label, data: value }).catch(() => {});
  }, []);

  const handleShare = async () => {
    try {
      const path = await captureQR(svgRef);
      await Sharing.shareAsync(path, { mimeType: 'image/png', dialogTitle: 'Share QR Code' });
    } catch (e: any) {
      Alert.alert('Share Error', e?.message ?? String(e));
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.qrBox}>
        <QRCode
          value={value}
          size={160}
          color="#111"
          backgroundColor="#fff"
          getRef={(c) => { svgRef.current = c; }}
        />
      </View>

      <Text style={styles.qrLabel} numberOfLines={1}>
        {label}
      </Text>

      <Pressable style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnIcon}>↑</Text>
        <Text style={styles.shareBtnText}>Share</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  qrBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
  },
  qrLabel: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    maxWidth: 220,
    textAlign: 'center',
  },
  shareBtn: {
    width: '100%',
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  shareBtnIcon: {
    fontSize: 15,
    color: '#fff',
    fontFamily: FONTS.medium,
  },
  shareBtnText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: '#fff',
  },
});
