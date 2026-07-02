import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApi, AnalyticsData, CardAnalytics } from '../lib/api';
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

function CardStat({ card }: { card: CardAnalytics }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: card.accentColor, borderLeftWidth: 3 }]}>
      <Text style={[styles.cardName, { color: card.accentColor }]}>{card.cardName.toUpperCase()}</Text>
      <View style={styles.statRow}>
        <View>
          <Text style={styles.statLabel}>Views (30 days)</Text>
          <Text style={styles.statNumber}>{card.views.toLocaleString()}</Text>
        </View>
        <Text style={[styles.statDelta, card.views === 0 && { color: COLORS.textTertiary }]}>
          {delta(card.views, card.prevViews)}
        </Text>
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const api = useApi();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.getAnalytics().then(setData).catch(() => {}).finally(() => setLoading(false));
    }, [])
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
          {/* Total profile views */}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Profile Views</Text>
            <View style={styles.statRow}>
              <Text style={styles.statNumberLarge}>{data.profileViews.toLocaleString()}</Text>
              <Text style={styles.statDelta}>{delta(data.profileViews, data.prevProfileViews)}</Text>
            </View>
          </View>

          {/* Per-card breakdown */}
          {data.cardBreakdown.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>BY CARD</Text>
              {data.cardBreakdown.map((card) => (
                <CardStat key={card.cardId} card={card} />
              ))}
            </>
          )}

          {data.trackingSince && (
            <Text style={styles.trackingNote}>
              Tracking since {formatTrackingSince(data.trackingSince)}
            </Text>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
  },
  heading: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.36 },
  period: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40, gap: 10 },
  statCard: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 18, gap: 8,
  },
  statRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  cardName: { fontSize: 10, fontFamily: FONTS.semiBold, letterSpacing: 1 },
  statLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  statNumberLarge: { fontSize: 40, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -1.2, lineHeight: 44 },
  statNumber: { fontSize: 28, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.8 },
  statDelta: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.accent, marginBottom: 4 },
  sectionHeader: {
    fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary,
    letterSpacing: 0.8, marginTop: 6,
  },
  trackingNote: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: 'center', marginTop: 4 },
});
