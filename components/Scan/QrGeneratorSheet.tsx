import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
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

const QR_COLORS = ['#000000', '#C9973A', '#7C3AED', '#22C55E', '#F43F5E', '#0EA5E9', '#EC4899'];
const QR_BG_COLORS = ['#FFFFFF', '#000000', '#C9973A', '#7C3AED', '#22C55E', '#F43F5E', '#0EA5E9', '#EC4899'];

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
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);
  const [qrColor, setQrColor] = useState('#000000');
  const [qrBgColor, setQrBgColor] = useState('#FFFFFF');
  const [showColorHex, setShowColorHex] = useState<'color' | 'bg' | null>(null);
  const [hexDraft, setHexDraft] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);

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
      setCustomName('');
      setUrl(''); setSsid(''); setPassword(''); setSecurity('WPA');
      setQrColor('#000000'); setQrBgColor('#FFFFFF'); setShowColorHex(null);
      setLogoUri(null);
    }
  }, [visible]);

  const close = () => { Keyboard.dismiss(); onClose(); };

  const handlePickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access to set a QR logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
    }
  };

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
      const label = customName.trim() || generated.label;
      const created = await api.addQr({ type: mode, label, data: generated.data, color: qrColor, bgColor: qrBgColor });
      let saved = created;
      if (logoUri) {
        try {
          const { logoUrl } = await api.uploadQrLogo(created.id, logoUri);
          saved = { ...created, logo: logoUrl };
        } catch {
          // QR itself is already saved — a failed logo upload shouldn't lose that
        }
      }
      setSavedQrs((qs) => [saved, ...qs]);
      setGenerated(null);
      setCustomName('');
      setUrl(''); setSsid(''); setPassword('');
      setQrColor('#000000'); setQrBgColor('#FFFFFF'); setShowColorHex(null);
      setLogoUri(null);
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
                  onPress={() => { setMode(m); setGenerated(null); setCustomName(''); }}
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
                <View style={[styles.qrWrap, { backgroundColor: qrBgColor }]}>
                  <QRCode
                    value={generated.data}
                    size={160}
                    backgroundColor={qrBgColor}
                    color={qrColor}
                    ecl={logoUri ? 'H' : 'M'}
                    logo={logoUri ? { uri: logoUri } : undefined}
                    logoSize={40}
                    logoBackgroundColor={qrBgColor}
                    logoBorderRadius={8}
                    logoMargin={2}
                  />
                </View>
                <Text style={styles.previewLabel} numberOfLines={1}>{generated.label}</Text>

                <TextInput
                  style={styles.nameInput}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="Name (optional)"
                  placeholderTextColor={COLORS.textTertiary}
                />

                <View style={styles.logoRow}>
                  <Pressable onPress={handlePickLogo} style={styles.logoWrap}>
                    {logoUri ? (
                      <Image source={{ uri: logoUri }} style={styles.logoImg} />
                    ) : (
                      <View style={styles.logoPlaceholder}>
                        <Ionicons name="image-outline" size={16} color={COLORS.textTertiary} />
                      </View>
                    )}
                  </Pressable>
                  <Pressable onPress={handlePickLogo}>
                    <Text style={styles.logoActionText}>{logoUri ? 'Change Logo' : 'Add Logo'}</Text>
                  </Pressable>
                  {logoUri && (
                    <Pressable onPress={() => setLogoUri(null)}>
                      <Text style={styles.logoActionTextRemove}>Remove</Text>
                    </Pressable>
                  )}
                </View>

                <Text style={styles.swatchLabel}>Color</Text>
                <View style={styles.swatchRow}>
                  <Pressable
                    style={[styles.swatchDot, styles.swatchPickerDot]}
                    onPress={() => { setHexDraft(qrColor); setShowColorHex((v) => (v === 'color' ? null : 'color')); }}
                  >
                    <Ionicons name="color-palette-outline" size={14} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                  {QR_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.swatchDot, { backgroundColor: c }, qrColor === c && styles.swatchDotActive]}
                      onPress={() => { setQrColor(c); setShowColorHex(null); }}
                    >
                      {qrColor === c && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.swatchLabel}>Background</Text>
                <View style={styles.swatchRow}>
                  <Pressable
                    style={[styles.swatchDot, styles.swatchPickerDot]}
                    onPress={() => { setHexDraft(qrBgColor); setShowColorHex((v) => (v === 'bg' ? null : 'bg')); }}
                  >
                    <Ionicons name="color-palette-outline" size={14} color="rgba(255,255,255,0.6)" />
                  </Pressable>
                  {QR_BG_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      style={[
                        styles.swatchDot, { backgroundColor: c }, qrBgColor === c && styles.swatchDotActive,
                        c === '#FFFFFF' && { borderWidth: 1, borderColor: COLORS.border },
                      ]}
                      onPress={() => { setQrBgColor(c); setShowColorHex(null); }}
                    >
                      {qrBgColor === c && <Ionicons name="checkmark" size={12} color={c === '#FFFFFF' ? '#0C0C0E' : '#fff'} />}
                    </Pressable>
                  ))}
                </View>

                {showColorHex && (
                  <View style={styles.hexRow}>
                    <View style={[styles.hexPreview, { backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(hexDraft) ? hexDraft : COLORS.border }]} />
                    <TextInput
                      style={styles.hexInput}
                      value={hexDraft}
                      onChangeText={(v) => {
                        const clean = v.startsWith('#') ? v : '#' + v;
                        setHexDraft(clean);
                        if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
                          if (showColorHex === 'color') setQrColor(clean); else setQrBgColor(clean);
                        }
                      }}
                      placeholder="#000000"
                      placeholderTextColor={COLORS.textTertiary}
                      autoCapitalize="characters"
                      maxLength={7}
                    />
                  </View>
                )}

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
                  <View style={[styles.savedQrThumb, { backgroundColor: q.bgColor ?? '#fff' }]}>
                    <QRCode
                      value={q.data}
                      size={30}
                      backgroundColor={q.bgColor ?? '#fff'}
                      color={q.color ?? '#000'}
                      ecl={q.logo ? 'H' : 'M'}
                      logo={q.logo ? { uri: q.logo } : undefined}
                      logoSize={q.logo ? 9 : undefined}
                      logoBackgroundColor={q.bgColor ?? '#fff'}
                      logoBorderRadius={2}
                    />
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
  nameInput: {
    height: 40, width: '100%', borderRadius: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    fontSize: 13, fontFamily: FONTS.regular, color: COLORS.text,
  },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  logoWrap: { width: 36, height: 36, borderRadius: 10, overflow: 'hidden' },
  logoImg: { width: 36, height: 36, borderRadius: 10 },
  logoPlaceholder: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  logoActionText: { fontSize: 12, fontFamily: FONTS.semiBold, color: COLORS.accent },
  logoActionTextRemove: { fontSize: 12, fontFamily: FONTS.semiBold, color: '#EF4444' },

  swatchLabel: {
    fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textTertiary,
    letterSpacing: 0.6, textTransform: 'uppercase', alignSelf: 'flex-start', marginTop: 4,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignSelf: 'flex-start' },
  swatchDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchPickerDot: { backgroundColor: 'rgba(255,255,255,0.08)' },
  swatchDotActive: { borderColor: '#fff' },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  hexPreview: { width: 26, height: 26, borderRadius: 13 },
  hexInput: {
    flex: 1, height: 40, borderRadius: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    fontSize: 13, fontFamily: FONTS.regular, color: COLORS.text,
  },

  saveBtn: { height: 40, paddingHorizontal: 24, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#0C0C0E' },

  savedHeader: { marginTop: 8 },
  savedTitle: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.textSecondary },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: 'center', paddingVertical: 16 },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderColor: COLORS.border,
  },
  savedQrThumb: {
    width: 38, height: 38, borderRadius: 8, padding: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  savedLabel: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text },
});
