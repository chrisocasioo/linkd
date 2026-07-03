import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScanResult } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');

type FieldKey = 'firstName' | 'lastName' | 'email' | 'phone' | 'fax' | 'company' | 'jobTitle' | 'website' | 'address';

const FIELD_OPTS: Array<{
  key: FieldKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboard?: 'email-address' | 'phone-pad' | 'url';
}> = [
  { key: 'firstName', label: 'First Name',  icon: 'person-outline' },
  { key: 'lastName',  label: 'Last Name',   icon: 'person-outline' },
  { key: 'email',     label: 'Email',       icon: 'mail-outline',     keyboard: 'email-address' },
  { key: 'phone',     label: 'Phone',       icon: 'call-outline',     keyboard: 'phone-pad' },
  { key: 'fax',       label: 'Fax',         icon: 'print-outline',    keyboard: 'phone-pad' },
  { key: 'company',   label: 'Company',     icon: 'business-outline' },
  { key: 'jobTitle',  label: 'Job Title',   icon: 'briefcase-outline' },
  { key: 'website',   label: 'Website',     icon: 'globe-outline',    keyboard: 'url' },
  { key: 'address',   label: 'Address',     icon: 'location-outline' },
];

// Blank form shown by Add Contact (no scan data) — every common field ready to fill
const BLANK_FORM_FIELDS: FieldKey[] = [
  'firstName', 'lastName', 'phone', 'email', 'company', 'jobTitle', 'website', 'address',
];

interface Item { id: string; value: string; field: FieldKey; }

let _id = 0;
function uid() { return String(_id++); }

function toItems(initial: Partial<ScanResult> | null): Item[] {
  if (!initial) {
    return BLANK_FORM_FIELDS.map((field) => ({ id: uid(), value: '', field }));
  }
  const items: Item[] = [];
  const add = (field: FieldKey, value: string | null | undefined) => {
    if (value) items.push({ id: uid(), value, field });
  };
  add('firstName', initial?.firstName);
  add('lastName',  initial?.lastName);
  add('email',     initial?.email);
  add('phone',     initial?.phone);
  const faxNums = initial?.faxes?.length ? initial.faxes : (initial?.fax ? [initial.fax] : []);
  for (const f of faxNums) add('fax', f);
  add('company',   initial?.company);
  add('jobTitle',  initial?.jobTitle);
  // Add all detected websites as separate rows (falls back to single website field)
  const urls = initial?.websites?.length ? initial.websites : (initial?.website ? [initial.website] : []);
  for (const url of urls) add('website', url);
  const addrs = initial?.addresses?.length ? initial.addresses : (initial?.address ? [initial.address] : []);
  for (const a of addrs) add('address', a);
  return items;
}

function toResult(items: Item[]): Partial<ScanResult> {
  const r: Partial<ScanResult> = {};
  const seen = new Set<string>();
  for (const item of items) {
    const v = item.value.trim();
    if (!v) continue;
    if (!seen.has(item.field)) {
      (r as any)[item.field] = v;
      seen.add(item.field);
    }
  }
  return r;
}

interface Props {
  visible: boolean;
  initial: Partial<ScanResult> | null;
  onClose: () => void;
  onSave: (fields: Partial<ScanResult>) => Promise<void>;
  title?: string;
}

export function ContactReviewSheet({ visible, initial, onClose, onSave, title = 'Review Contact' }: Props) {
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const [items, setItems] = useState<Item[]>([]);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setItems(toItems(initial));
      setPickerFor(null);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, initial]);

  const close = () => { Keyboard.dismiss(); setPickerFor(null); onClose(); };

  // Swipe-down-to-dismiss on the handle/header zone (the body ScrollView keeps
  // its own vertical gestures). closeRef avoids a stale onClose in the responder.
  const closeRef = useRef(close);
  closeRef.current = close;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) slideY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          closeRef.current();
        } else {
          Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
      },
    })
  ).current;

  const updateValue = (idx: number, value: string) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, value } : it));

  const updateField = (idx: number, field: FieldKey) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, field } : it));
    setPickerFor(null);
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setPickerFor(null);
  };

  const addItem = () => {
    const usedFields = new Set(items.map(i => i.field));
    const next = FIELD_OPTS.find(o => !usedFields.has(o.key))?.key ?? 'website';
    setItems(prev => [...prev, { id: uid(), value: '', field: next }]);
  };

  const handleSave = async () => {
    const result = toResult(items);
    const hasContent = result.firstName || result.lastName || result.email || result.phone || result.company;
    if (!hasContent) {
      // alert inline — just return, fields are empty
      return;
    }
    setSaving(true);
    try {
      await onSave(result);
      close();
    } catch {}
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View {...panResponder.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={close} hitSlop={12}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => setPickerFor(null)}
          >
            {items.length === 0 && (
              <Text style={styles.emptyText}>No fields detected — add them below.</Text>
            )}

            {items.map((item, idx) => {
              const opt = FIELD_OPTS.find(o => o.key === item.field)!;
              const isPickerOpen = pickerFor === idx;
              return (
                <View key={item.id}>
                  <View style={styles.itemRow}>
                    <View style={[styles.iconWrap, { backgroundColor: COLORS.surface2 }]}>
                      <Ionicons name={opt.icon} size={15} color={COLORS.textSecondary} />
                    </View>
                    <TextInput
                      style={styles.itemInput}
                      value={item.value}
                      onChangeText={(v) => updateValue(idx, v)}
                      placeholderTextColor={COLORS.textTertiary}
                      placeholder={opt.label}
                      onFocus={() => setPickerFor(null)}
                      keyboardType={opt.keyboard ?? 'default'}
                      autoCapitalize={opt.keyboard === 'email-address' || opt.keyboard === 'url' ? 'none' : 'sentences'}
                    />
                    <Pressable
                      style={[styles.fieldPill, isPickerOpen && { borderColor: COLORS.accent }]}
                      onPress={() => { Keyboard.dismiss(); setPickerFor(isPickerOpen ? null : idx); }}
                    >
                      <Text style={[styles.fieldPillText, isPickerOpen && { color: COLORS.accent }]}>{opt.label}</Text>
                      <Ionicons name="chevron-down" size={11} color={isPickerOpen ? COLORS.accent : COLORS.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => removeItem(idx)} hitSlop={10}>
                      <Ionicons name="close-circle" size={20} color={COLORS.textTertiary} />
                    </Pressable>
                  </View>

                  {isPickerOpen && (
                    <View style={styles.pickerBox}>
                      {FIELD_OPTS.map((o) => (
                        <Pressable
                          key={o.key}
                          style={({ pressed }) => [styles.pickerRow, pressed && { backgroundColor: COLORS.surface2 }]}
                          onPress={() => updateField(idx, o.key)}
                        >
                          <Ionicons name={o.icon} size={15} color={item.field === o.key ? COLORS.accent : COLORS.textSecondary} />
                          <Text style={[styles.pickerLabel, item.field === o.key && { color: COLORS.accent, fontFamily: FONTS.semiBold }]}>
                            {o.label}
                          </Text>
                          {item.field === o.key && <Ionicons name="checkmark" size={14} color={COLORS.accent} style={{ marginLeft: 'auto' }} />}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            <Pressable style={styles.addRow} onPress={addItem}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.addText}>Add field</Text>
            </Pressable>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Contact'}</Text>
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
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text },
  body: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },

  emptyText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 20 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface2, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  itemInput: {
    flex: 1, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text,
    paddingVertical: 4,
  },
  fieldPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  fieldPillText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary },

  pickerBox: {
    backgroundColor: COLORS.surface2, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    marginTop: -4, overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerLabel: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text },

  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  addText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36 },
  cancelBtn: {
    height: 48, paddingHorizontal: 20, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  saveBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
});
