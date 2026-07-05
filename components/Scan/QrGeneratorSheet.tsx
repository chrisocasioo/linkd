import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SavedQr, useApi } from '../../lib/api';
import { buildWifiQr, normalizeUrl } from '../../lib/qrFormat';
import { COLORS, FONTS } from '../../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');

type Mode = 'url' | 'wifi';
type Security = 'WPA' | 'WEP' | 'nopass';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function QrGeneratorSheet({ visible, onClose }: Props) {
  const api = useApi();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [security, setSecurity] = useState<Security>('WPA');

  const [generated, setGenerated] = useState<{ data: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [savedQrs, setSavedQrs] = useState<SavedQr[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
      setLoadingSaved(true);
      api.getMyQrs().then(setSavedQrs).catch(() => {}).finally(() => setLoadingSaved(false));
    } else {
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
      setGenerated(null);
      setUrl(''); setSsid(''); setPassword(''); setSecurity('WPA');
    }
  }, [visible]);

  const close = () => { Keyboard.dismiss(); onClose(); };

  const canGenerate = mode === 'url' ? url.trim().length > 0 : ssid.trim().length > 0;

  const handleGenerate = () => {
    Keyboard.dismiss();
    if (mode === 'url') {
      const data = normalizeUrl(url);
      setGenerated({ data, label: data });
    } else {
      const data = buildWifiQr(ssid, password, security);
      setGenerated({ data, label: `Wi-Fi: ${ssid.trim()}` });
    }
  };

  const handleSave = async () => {
    if (!generated) return;
    setSaving(true);
    try {
      const created = await api.addQr({ type: mode, label: generated.label, data: generated.data });
      setSavedQrs((qs) => [created, ...qs]);
      setGenerated(null);
      setUrl(''); setSsid(''); setPassword('');
    } catch (err: any) {
      Alert.alert('Could not save', err.message ?? 'Try again.');
    }
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete QR code?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setSavedQrs((qs) => qs.filter((q) => q.id !== id));
          try { await api.deleteQr(id); } catch {}
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>QR Codes</Text>
            <Pressable onPress={close} hitSlop={12}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.modeToggle}>
              {(['url', 'wifi'] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.modeItem, mode === m && styles.modeItemActive]}
                  onPress={() => { setMode(m); setGenerated(null); }}
                >
                  <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                    {m === 'url' ? 'URL' : 'Wi-Fi'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === 'url' ? (
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="example.com"
                placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            ) : (
              <View style={{ gap: 8 }}>
                <TextInput
                  style={styles.input}
                  value={ssid}
                  onChangeText={setSsid}
                  placeholder="Network name (SSID)"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {security !== 'nopass' && (
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                )}
                <View style={styles.modeToggle}>
                  {(['WPA', 'WEP', 'nopass'] as const).map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.modeItem, security === s && styles.modeItemActive]}
                      onPress={() => setSecurity(s)}
                    >
                      <Text style={[styles.modeText, security === s && styles.modeTextActive]}>
                        {s === 'nopass' ? 'Open' : s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Pressable
              style={[styles.generateBtn, !canGenerate && { opacity: 0.4 }]}
              onPress={handleGenerate}
              disabled={!canGenerate}
            >
              <Text style={styles.generateBtnText}>Generate</Text>
            </Pressable>

            {generated && (
              <View style={styles.previewBox}>
                <View style={styles.qrWrap}>
                  <QRCode value={generated.data} size={160} backgroundColor="#fff" color="#000" ecl="M" />
                </View>
                <Text style={styles.previewLabel} numberOfLines={1}>{generated.label}</Text>
                <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.savedHeader}>
              <Text style={styles.savedTitle}>Saved QR Codes</Text>
            </View>

            {loadingSaved ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 12 }} />
            ) : savedQrs.length === 0 ? (
              <Text style={styles.emptyText}>Nothing saved yet</Text>
            ) : (
              savedQrs.map((q) => (
                <View key={q.id} style={styles.savedRow}>
                  <View style={styles.savedIcon}>
                    <Ionicons name={q.type === 'wifi' ? 'wifi' : 'link'} size={15} color={COLORS.accent} />
                  </View>
                  <Text style={styles.savedLabel} numberOfLines={1}>{q.label ?? q.data}</Text>
                  <Pressable onPress={() => handleDelete(q.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.textTertiary} />
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },

  modeToggle: {
    flexDirection: 'row', backgroundColor: COLORS.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  modeItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  modeItemActive: { backgroundColor: COLORS.accent },
  modeText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  modeTextActive: { color: '#0C0C0E', fontFamily: FONTS.semiBold },

  input: {
    height: 46, borderRadius: 12, paddingHorizontal: 14,
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text,
  },

  generateBtn: { height: 46, borderRadius: 13, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  generateBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#0C0C0E' },

  previewBox: {
    alignItems: 'center', gap: 10, padding: 16,
    backgroundColor: COLORS.surface2, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  qrWrap: { padding: 10, backgroundColor: '#fff', borderRadius: 10 },
  previewLabel: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, maxWidth: '100%' },
  saveBtn: { height: 40, paddingHorizontal: 24, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#0C0C0E' },

  savedHeader: { marginTop: 8 },
  savedTitle: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.textSecondary },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: 'center', paddingVertical: 16 },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderColor: COLORS.border,
  },
  savedIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  savedLabel: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text },
});
