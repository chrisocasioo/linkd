import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, FONTS } from '../../constants/colors';

interface Props {
  onGenerate: (value: string, label: string) => void;
}

export function URLForm({ onGenerate }: Props) {
  const [url, setUrl] = useState('');

  const handleGenerate = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    const value =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
    let label = trimmed;
    try {
      label = new URL(value).hostname;
    } catch {}
    onGenerate(value, label);
  };

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <Text style={styles.label}>URL</Text>
        <TextInput
          style={styles.input}
          placeholder="https://example.com"
          placeholderTextColor={COLORS.textTertiary}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleGenerate}
        />
      </View>

      <Pressable
        style={[styles.btn, !url.trim() && styles.btnDisabled]}
        onPress={handleGenerate}
        disabled={!url.trim()}
      >
        <Text style={styles.btnText}>Generate QR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  input: {
    height: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  btn: {
    height: 48,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#fff' },
});
