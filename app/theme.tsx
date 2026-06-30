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
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.heading}>Theme</Text>
        <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>CARD THEME</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeRow}>
          {THEMES.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.themeChip, { backgroundColor: t.bg }, selectedTheme === t.id && styles.themeChipActive]}
              onPress={() => handleThemeSelect(t.id, t.pro)}
            >
              <View style={[styles.themeAccentDot, { backgroundColor: t.accent }]} />
              <Text style={[styles.themeLabel, { color: t.bg === '#FFF' || t.bg === '#F5E6D3' ? '#1A1A1A' : '#FFF' }]}>
                {t.label}
              </Text>
              {t.pro && !isPro && <Text style={styles.lockIcon}>🔒</Text>}
            </Pressable>
          ))}
        </ScrollView>

        {isPro && (
          <>
            <Text style={styles.sectionLabel}>ACCENT COLOR</Text>
            <View style={styles.accentRow}>
              {ACCENT_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.accentDot, { backgroundColor: c }, selectedAccent === c && styles.accentDotActive]}
                  onPress={() => setSelectedAccent(c)}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>BUTTON STYLE</Text>
            <View style={styles.chipRow}>
              {BUTTON_STYLES.map((b) => (
                <Pressable
                  key={b}
                  style={[styles.chip, selectedButton === b && styles.chipActive]}
                  onPress={() => setSelectedButton(b)}
                >
                  <Text style={[styles.chipText, selectedButton === b && styles.chipTextActive]}>
                    {b.charAt(0).toUpperCase() + b.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>FONT</Text>
            <View style={styles.chipRow}>
              {FONTS_LIST.map((f) => (
                <Pressable
                  key={f.id}
                  style={[styles.chip, selectedFont === f.id && styles.chipActive]}
                  onPress={() => setSelectedFont(f.id)}
                >
                  <Text style={[styles.chipText, selectedFont === f.id && styles.chipTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {!isPro && (
          <Pressable style={styles.upgradeCard} onPress={() => setShowPaywall(true)}>
            <Text style={styles.upgradeTitle}>Unlock Pro Customization</Text>
            <Text style={styles.upgradeSub}>Accent colors, button styles, fonts, and more</Text>
            <Text style={styles.upgradeAction}>Upgrade →</Text>
          </Pressable>
        )}
      </ScrollView>

      <PaywallSheet visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backText: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.accent },
  heading: { fontSize: 17, fontFamily: FONTS.semiBold, color: COLORS.text },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.accent, borderRadius: 10 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#fff' },
  content: { padding: 20, gap: 12, paddingBottom: 60 },
  sectionLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 1.5, marginTop: 8 },
  themeRow: { gap: 10, paddingVertical: 4 },
  themeChip: { width: 80, height: 100, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: 'transparent' },
  themeChipActive: { borderColor: COLORS.accent },
  themeAccentDot: { width: 20, height: 20, borderRadius: 10 },
  themeLabel: { fontSize: 11, fontFamily: FONTS.medium },
  lockIcon: { fontSize: 10, position: 'absolute', top: 6, right: 6 },
  accentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  accentDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  accentDotActive: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10 },
  chipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  chipText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.accent },
  upgradeCard: { marginTop: 16, padding: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.accent, borderRadius: 16, gap: 6 },
  upgradeTitle: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.accent },
  upgradeSub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  upgradeAction: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.accent, marginTop: 4 },
});
