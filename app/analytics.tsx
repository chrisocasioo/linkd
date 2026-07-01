import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaywallSheet } from '../components/Card/PaywallSheet';
import { useApi, AnalyticsData } from '../lib/api';
import { useRevenueCat } from '../lib/RevenueCatContext';
import { COLORS, FONTS } from '../constants/colors';

function delta(current: number, prev: number): string {
  if (prev === 0) return current > 0 ? '↑ New data' : '—';
  const pct = Math.round(((current - prev) / prev) * 100);
  return pct >= 0 ? `↑ ${pct}% vs last month` : `↓ ${Math.abs(pct)}% vs last month`;
}

function formatTrackingSince(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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
        <Text style={styles.heading}>Analytics</Text>
        <Text style={styles.period}>Last 30 days</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : data ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Stat cards row */}
          <View style={styles.statRow}>
            <View style={[styles.statCard, styles.statCardFlex]}>
              <Text style={styles.statLabel}>Profile Views</Text>
              <Text style={styles.statNumber}>{data.profileViews.toLocaleString()}</Text>
              <Text style={styles.statDelta}>{delta(data.profileViews, data.prevProfileViews)}</Text>
            </View>
            <View style={[styles.statCard, styles.statCardFlex]}>
              <Text style={styles.statLabel}>Link Taps</Text>
              <Text style={styles.statNumber}>{data.totalLinkClicks.toLocaleString()}</Text>
              <Text style={styles.statDelta}>{delta(data.totalLinkClicks, data.prevTotalLinkClicks)}</Text>
            </View>
          </View>

          {/* Link clicks */}
          <Text style={styles.sectionLabel}>Link Clicks</Text>

          {data.linkClicks.length === 0 ? (
            <Text style={styles.empty}>No clicks yet — share your card to get started.</Text>
          ) : (
            <View style={styles.linkList}>
              {data.linkClicks.map((item) => (
                <View key={item.linkId} style={styles.linkStat}>
                  <Text style={styles.linkStatName} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.linkStatCount}>{item.count}</Text>
                </View>
              ))}
            </View>
          )}

          {data.trackingSince && (
            <Text style={styles.trackingNote}>
              Tracking since {formatTrackingSince(data.trackingSince)}
            </Text>
          )}
        </ScrollView>
      ) : null}

      <PaywallSheet visible={showPaywall} onClose={() => { setShowPaywall(false); router.back(); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
  },
  heading: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.02 * 18 },
  period: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.05 * 10, textTransform: 'uppercase' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 60, gap: 10 },
  statRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, paddingHorizontal: 16, gap: 3,
  },
  statCardFlex: { flex: 1 },
  statLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.06 * 10, textTransform: 'uppercase' },
  statNumber: { fontSize: 30, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.03 * 30, lineHeight: 33 },
  statDelta: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.accent, marginTop: 2 },
  sectionLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.08 * 10, textTransform: 'uppercase', paddingLeft: 2 },
  empty: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 20 },
  linkList: { gap: 7 },
  linkStat: {
    height: 44, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  linkStatName: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.text, flex: 1, marginRight: 8 },
  linkStatCount: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.accent },
  trackingNote: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: 'center', paddingTop: 4 },
});
