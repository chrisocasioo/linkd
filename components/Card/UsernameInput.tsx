import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApi } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

interface Props {
  value: string;
  onChange: (v: string) => void;
  currentUsername?: string;
}

const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;

export function UsernameInput({ value, onChange, currentUsername }: Props) {
  const api = useApi();
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(
    (raw: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const normalized = raw.toLowerCase();
      if (!normalized) { setStatus('idle'); return; }
      if (!USERNAME_RE.test(normalized)) { setStatus('invalid'); return; }
      if (normalized === currentUsername) { setStatus('available'); return; }
      setStatus('checking');
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await api.checkUsername(normalized);
          setStatus(res.available ? 'available' : 'taken');
        } catch {
          setStatus('idle');
        }
      }, 500);
    },
    [api, currentUsername]
  );

  useEffect(() => {
    check(value);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  const hint =
    status === 'available' ? '✓ Available'
    : status === 'taken' ? '✗ Already taken'
    : status === 'invalid' ? '3–30 chars: letters, numbers, _ or -'
    : '';

  const hintColor =
    status === 'available' ? '#22C55E'
    : status === 'taken' ? COLORS.danger
    : COLORS.textSecondary;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <Text style={styles.prefix}>linkd.tattoo/</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(v) => { onChange(v.toLowerCase()); }}
          placeholder="yourname"
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
        />
        {status === 'checking' && <ActivityIndicator size="small" color={COLORS.accent} style={styles.spinner} />}
      </View>
      {hint ? <Text style={[styles.hint, { color: hintColor }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
  },
  prefix: { fontSize: 15, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  input: { flex: 1, fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text },
  spinner: { marginLeft: 8 },
  hint: { fontSize: 12, fontFamily: FONTS.regular, paddingLeft: 4 },
});
