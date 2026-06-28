import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useRef } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, FONTS } from '../../constants/colors';
import { SavedQR } from '../../lib/api';

interface Props {
  qr: SavedQR;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function QRDetail({ qr, onClose, onDelete }: Props) {
  const svgRef = useRef<any>(null);

  const handleShare = async () => {
    if (!svgRef.current) return;
    svgRef.current.toDataURL(async (data: string) => {
      try {
        const path = `${FileSystem.cacheDirectory}qr_${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(path, data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(path, { mimeType: 'image/png' });
      } catch {
        Alert.alert('Error', 'Could not share QR code.');
      }
    });
  };

  const confirmDelete = () => {
    Alert.alert('Delete QR Code', 'This QR code will be removed from your library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete(qr.id),
      },
    ]);
  };

  const typeLabel = qr.type === 'url' ? 'URL' : 'WiFi';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>← Back</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.qrBox}>
            <QRCode
              value={qr.data}
              size={220}
              color="#111"
              backgroundColor="#fff"
              getRef={(c) => { svgRef.current = c; }}
            />
          </View>

          <Text style={styles.label} numberOfLines={2}>
            {qr.label ?? qr.data}
          </Text>

          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{typeLabel}</Text>
          </View>

          <Text style={styles.dataText} numberOfLines={3} selectable>
            {qr.data}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>↑ Share</Text>
          </Pressable>

          <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  closeBtn: { alignSelf: 'flex-start' },
  closeBtnText: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.accent },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  qrBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  label: {
    fontSize: 20,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginTop: 8,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.accentDim,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  typeText: { fontSize: 11, fontFamily: FONTS.semiBold, color: COLORS.accent, letterSpacing: 0.5 },
  dataText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  actions: { padding: 24, gap: 10, paddingBottom: 32 },
  shareBtn: {
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#fff' },
  deleteBtn: {
    height: 48,
    backgroundColor: 'rgba(255,90,90,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.25)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.danger },
});
