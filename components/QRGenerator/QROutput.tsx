import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, FONTS } from '../../constants/colors';
import { QRType, getQRLabel } from '../../lib/qr';
import { saveLocalQR } from '../../lib/localLibrary';

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
      // Strip data URI prefix if present (react-native-svg adds it in some versions)
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
  const [mediaStatus, requestMediaPermission] = MediaLibrary.usePermissions();
  const [savingLib, setSavingLib] = useState(false);

  const handleSaveRoll = async () => {
    const status = mediaStatus?.granted
      ? mediaStatus
      : await requestMediaPermission();
    if (!status.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to save QR codes.');
      return;
    }
    try {
      const path = await captureQR(svgRef);
      await MediaLibrary.saveToLibraryAsync(path);
      Alert.alert('Saved!', 'QR code saved to your photo library.');
    } catch (e: any) {
      Alert.alert('Save Error', e?.message ?? String(e));
    }
  };

  const handleShare = async () => {
    try {
      const path = await captureQR(svgRef);
      await Sharing.shareAsync(path, { mimeType: 'image/png', dialogTitle: 'Share QR Code' });
    } catch (e: any) {
      Alert.alert('Share Error', e?.message ?? String(e));
    }
  };

  const handleAddToLibrary = async () => {
    setSavingLib(true);
    try {
      await saveLocalQR({ type, label, data: value });
      Alert.alert('Added!', 'QR code saved to your library.');
    } catch (e: any) {
      Alert.alert('Library Error', e?.message ?? String(e));
    } finally {
      setSavingLib(false);
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

      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={handleSaveRoll}>
          <Text style={styles.btnIcon}>↓</Text>
          <Text style={styles.btnText}>Save</Text>
        </Pressable>

        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleShare}>
          <Text style={[styles.btnIcon, styles.btnIconPrimary]}>↑</Text>
          <Text style={[styles.btnText, styles.btnTextPrimary]}>Share</Text>
        </Pressable>

        <Pressable style={styles.btn} onPress={handleAddToLibrary} disabled={savingLib}>
          <Text style={styles.btnIcon}>+</Text>
          <Text style={styles.btnText}>{savingLib ? '…' : 'Library'}</Text>
        </Pressable>
      </View>
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
  actions: { flexDirection: 'row', gap: 8, width: '100%' },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  btnPrimary: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  btnIcon: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  btnIconPrimary: { color: '#fff' },
  btnText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  btnTextPrimary: { color: '#fff', fontFamily: FONTS.semiBold },
});
