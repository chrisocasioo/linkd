import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRevenueCat } from '../../lib/RevenueCatContext';
import { COLORS, FONTS } from '../../constants/colors';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.75;

const PRO_FEATURES = [
  { emoji: '🌐', title: 'Custom Domain', sub: 'Your own domain points to your card' },
  { emoji: '🎨', title: 'Premium Themes', sub: 'Colors, fonts, button styles' },
  { emoji: '📊', title: 'Analytics', sub: 'Scans, visits, and link clicks' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PaywallSheet({ visible, onClose }: Props) {
  const { purchasePro } = useRevenueCat();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleMonthly = async () => {
    setLoading(true);
    try {
      const success = await purchasePro('monthly');
      if (success) { Alert.alert('Welcome to Pro!', 'All features unlocked.'); onClose(); }
    } catch (err: any) {
      Alert.alert('Purchase failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnual = async () => {
    setLoading(true);
    try {
      const success = await purchasePro('annual');
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
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.headerBlock}>
            <View style={styles.iconBox}>
              <Text style={styles.iconText}>✦</Text>
            </View>
            <Text style={styles.heading}>Upgrade to Pro</Text>
            <Text style={styles.sub}>Custom domain, premium themes, and see who's visiting your card.</Text>
          </View>

          {/* Features */}
          <View style={styles.features}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Text style={styles.featureEmoji}>{f.emoji}</Text>
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureSub}>{f.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTAs */}
          <View style={styles.ctaBlock}>
            <Pressable
              style={[styles.startBtn, loading && styles.startBtnDisabled]}
              onPress={handleMonthly}
              disabled={loading}
            >
              <Text style={styles.startBtnText}>{loading ? 'Loading…' : 'Start Pro — $7.99 / month'}</Text>
            </Pressable>
            <Pressable onPress={handleAnnual} disabled={loading}>
              <Text style={styles.annualText}>$79 / year · Save 17%</Text>
            </Pressable>
          </View>

          <Pressable onPress={onClose}>
            <Text style={styles.later}>Maybe Later</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_HEIGHT,
    backgroundColor: '#161618',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 16 },
  content: { padding: 18, gap: 16 },
  headerBlock: { alignItems: 'center', gap: 10 },
  iconBox: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: COLORS.accentDim, borderWidth: 1.5, borderColor: 'rgba(201,151,58,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 22, color: COLORS.accent },
  heading: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.3 },
  sub: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18, maxWidth: 210 },
  features: { gap: 9 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.accentDim, borderWidth: 1, borderColor: 'rgba(201,151,58,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureEmoji: { fontSize: 13 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.text },
  featureSub: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 1 },
  ctaBlock: { gap: 7 },
  startBtn: { height: 46, backgroundColor: COLORS.accent, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  startBtnDisabled: { opacity: 0.6 },
  startBtnText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
  annualText: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 4 },
  later: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
});
