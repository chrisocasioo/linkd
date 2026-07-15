import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApi } from '../../lib/api';
import { useRevenueCat } from '../../lib/RevenueCatContext';
import { getProPricing, ProPricing } from '../../lib/revenuecat';
import { COLORS, FONTS } from '../../constants/colors';

const SERIF_SEMIBOLD = 'PlayfairDisplay-SemiBold';

const PRO_FEATURES = [
  { title: 'Unlimited Cards', sub: 'No 5-card cap' },
  { title: 'Custom Colors', sub: 'Any accent, not presets' },
  { title: 'Custom Fonts', sub: 'Every font, unlocked' },
  { title: 'Branded QR', sub: 'Logo + custom colors' },
  { title: 'Analytics', sub: 'Views, trends, clicks' },
  { title: 'Unlimited Scans', sub: 'No 100-scan cap' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PaywallSheet({ visible, onClose }: Props) {
  const api = useApi();
  const { purchasePro } = useRevenueCat();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<ProPricing | null>(null);
  const [totalViews, setTotalViews] = useState<number | null>(null);
  const [plan, setPlan] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    if (visible) {
      // Live App Store prices so price changes never need an app update
      getProPricing().then(setPricing).catch(() => {});
      // Real (locked) view count as the hook — never a fabricated number
      api.getAnalytics().then((d) => setTotalViews(d.totalCardViews)).catch(() => {});
      setPlan('monthly');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  // Hardcoded strings are the offline fallback only — they mirror the App
  // Store configuration ($7.99/mo, $59.99/yr, 7-day trial on both)
  const monthly = pricing?.monthly ?? null;
  const annual = pricing?.annual ?? null;
  const trialDays = monthly?.trialDays ?? annual?.trialDays ?? (pricing ? null : 7);
  const monthlyPrice = monthly ? monthly.priceString : '$7.99';
  const annualPrice = annual ? annual.priceString : '$59.99';
  const ctaLabel = trialDays ? `Try ${trialDays} days free` : 'Start Pro';

  const handleStart = async () => {
    setLoading(true);
    try {
      const success = await purchasePro(plan);
      if (success) { Alert.alert('Welcome to Pro!', 'All features unlocked.'); onClose(); }
    } catch (err: any) {
      Alert.alert('Purchase failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
          {totalViews !== null && totalViews > 0 && (
            <View style={styles.statCard}>
              <View>
                <Text style={styles.statNumber}>{totalViews.toLocaleString()}</Text>
                <Text style={styles.statLabel}>card views this month</Text>
              </View>
              <Ionicons name="bar-chart" size={34} color={COLORS.accent} />
            </View>
          )}

          <Text style={styles.headline}>Know who's looking{'\n'}at your card</Text>
          <Text style={styles.sub}>Pro unlocks the numbers behind every share.</Text>

          <View style={styles.grid}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.gridCard}>
                <Text style={styles.gridTitle}>{f.title}</Text>
                <Text style={styles.gridSub}>{f.sub}</Text>
              </View>
            ))}
          </View>

          <View style={styles.planRow}>
            <Pressable
              style={[styles.planBtn, plan === 'monthly' && styles.planBtnActive]}
              onPress={() => setPlan('monthly')}
              disabled={loading}
            >
              <Text style={[styles.planText, plan === 'monthly' && styles.planTextActive]}>
                Monthly · {monthlyPrice}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.planBtn, plan === 'annual' && styles.planBtnActive]}
              onPress={() => setPlan('annual')}
              disabled={loading}
            >
              <Text style={[styles.planText, plan === 'annual' && styles.planTextActive]}>
                Yearly · {annualPrice}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.startBtn, loading && styles.startBtnDisabled]}
            onPress={handleStart}
            disabled={loading}
          >
            <Text style={styles.startBtnText}>{loading ? 'Loading…' : ctaLabel}</Text>
          </Pressable>

          <Pressable onPress={onClose} disabled={loading}>
            <Text style={styles.later}>Maybe later</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '92%',
    backgroundColor: '#0C0C0E',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 14, marginBottom: 4 },
  content: { padding: 18, paddingBottom: 36, gap: 16 },

  statCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.accentDim,
    borderWidth: 1, borderColor: 'rgba(201,151,58,0.35)',
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 18,
  },
  statNumber: { fontSize: 42, fontFamily: SERIF_SEMIBOLD, color: COLORS.accent, letterSpacing: -0.5 },
  statLabel: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },

  headline: { fontSize: 28, fontFamily: SERIF_SEMIBOLD, color: COLORS.text, lineHeight: 34, letterSpacing: -0.3 },
  sub: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: -8 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: {
    width: '48%',
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, gap: 3,
  },
  gridTitle: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.text },
  gridSub: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 15 },

  planRow: { flexDirection: 'row', gap: 10 },
  planBtn: {
    flex: 1, height: 52, borderRadius: 14,
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  planBtnActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  planText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  planTextActive: { color: '#0C0C0E', fontFamily: FONTS.semiBold },

  startBtn: {
    height: 54, backgroundColor: COLORS.accent, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.accent, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  startBtnDisabled: { opacity: 0.6 },
  startBtnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#0C0C0E' },

  later: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', textDecorationLine: 'underline' },
});
