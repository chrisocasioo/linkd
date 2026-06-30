import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRevenueCat } from '../../lib/RevenueCatContext';
import { COLORS, FONTS } from '../../constants/colors';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.7;

const PRO_FEATURES = [
  'Custom card themes',
  'Accent color customization',
  'Font & button style picker',
  'Analytics dashboard',
  'Remove "Get Linkd" footer',
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PaywallSheet({ visible, onClose }: Props) {
  const { purchasePro } = useRevenueCat();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const success = await purchasePro(plan);
      if (success) {
        Alert.alert('Welcome to Pro!', 'All features unlocked.');
        onClose();
      }
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
          <Text style={styles.heading}>Linkd Pro</Text>
          <Text style={styles.sub}>Unlock your full digital presence</Text>

          <View style={styles.features}>
            {PRO_FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={styles.plans}>
            {(['monthly', 'annual'] as const).map((p) => (
              <Pressable
                key={p}
                style={[styles.planChip, plan === p && styles.planChipActive]}
                onPress={() => setPlan(p)}
              >
                <Text style={[styles.planPrice, plan === p && styles.planPriceActive]}>
                  {p === 'monthly' ? '$4.99 / mo' : '$39.99 / yr'}
                </Text>
                {p === 'annual' && (
                  <Text style={[styles.planSave, plan === p && styles.planSaveActive]}>Save 33%</Text>
                )}
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.startBtn, loading && styles.startBtnDisabled]}
            onPress={handlePurchase}
            disabled={loading}
          >
            <Text style={styles.startBtnText}>{loading ? 'Loading…' : 'Start Pro'}</Text>
          </Pressable>

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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  content: { padding: 24, gap: 16 },
  heading: { fontSize: 26, fontFamily: FONTS.semiBold, color: COLORS.accent, textAlign: 'center' },
  sub: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  features: { gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureCheck: { fontSize: 14, color: COLORS.accent, width: 16 },
  featureText: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text },
  plans: { flexDirection: 'row', gap: 12 },
  planChip: {
    flex: 1,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  planChipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  planPrice: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.text },
  planPriceActive: { color: COLORS.accent },
  planSave: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  planSaveActive: { color: COLORS.accent },
  startBtn: {
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnDisabled: { opacity: 0.6 },
  startBtnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#fff' },
  later: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
});
