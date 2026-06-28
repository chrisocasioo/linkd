import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS } from '../../constants/colors';
import { QRType } from '../../lib/qr';

interface Props {
  activeType: QRType;
  onChange: (type: QRType) => void;
}

export function TypeSelector({ activeType, onChange }: Props) {
  return (
    <View style={styles.row}>
      {(['url', 'wifi'] as QRType[]).map((type) => {
        const active = activeType === type;
        return (
          <Pressable
            key={type}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(type)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {type === 'url' ? 'URL' : 'WiFi'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: COLORS.accentDim,
    borderColor: COLORS.accent,
  },
  label: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    letterSpacing: -0.1,
  },
  labelActive: { color: COLORS.accent },
});
