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
import { CardEditSheet } from '../../components/Card/CardEditSheet';
import { CardFieldSheet } from '../../components/Card/CardFieldSheet';
import { CardPreview } from '../../components/Card/CardPreview';
import { PaywallSheet } from '../../components/Card/PaywallSheet';
import { ShareSheet } from '../../components/Card/ShareSheet';
import { SettingsSheet } from '../../components/Profile/SettingsSheet';
import { useApi, Card, CardField, User } from '../../lib/api';
import { useRevenueCat } from '../../lib/RevenueCatContext';
import { COLORS, FONTS } from '../../constants/colors';

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
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // New card creation sheet (existing cards go to full-screen edit-card route)
  const [showNewCard, setShowNewCard] = useState(false);

  const [showFieldEdit, setShowFieldEdit] = useState(false);
  const [fieldEditContext, setFieldEditContext] = useState<{ cardId: string; field: CardField | null } | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const [u, cs] = await Promise.all([api.getMe(), api.getMyCards()]);
      setUser(u);
      setCards(cs);
    } catch {}
    setLoading(false);
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const activeCard = cards[activeIndex] ?? null;
  const activeAccent = activeCard?.accentColor ?? COLORS.accent;

  // ── Card CRUD ──────────────────────────────────────────────────────────────

  const handleSaveNewCard = async (data: { name: string; accentColor: string }) => {
    const created = await api.addCard(data);
    const nextIndex = cards.length;
    setCards((cs) => [...cs, created]);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }, 100);
  };

  const handlePressAddCard = () => {
    if (!isPro && cards.length >= 3) { setShowPaywall(true); return; }
    setShowNewCard(true);
  };

  // ── Field CRUD ─────────────────────────────────────────────────────────────

  const handleSaveField = async (
    cardId: string,
    data: { type: string; value: string; label?: string },
    fieldId?: string
  ) => {
    if (fieldId) {
      const updated = await api.updateField(cardId, fieldId, { value: data.value, label: data.label });
      setCards((cs) =>
        cs.map((c) =>
          c.id === cardId
            ? { ...c, fields: c.fields.map((f) => f.id === fieldId ? updated : f) }
            : c
        )
      );
    } else {
      const created = await api.addField(cardId, data);
      setCards((cs) =>
        cs.map((c) => c.id === cardId ? { ...c, fields: [...c.fields, created] } : c)
      );
    }
  };

  const handleDeleteField = async (cardId: string, fieldId: string) => {
    await api.deleteField(cardId, fieldId);
    setCards((cs) =>
      cs.map((c) => c.id === cardId ? { ...c, fields: c.fields.filter((f) => f.id !== fieldId) } : c)
    );
  };

  const openFieldEdit = (cardId: string, field: CardField | null) => {
    setFieldEditContext({ cardId, field });
    setShowFieldEdit(true);
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
          <Pressable style={styles.iconBtn} onPress={() => setShowShare(true)}>
            <Ionicons name="share-outline" size={20} color={COLORS.text} />
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
              <Pressable
                onLongPress={() => router.push({ pathname: '/edit-card', params: { cardId: item.id } })}
                delayLongPress={400}
              >
                <CardPreview
                  card={item}
                  user={user!}
                  onEditField={(field) => openFieldEdit(item.id, field)}
                  onAddField={() => openFieldEdit(item.id, null)}
                />
              </Pressable>
            </View>
          )}
        />
      )}

      {/* Dots + Add */}
      <View style={styles.dotsRow}>
        {cards.map((c, i) => (
          <View
            key={c.id}
            style={[styles.dot, i === activeIndex && { backgroundColor: activeAccent, width: 16 }]}
          />
        ))}
        <Pressable style={[styles.addBtn, { borderColor: activeAccent + '66' }]} onPress={handlePressAddCard}>
          <Text style={[styles.addBtnText, { color: activeAccent }]}>+</Text>
        </Pressable>
      </View>

      {/* Share button */}
      <View style={styles.shareWrapper}>
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
        onClose={() => setShowShare(false)}
        onUsernameChange={(u) => setUser((prev) => prev ? { ...prev, username: u } : prev)}
      />
      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onShowPaywall={() => setShowPaywall(true)}
      />
      <CardEditSheet
        visible={showNewCard}
        card={null}
        onClose={() => setShowNewCard(false)}
        onSave={handleSaveNewCard}
      />
      <CardFieldSheet
        visible={showFieldEdit}
        cardId={fieldEditContext?.cardId ?? ''}
        field={fieldEditContext?.field ?? null}
        onClose={() => { setShowFieldEdit(false); setFieldEditContext(null); }}
        onSave={handleSaveField}
        onDelete={handleDeleteField}
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
  addBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 4,
  },
  addBtnText: { fontSize: 18, lineHeight: 20, fontFamily: FONTS.light },
  shareWrapper: { paddingHorizontal: 20, paddingBottom: 16 },
  shareBtn: {
    width: '100%', height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#0C0C0E', letterSpacing: 1 },
});
