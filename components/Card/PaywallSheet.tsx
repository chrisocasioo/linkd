import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRevenueCat } from '../../lib/RevenueCatContext';
import { getProPricing, ProPricing } from '../../lib/revenuecat';
import { COLORS, FONTS } from '../../constants/colors';

const SERIF_SEMIBOLD = 'PlayfairDisplay-SemiBold';
// Illustrative, not the viewer's own data — keeps the stat card compelling
// regardless of how new/active this particular account is.
const GENERIC_VIEWS = 247;

const PRO_FEATURES = [
  { title: 'Unlimited Cards', sub: 'No 5-card limit' },
  { title: 'Custom Colors', sub: 'Any accent, not presets' },
  { title: 'Custom Fonts', sub: 'Every font, unlocked' },
  { title: 'Branded QR', sub: 'Logo + custom colors' },
  { title: 'Analytics', sub: 'Views, trends, clicks' },
  { title: 'Unlimited Scans', sub: 'No 100-scan limit' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PaywallSheet({ visible, onClose }: Props) {
  const { purchasePro } = useRevenueCat();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<ProPricing | null>(null);
  const [plan, setPlan] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    if (visible) {
      // Live App Store prices so price changes never need an app update
      getProPricing().then(setPricing).catch(() => {});
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

  // Swipe-down-to-dismiss on the handle zone (the body ScrollView keeps its
  // own vertical gesture). onCloseRef avoids a stale onClose in the responder.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) slideAnim.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          onCloseRef.current();
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View {...panResponder.panHandlers}>
          <View style={styles.handle} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.statCard}>
            <View>
              <Text style={styles.statNumber}>{GENERIC_VIEWS.toLocaleString()}</Text>
              <Text style={styles.statLabel}>card views this month</Text>
            </View>
            <Ionicons name="bar-chart" size={34} color={COLORS.accent} />
          </View>

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

          {/* Required by App Store Review Guideline 3.1.2 — auto-renewal
              terms plus Privacy Policy / Terms of Use, both reachable from
              the purchase screen itself. No custom Terms of Use exists, so
              this links Apple's standard EULA, which Apple explicitly
              accepts in place of one. */}
          <Text style={styles.disclosure}>
            {trialDays ? `${trialDays}-day free trial, then ` : ''}
            {plan === 'annual' ? `${annualPrice}/year` : `${monthlyPrice}/month`}. Auto-renews unless canceled at least 24 hours before the current period ends. Manage or cancel anytime in Settings &gt; Apple ID &gt; Subscriptions.
          </Text>
          <View style={styles.legalRow}>
            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://chrisocasioo.github.io/Linkd-Legal/privacy.html')}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
              <Text style={styles.legalLink}>Terms of Use</Text>
            </Pressable>
          </View>
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

  disclosure: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 14, marginTop: 4 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  legalLink: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary, textDecorationLine: 'underline' },
  legalDot: { fontSize: 11, color: COLORS.textTertiary },
});
