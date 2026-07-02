import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardPreview } from '../../components/Card/CardPreview';
import { PaywallSheet } from '../../components/Card/PaywallSheet';
import { ShareSheet } from '../../components/Card/ShareSheet';
import { SettingsSheet } from '../../components/Profile/SettingsSheet';
import { useApi, Card, CardAnalytics, User } from '../../lib/api';
import { useRevenueCat } from '../../lib/RevenueCatContext';
import { COLORS, FONTS } from '../../constants/colors';

const ACCENT_COLORS = ['#C9A84C', '#7C3AED', '#22C55E', '#F43F5E', '#0EA5E9', '#F97316', '#EC4899', '#14B8A6'];

const { width: SCREEN_W } = Dimensions.get('window');
const SIDE_INSET = 24;
const CARD_GAP = 12;
const CARD_WIDTH = SCREEN_W - SIDE_INSET * 2;

export default function CardScreen() {
  const api = useApi();
  const router = useRouter();
  const { isPro } = useRevenueCat();

  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [cardAnalytics, setCardAnalytics] = useState<CardAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const [u, cs, analytics] = await Promise.all([api.getMe(), api.getMyCards(), api.getAnalytics()]);
      setUser(u);
      setCards(cs);
      setCardAnalytics(analytics.cardBreakdown ?? []);
    } catch {}
    setLoading(false);
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const activeCard = cards[activeIndex] ?? null;
  const activeAccent = activeCard?.accentColor ?? COLORS.accent;

  // ── Card CRUD ──────────────────────────────────────────────────────────────

  const handlePressAddCard = async () => {
    if (!isPro && cards.length >= 2) { setShowPaywall(true); return; }
    const created = await api.addCard({ name: 'New Card', accentColor: ACCENT_COLORS[0] });
    setCards((cs) => [...cs, created]);
    router.push({ pathname: '/edit-card', params: { cardId: created.id } });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.heading}>Cards</Text>
        <View style={styles.topRight}>
          <Pressable style={styles.iconBtn} onPress={handlePressAddCard}>
            <Ionicons name="add" size={22} color={COLORS.text} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={20} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      {/* Card carousel */}
      {cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No cards yet</Text>
          <Text style={styles.emptySub}>Tap + to create your first card</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={cards}
          keyExtractor={(c) => c.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={styles.carousel}
          ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP));
            setActiveIndex(Math.min(idx, cards.length - 1));
          }}
          renderItem={({ item }) => (
            <View style={{ width: CARD_WIDTH }}>
              <CardPreview
                card={item}
                user={user!}
                analytics={cardAnalytics.find((a) => a.cardId === item.id)}
              />
            </View>
          )}
        />
      )}

      {/* Dots */}
      <View style={styles.dotsRow}>
        {cards.map((c, i) => (
          <View
            key={c.id}
            style={[styles.dot, i === activeIndex && { backgroundColor: activeAccent, width: 16 }]}
          />
        ))}
      </View>

      {/* Action row */}
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.editBtn, !activeCard && { opacity: 0.4 }]}
          onPress={() => activeCard && router.push({ pathname: '/edit-card', params: { cardId: activeCard.id } })}
          disabled={!activeCard}
        >
          <Text style={styles.editBtnText}>EDIT</Text>
        </Pressable>
        <Pressable
          style={[styles.shareBtn, { backgroundColor: activeAccent }]}
          onPress={() => setShowShare(true)}
        >
          <Text style={styles.shareBtnText}>SHARE</Text>
        </Pressable>
      </View>

      {/* Sheets */}
      <ShareSheet
        visible={showShare}
        username={user?.username ?? ''}
        card={activeCard}
        onClose={() => setShowShare(false)}
        onUsernameChange={(u) => setUser((prev) => prev ? { ...prev, username: u } : prev)}
      />
      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onShowPaywall={() => setShowPaywall(true)}
      />
      <PaywallSheet visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
  },
  heading: { fontSize: 22, fontFamily: FONTS.semiBold, color: COLORS.text },
  topRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  carousel: { paddingHorizontal: SIDE_INSET, paddingBottom: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text },
  emptySub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  dotsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  actionRow: {
    flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 16, gap: 12,
  },
  editBtn: {
    flex: 1, height: 52, borderRadius: 16,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  editBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: 1 },
  shareBtn: {
    flex: 2, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#0C0C0E', letterSpacing: 1 },
});
