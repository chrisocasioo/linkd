import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');

const ACCENT_COLORS = [
  '#C9A84C', '#7C3AED', '#22C55E', '#F43F5E',
  '#0EA5E9', '#F97316', '#EC4899', '#14B8A6',
];

interface Props {
  visible: boolean;
  card: Card | null;
  onClose: () => void;
  onSave: (data: { name: string; accentColor: string }, cardId?: string) => Promise<void>;
  onDelete?: (cardId: string) => Promise<void>;
}

export function CardEditSheet({ visible, card, onClose, onSave, onDelete }: Props) {
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const [name, setName] = useState(card?.name ?? '');
  const [accent, setAccent] = useState(card?.accentColor ?? ACCENT_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(card?.name ?? '');
      setAccent(card?.accentColor ?? ACCENT_COLORS[0]);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, card]);

  const close = () => { Keyboard.dismiss(); onClose(); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), accentColor: accent }, card?.id);
      close();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!card || !onDelete) return;
    Alert.alert('Delete card?', 'All fields on this card will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try { await onDelete(card.id); close(); }
          catch (err: any) { Alert.alert('Error', err.message); }
          finally { setSaving(false); }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{card ? 'Edit Card' : 'New Card'}</Text>
            <Pressable onPress={close} hitSlop={12}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.body}>
            <Text style={styles.fieldLabel}>Card Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Networking, Personal, Work"
              placeholderTextColor={COLORS.textTertiary}
              maxLength={30}
            />

            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Accent Color</Text>
            <View style={styles.colorRow}>
              {ACCENT_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, accent === c && styles.colorDotActive]}
                  onPress={() => setAccent(c)}
                >
                  {accent === c && <Ionicons name="checkmark" size={14} color="#fff" />}
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.actions}>
            {card && onDelete && (
              <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={saving}>
                <Text style={styles.deleteBtnText}>Delete Card</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.saveBtn, { backgroundColor: accent }, (!name.trim() || saving) && styles.saveBtnDim]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
            >
              <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text },
  body: { paddingHorizontal: 20 },
  fieldLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  input: {
    height: 48, backgroundColor: COLORS.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.text,
  },
  colorRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  colorDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorDotActive: { borderColor: '#fff' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 24 },
  deleteBtn: {
    height: 48, paddingHorizontal: 16, borderRadius: 14,
    borderWidth: 1, borderColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 14, fontFamily: FONTS.medium, color: '#ef4444' },
  saveBtn: {
    flex: 1, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDim: { opacity: 0.5 },
  saveBtnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
});
