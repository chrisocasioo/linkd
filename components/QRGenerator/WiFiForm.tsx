import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, FONTS } from '../../constants/colors';
import { SecurityType, encodeWiFiQR } from '../../lib/qr';

interface Props {
  onGenerate: (value: string, label: string) => void;
}

const SECURITY_OPTIONS: SecurityType[] = ['WPA', 'WEP', 'nopass'];
const SECURITY_LABELS: Record<SecurityType, string> = {
  WPA: 'WPA/WPA2',
  WEP: 'WEP',
  nopass: 'None',
};

export function WiFiForm({ onGenerate }: Props) {
  const [ssid, setSSID] = useState('');
  const [password, setPassword] = useState('');
  const [security, setSecurity] = useState<SecurityType>('WPA');

  const handleGenerate = () => {
    if (!ssid.trim()) return;
    Keyboard.dismiss();
    const value = encodeWiFiQR(ssid.trim(), password, security);
    onGenerate(value, ssid.trim());
  };

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <Text style={styles.label}>NETWORK NAME (SSID)</Text>
        <TextInput
          style={styles.input}
          placeholder="My WiFi Network"
          placeholderTextColor={COLORS.textTertiary}
          value={ssid}
          onChangeText={setSSID}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>SECURITY</Text>
        <View style={styles.secRow}>
          {SECURITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.secPill, security === opt && styles.secPillActive]}
              onPress={() => setSecurity(opt)}
            >
              <Text style={[styles.secLabel, security === opt && styles.secLabelActive]}>
                {SECURITY_LABELS[opt]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {security !== 'nopass' && (
        <View style={styles.field}>
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Network password"
            placeholderTextColor={COLORS.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCorrect={false}
          />
        </View>
      )}

      <Pressable
        style={[styles.btn, !ssid.trim() && styles.btnDisabled]}
        onPress={handleGenerate}
        disabled={!ssid.trim()}
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
  secRow: { flexDirection: 'row', gap: 8 },
  secPill: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secPillActive: {
    backgroundColor: COLORS.accentDim,
    borderColor: COLORS.accent,
  },
  secLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  secLabelActive: { color: COLORS.accent },
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
