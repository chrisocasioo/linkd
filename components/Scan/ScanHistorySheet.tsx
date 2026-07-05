import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScanHistoryEntry, useApi } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
}

function iconFor(entry: ScanHistoryEntry): keyof typeof Ionicons.glyphMap {
  if (entry.type === 'contact') return 'person-outline';
  if (entry.qrFormat === 'wifi') return 'wifi';
  if (entry.qrFormat === 'url') return 'link';
  return 'qr-code-outline';
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ScanHistorySheet({ visible, onClose }: Props) {
  const api = useApi();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
      setLoading(true);
      api.getScanHistory().then(setEntries).catch(() => {}).finally(() => setLoading(false));
    } else {
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleDelete = (id: string) => {
    Alert.alert('Remove from history?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          setEntries((es) => es.filter((e) => e.id !== id));
          try { await api.deleteScanHistory(id); } catch {}
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Scan History</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {loading ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 20 }} />
            ) : entries.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="time-outline" size={40} color={COLORS.border} />
                <Text style={styles.emptyTitle}>Nothing scanned yet</Text>
                <Text style={styles.emptySub}>Scanned contacts and QR codes show up here</Text>
              </View>
            ) : (
              entries.map((e) => (
                <View key={e.id} style={styles.row}>
                  <View style={styles.rowIcon}>
                    <Ionicons name={iconFor(e)} size={15} color={COLORS.accent} />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{e.label}</Text>
                    <Text style={styles.rowMeta}>
                      {e.type === 'contact' ? 'Scanned contact' : 'Scanned QR'} · {formatWhen(e.createdAt)}
                    </Text>
                  </View>
                  <Pressable onPress={() => handleDelete(e.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.textTertiary} />
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text },
  body: { paddingHorizontal: 20, paddingBottom: 36 },

  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.text },
  emptySub: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderColor: COLORS.border,
  },
  rowIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.text },
  rowMeta: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 1 },
});
