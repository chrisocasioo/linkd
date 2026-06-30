import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaywallSheet } from '../components/Card/PaywallSheet';
import { useApi, User } from '../lib/api';
import { useRevenueCat } from '../lib/RevenueCatContext';
import { COLORS, FONTS } from '../constants/colors';

const THEMES = [
  { id: 'dark', label: 'Dark', bg: '#000', accent: '#C9A84C', pro: false },
  { id: 'light', label: 'Light', bg: '#FFF', accent: '#C9A84C', pro: true },
  { id: 'midnight', label: 'Midnight', bg: '#0A0A2E', accent: '#7C3AED', pro: true },
  { id: 'forest', label: 'Forest', bg: '#0A2E1A', accent: '#22C55E', pro: true },
  { id: 'rose', label: 'Rose', bg: '#2E0A1A', accent: '#F43F5E', pro: true },
  { id: 'ocean', label: 'Ocean', bg: '#0A1A2E', accent: '#0EA5E9', pro: true },
  { id: 'sand', label: 'Sand', bg: '#F5E6D3', accent: '#C9A84C', pro: true },
  { id: 'slate', label: 'Slate', bg: '#1E293B', accent: '#94A3B8', pro: true },
  { id: 'purple', label: 'Purple', bg: '#1A0A2E', accent: '#A855F7', pro: true },
];

const ACCENT_COLORS = ['#C9A84C', '#7C3AED', '#22C55E', '#F43F5E', '#0EA5E9', '#F97316', '#EC4899', '#14B8A6'];
const BUTTON_STYLES = ['filled', 'outline', 'soft'] as const;
const FONTS_LIST = [
  { id: 'dm-sans', label: 'DM Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Mono' },
];

export default function ThemeScreen() {
  const router = useRouter();
  const api = useApi();
  const { isPro } = useRevenueCat();

  const [selectedTheme, setSelectedTheme] = useState('dark');
  const [selectedAccent, setSelectedAccent] = useState(ACCENT_COLORS[0]);
  const [selectedButton, setSelectedButton] = useState<'filled' | 'outline' | 'soft'>('filled');
  const [selectedFont, setSelectedFont] = useState('dm-sans');
  const [showPaywall, setShowPaywall] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleThemeSelect = (themeId: string, isPro_: boolean) => {
    if (isPro_ && !isPro) {
      setShowPaywall(true);
      return;
    }
    setSelectedTheme(themeId);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateMe({
        theme: selectedTheme,
        accentColor: selectedAccent,
        buttonStyle: selectedButton,
        font: selectedFont,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Theme</Text>
        <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Theme chips */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Theme</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeRow}>
          {THEMES.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.themeChip, { backgroundColor: t.bg }, selectedTheme === t.id && styles.themeChipActive]}
              onPress={() => handleThemeSelect(t.id, t.pro)}
            >
              <View style={[styles.themeAccentDot, { backgroundColor: t.accent }]} />
              <Text style={[styles.themeLabel, { color: t.bg === '#FFF' || t.bg === '#F5E6D3' ? '#888' : 'rgba(245,245,245,0.4)' }, selectedTheme === t.id && { color: COLORS.accent }]}>
                {t.label}
              </Text>
              {t.pro && !isPro && <Text style={styles.lockBadge}>Pro</Text>}
            </Pressable>
          ))}
        </ScrollView>

        {/* Customization */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Customization</Text>
        </View>

        <Pressable style={styles.customizeRow} onPress={() => !isPro ? setShowPaywall(true) : undefined}>
          <Text style={styles.customizeLabel}>Accent Color</Text>
          {isPro ? (
            <View style={styles.accentMini}>
              {ACCENT_COLORS.slice(0, 5).map((c) => (
                <Pressable key={c} onPress={() => setSelectedAccent(c)} style={[styles.accentDot, { backgroundColor: c }, selectedAccent === c && styles.accentDotActive]} />
              ))}
            </View>
          ) : (
            <Text style={styles.proLock}>🔒  Pro</Text>
          )}
        </Pressable>

        <Pressable style={styles.customizeRow} onPress={() => !isPro ? setShowPaywall(true) : undefined}>
          <Text style={styles.customizeLabel}>Button Style</Text>
          {isPro ? (
            <View style={styles.chipRow}>
              {BUTTON_STYLES.map((b) => (
                <Pressable key={b} style={[styles.chip, selectedButton === b && styles.chipActive]} onPress={() => setSelectedButton(b)}>
                  <Text style={[styles.chipText, selectedButton === b && styles.chipTextActive]}>{b.charAt(0).toUpperCase() + b.slice(1)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.proLock}>🔒  Pro</Text>
          )}
        </Pressable>

        <Pressable style={styles.customizeRow} onPress={() => !isPro ? setShowPaywall(true) : undefined}>
          <Text style={styles.customizeLabel}>Font</Text>
          {isPro ? (
            <View style={styles.chipRow}>
              {FONTS_LIST.map((f) => (
                <Pressable key={f.id} style={[styles.chip, selectedFont === f.id && styles.chipActive]} onPress={() => setSelectedFont(f.id)}>
                  <Text style={[styles.chipText, selectedFont === f.id && styles.chipTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.proLock}>🔒  Pro</Text>
          )}
        </Pressable>

        {!isPro && (
          <Pressable style={styles.upgradeCard} onPress={() => setShowPaywall(true)}>
            <View style={styles.upgradeLeft}>
              <Text style={styles.upgradeTitle}>✦  Unlock everything</Text>
              <Text style={styles.upgradeSub}>Colors, styles, fonts and more</Text>
            </View>
            <View style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>Go Pro</Text>
            </View>
          </Pressable>
        )}
      </ScrollView>

      <PaywallSheet visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  heading: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.3 },
  saveBtn: { opacity: 1 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.accent },
  content: { paddingBottom: 60, gap: 0 },
  sectionHeader: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  sectionLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.08 * 10, textTransform: 'uppercase', paddingLeft: 2 },
  themeRow: { gap: 8, paddingHorizontal: 18, paddingBottom: 4 },
  themeChip: { width: 76, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 2, borderColor: COLORS.border, position: 'relative' },
  themeChipActive: { borderColor: COLORS.accent },
  themeAccentDot: { width: 14, height: 14, borderRadius: 7 },
  themeLabel: { fontSize: 9, fontFamily: FONTS.medium },
  lockBadge: { position: 'absolute', top: 4, right: 4, fontSize: 7, fontFamily: FONTS.medium, color: COLORS.textTertiary, backgroundColor: COLORS.surface2, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 },
  customizeRow: {
    height: 48, marginHorizontal: 18, marginBottom: 8,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  customizeLabel: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.text },
  proLock: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  accentMini: { flexDirection: 'row', gap: 6 },
  accentDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  accentDotActive: { borderColor: '#fff' },
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8 },
  chipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  chipText: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.accent },
  upgradeCard: {
    marginHorizontal: 18, marginTop: 4,
    borderWidth: 1, borderColor: 'rgba(201,151,58,0.3)', borderRadius: 13,
    padding: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#131008',
  },
  upgradeLeft: { flex: 1 },
  upgradeTitle: { fontSize: 12, fontFamily: FONTS.semiBold, color: COLORS.text },
  upgradeSub: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },
  upgradeBtn: { height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  upgradeBtnText: { fontSize: 11, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
});
