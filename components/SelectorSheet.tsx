import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS } from '../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');

export interface SelectorOption<K extends string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  visible: boolean;
  title: string;
  options: SelectorOption<K>[];
  selectedKey: K;
  onSelect: (key: K) => void;
  onClose: () => void;
}

// A themed stand-in for ActionSheetIOS / native pickers — same slide-up
// bottom sheet used everywhere else in the app, so filter/sort menus look
// like part of Linkd instead of iOS chrome.
export function SelectorSheet<K extends string>({ visible, title, options, selectedKey, onSelect, onClose }: Props<K>) {
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.body}>
            {options.map((o) => {
              const active = o.key === selectedKey;
              return (
                <Pressable
                  key={o.key}
                  style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && !active && { backgroundColor: COLORS.surface2 }]}
                  onPress={() => { onSelect(o.key); onClose(); }}
                >
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{o.label}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={COLORS.accent} />}
                </Pressable>
              );
            })}
          </View>
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
    paddingBottom: 36,
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text },
  body: { paddingHorizontal: 12, paddingBottom: 8, gap: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14,
  },
  rowActive: { backgroundColor: COLORS.accentDim },
  rowLabel: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text },
  rowLabelActive: { color: COLORS.accent, fontFamily: FONTS.semiBold },
});
