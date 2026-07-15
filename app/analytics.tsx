import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaywallSheet } from '../components/Card/PaywallSheet';
import { useApi, AnalyticsData, CardAnalytics, FieldClickStat } from '../lib/api';
import { useRevenueCat } from '../lib/RevenueCatContext';
import { COLORS, FONTS } from '../constants/colors';

const FIELD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  email: 'mail', phone: 'call', website: 'globe-outline',
  instagram: 'logo-instagram', twitter: 'logo-twitter', linkedin: 'logo-linkedin',
  tiktok: 'logo-tiktok', youtube: 'logo-youtube', facebook: 'logo-facebook',
  whatsapp: 'logo-whatsapp', spotify: 'musical-notes-outline', custom: 'ellipsis-horizontal',
};

function delta(current: number, prev: number): string {
  if (prev === 0) return current > 0 ? '↑ New' : '—';
  const pct = Math.round(((current - prev) / prev) * 100);
  return pct >= 0 ? `↑ ${pct}%` : `↓ ${Math.abs(pct)}%`;
}

function formatTrackingSince(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function FieldClickRow({ stat }: { stat: FieldClickStat }) {
  const icon = (stat.fieldIcon as keyof typeof Ionicons.glyphMap) || FIELD_ICONS[stat.fieldType] || 'ellipsis-horizontal';
  const label = stat.label ?? stat.fieldValue;
  const d = delta(stat.clicks, stat.prevClicks);
  const hasChange = stat.prevClicks > 0;
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldIconWrap}>
        <Ionicons name={icon} size={14} color={COLORS.textSecondary} />
      </View>
      <Text style={styles.fieldLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.fieldClicks}>{stat.clicks}</Text>
      {hasChange && <Text style={[styles.fieldDelta, { color: stat.clicks >= stat.prevClicks ? COLORS.accent : COLORS.danger }]}>{d}</Text>}
    </View>
  );
}

function CardStat({ card, isPro, onUnlock }: { card: CardAnalytics; isPro: boolean; onUnlock: () => void }) {
  const hasFields = card.fieldClicks.length > 0;
  return (
    <View style={[styles.statCard, { borderLeftColor: card.accentColor, borderLeftWidth: 3 }]}>
      <Text style={[styles.cardName, { color: card.accentColor }]}>{card.cardName.toUpperCase()}</Text>

      {/* Card views — last 30 days is a Pro feature */}
      <Pressable style={styles.viewRow} disabled={isPro} onPress={onUnlock}>
        <View>
          <Text style={styles.statLabel}>Card Views (30 days)</Text>
          {isPro ? (
            <Text style={styles.statNumber}>{card.views.toLocaleString()}</Text>
          ) : (
            <View style={styles.lockRow}>
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={11} color="#0C0C0E" />
              </View>
              <Text style={styles.lockText}>Pro</Text>
            </View>
          )}
        </View>
        {isPro && (
          <Text style={[styles.statDelta, card.views === 0 && { color: COLORS.textTertiary }]}>
            {delta(card.views, card.prevViews)}
          </Text>
        )}
      </Pressable>

      {/* Field clicks */}
      {hasFields && (
        <>
          <View style={styles.fieldSep} />
          <Text style={styles.fieldSectionLabel}>FIELD CLICKS</Text>
          {card.fieldClicks.map((stat) => (
            <FieldClickRow key={stat.fieldId} stat={stat} />
          ))}
        </>
      )}
    </View>
  );
}

export default function AnalyticsScreen() {
  const api = useApi();
  const { isPro } = useRevenueCat();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

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
          {/* Total card views — last 30 days is a Pro feature */}
          <Pressable style={styles.statCard} disabled={isPro} onPress={() => setShowPaywall(true)}>
            <Text style={styles.statLabel}>Total Card Views</Text>
            {isPro ? (
              <View style={styles.viewRow}>
                <Text style={styles.statNumberLarge}>{data.totalCardViews.toLocaleString()}</Text>
                <Text style={styles.statDelta}>{delta(data.totalCardViews, data.prevTotalCardViews)}</Text>
              </View>
            ) : (
              <View style={styles.lockRow}>
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={13} color="#0C0C0E" />
                </View>
                <Text style={styles.lockText}>Unlock with Pro</Text>
              </View>
            )}
          </Pressable>

          {/* Per-card breakdown */}
          {data.cardBreakdown.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>BY CARD</Text>
              {data.cardBreakdown.map((card) => (
                <CardStat key={card.cardId} card={card} isPro={isPro} onUnlock={() => setShowPaywall(true)} />
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
      <PaywallSheet visible={showPaywall} onClose={() => setShowPaywall(false)} />
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
  viewRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  lockBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
  },
  lockText: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.text },
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

  fieldSep: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  fieldSectionLabel: { fontSize: 9, fontFamily: FONTS.medium, color: COLORS.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  fieldIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  fieldLabel: { flex: 1, fontSize: 13, fontFamily: FONTS.regular, color: COLORS.text },
  fieldClicks: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.text, minWidth: 24, textAlign: 'right' },
  fieldDelta: { fontSize: 10, fontFamily: FONTS.medium, minWidth: 36, textAlign: 'right' },
});
