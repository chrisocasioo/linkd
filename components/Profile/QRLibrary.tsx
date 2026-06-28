import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, FONTS } from '../../constants/colors';
import { SavedQR } from '../../lib/api';

interface Props {
  qrs: SavedQR[];
  loading: boolean;
  onSelect: (qr: SavedQR) => void;
}

function QRCard({ qr, onPress }: { qr: SavedQR; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.qrThumb}>
        <QRCode value={qr.data} size={80} color="#111" backgroundColor="#fff" />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardLabel} numberOfLines={1}>
          {qr.label ?? qr.data}
        </Text>
        <Text style={styles.cardType}>{qr.type.toUpperCase()}</Text>
      </View>
    </Pressable>
  );
}

export function QRLibrary({ qrs, loading, onSelect }: Props) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (qrs.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No saved QR codes yet.</Text>
        <Text style={styles.emptyHint}>
          Generate one and tap <Text style={styles.emptyAccent}>+ Library</Text> to save it here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {qrs.map((qr) => (
        <QRCard key={qr.id} qr={qr} onPress={() => onSelect(qr)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { paddingVertical: 40, alignItems: 'center' },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  emptyHint: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyAccent: { color: COLORS.accent },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '47.5%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  qrThumb: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { gap: 2 },
  cardLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  cardType: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
});
