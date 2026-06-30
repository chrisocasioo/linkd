import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaywallSheet } from '../components/Card/PaywallSheet';
import { useApi, AnalyticsData } from '../lib/api';
import { useRevenueCat } from '../lib/RevenueCatContext';
import { COLORS, FONTS } from '../constants/colors';

export default function AnalyticsScreen() {
  const router = useRouter();
  const api = useApi();
  const { isPro } = useRevenueCat();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isPro) {
        setLoading(false);
        setShowPaywall(true);
        return;
      }
      api.getAnalytics().then(setData).catch(() => {}).finally(() => setLoading(false));
    }, [isPro])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.heading}>Analytics</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>LAST 30 DAYS</Text>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.profileViews}</Text>
            <Text style={styles.statLabel}>Profile Views</Text>
          </View>

          <Text style={styles.sectionLabel}>LINK CLICKS</Text>
          {data.linkClicks.length === 0 ? (
            <Text style={styles.empty}>No clicks yet — share your card to get started.</Text>
          ) : (
            data.linkClicks.map((item) => (
              <View key={item.linkId} style={styles.linkRow}>
                <View style={styles.linkInfo}>
                  <Text style={styles.linkTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.linkUrl} numberOfLines={1}>{item.url}</Text>
                </View>
                <View style={styles.clickBadge}>
                  <Text style={styles.clickCount}>{item.count}</Text>
                  <Text style={styles.clickLabel}>clicks</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : null}

      <PaywallSheet visible={showPaywall} onClose={() => { setShowPaywall(false); router.back(); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backText: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.accent, width: 60 },
  heading: { fontSize: 17, fontFamily: FONTS.semiBold, color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 12, paddingBottom: 60 },
  sectionLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 1.5, marginTop: 8 },
  statCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.accent, borderRadius: 16, padding: 24, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 48, fontFamily: FONTS.semiBold, color: COLORS.accent },
  statLabel: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  empty: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 24 },
  linkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 16, gap: 12 },
  linkInfo: { flex: 1, gap: 2 },
  linkTitle: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text },
  linkUrl: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  clickBadge: { alignItems: 'center', gap: 2 },
  clickCount: { fontSize: 22, fontFamily: FONTS.semiBold, color: COLORS.accent },
  clickLabel: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textSecondary },
});
