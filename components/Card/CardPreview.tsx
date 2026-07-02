import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Animated, Dimensions, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, CardAnalytics, CardField, User } from '../../lib/api';
import { FONTS } from '../../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');
// Leave room for top bar (~60px), dots (~34px), action row (~84px), safe area (~50px), padding
const MAX_CARD_H = SCREEN_H - 250;

const FIELD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  email:      'mail',
  phone:      'call',
  website:    'globe-outline',
  instagram:  'logo-instagram',
  twitter:    'logo-twitter',
  linkedin:   'logo-linkedin',
  tiktok:     'logo-tiktok',
  youtube:    'logo-youtube',
  title:      'briefcase-outline',
  company:    'business-outline',
  facebook:   'logo-facebook',
  whatsapp:   'logo-whatsapp',
  spotify:    'musical-notes-outline',
  department: 'people-outline',
  headline:   'document-text-outline',
  custom:     'ellipsis-horizontal',
};

function fieldUrl(field: CardField): string {
  const v = field.value.trim();
  switch (field.type) {
    case 'email':      return `mailto:${v}`;
    case 'phone':      return `tel:${v}`;
    case 'instagram':  return `https://instagram.com/${v.replace('@', '')}`;
    case 'twitter':    return `https://twitter.com/${v.replace('@', '')}`;
    case 'linkedin':   return `https://linkedin.com/in/${v.replace('@', '')}`;
    case 'tiktok':     return `https://tiktok.com/@${v.replace('@', '')}`;
    case 'youtube':    return `https://youtube.com/@${v.replace('@', '')}`;
    case 'facebook':   return `https://facebook.com/${v.replace('@', '')}`;
    case 'whatsapp':   return `https://wa.me/${v.replace(/\D/g, '')}`;
    case 'spotify':    return `https://open.spotify.com/user/${v.replace('@', '')}`;
    case 'title':
    case 'company':
    case 'department':
    case 'headline':   return '';
    default:           return v.startsWith('http') ? v : `https://${v}`;
  }
}

function fieldDisplayValue(field: CardField): string {
  return field.label ?? field.value;
}

function deltaText(views: number, prevViews: number): string {
  if (prevViews === 0) return views > 0 ? '↑ New data' : 'No views yet';
  const pct = Math.round(((views - prevViews) / prevViews) * 100);
  return pct >= 0 ? `↑ ${pct}% vs last month` : `↓ ${Math.abs(pct)}% vs last month`;
}

interface Props {
  card: Card;
  user: User;
  analytics?: CardAnalytics;
  maxHeight?: number;
}

export function CardPreview({ card, user, analytics, maxHeight }: Props) {
  const accent = card.accentColor;
  const initial = (user.displayName ?? user.username ?? '?')[0].toUpperCase();
  const [cardHeight, setCardHeight] = useState<number | undefined>();
  const effectiveHeight = maxHeight ?? cardHeight;
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  const flip = () => {
    const toValue = isFlipped ? 0 : 1;
    setIsFlipped(!isFlipped);
    Animated.spring(flipAnim, { toValue, useNativeDriver: true, friction: 8, tension: 10 }).start();
  };

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <View style={[styles.card, effectiveHeight ? { height: effectiveHeight } : { maxHeight: MAX_CARD_H }]}>
      {/* ── Front face ── */}
      <Animated.View
        style={[styles.face, { transform: [{ rotateY: frontRotate }] }, effectiveHeight ? { height: effectiveHeight } : {}]}
        onLayout={(e) => {
          if (!maxHeight && !cardHeight) setCardHeight(Math.min(e.nativeEvent.layout.height, MAX_CARD_H));
        }}
      >
        <ScrollView style={effectiveHeight ? { flex: 1 } : undefined} showsVerticalScrollIndicator={false} bounces={false}>
          {/* Banner */}
          <View style={styles.banner}>
            {user.profilePhoto ? (
              <Image source={{ uri: user.profilePhoto }} style={styles.bannerImg} />
            ) : (
              <View style={[styles.bannerPlaceholder, { backgroundColor: accent + '22' }]}>
                <Text style={[styles.bannerInitial, { color: accent }]}>{initial}</Text>
              </View>
            )}
            <View style={styles.labelPill}>
              <Text style={styles.labelText}>{card.name.toUpperCase()}</Text>
            </View>
          </View>

          {/* Identity */}
          <View style={styles.identity}>
            <Text style={styles.name}>{user.displayName ?? user.username ?? ''}</Text>
            {(() => {
              const title   = card.fields.find(f => f.type === 'title')?.value;
              const company = card.fields.find(f => f.type === 'company')?.value;
              const headline = card.fields.find(f => f.type === 'headline')?.value;
              return (
                <>
                  {title   ? <Text style={styles.jobTitle}>{title}</Text>   : null}
                  {company ? <Text style={styles.company}>{company}</Text>   : null}
                  {headline ? <Text style={styles.headline}>{headline}</Text> : null}
                </>
              );
            })()}
          </View>

          {/* Fields */}
          <View style={styles.fields}>
            {card.fields
              .filter(f => !['title', 'company', 'department', 'headline'].includes(f.type))
              .map((field) => (
                <Pressable
                  key={field.id}
                  style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed]}
                  onPress={() => { const url = fieldUrl(field); if (url) Linking.openURL(url).catch(() => {}); }}
                >
                  <View style={[styles.fieldIcon, { backgroundColor: accent }]}>
                    <Ionicons name={FIELD_ICONS[field.type] ?? FIELD_ICONS.custom} size={16} color="#fff" />
                  </View>
                  <Text style={styles.fieldValue} numberOfLines={1}>
                    {fieldDisplayValue(field)}
                  </Text>
                </Pressable>
              ))}
          </View>
        </ScrollView>
      </Animated.View>

      {/* ── Back face ── */}
      {effectiveHeight && (
        <Animated.View
          style={[styles.face, styles.backFace, StyleSheet.absoluteFill, { transform: [{ rotateY: backRotate }] }]}
        >
          <View style={[styles.backHeader, { backgroundColor: accent + '22', borderBottomColor: accent + '33' }]}>
            <Text style={[styles.backCardName, { color: accent }]}>{card.name.toUpperCase()}</Text>
          </View>

          <View style={styles.backContent}>
            <Text style={styles.backPeriod}>LAST 30 DAYS</Text>
            <Text style={styles.backViews}>
              {analytics ? analytics.views.toLocaleString() : '—'}
            </Text>
            <Text style={styles.backViewsLabel}>profile views</Text>

            {analytics && (
              <View style={[styles.backDeltaPill, { backgroundColor: accent + '22' }]}>
                <Text style={[styles.backDelta, { color: accent }]}>
                  {deltaText(analytics.views, analytics.prevViews)}
                </Text>
              </View>
            )}
            {!analytics && (
              <Text style={styles.backEmpty}>No analytics data yet</Text>
            )}
          </View>
        </Animated.View>
      )}

      {/* Flip button on outer card — above both animated faces, never blocked */}
      <Pressable style={styles.flipBtn} onPress={flip} hitSlop={8}>
        <Ionicons
          name={isFlipped ? 'card-outline' : 'stats-chart-outline'}
          size={14}
          color="rgba(255,255,255,0.75)"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161616',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  face: {
    backfaceVisibility: 'hidden',
  },
  backFace: {
    backgroundColor: '#161616',
    borderRadius: 22,
  },
  flipBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    width: '100%',
    height: 190,
    position: 'relative',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerInitial: {
    fontSize: 64,
    fontFamily: FONTS.semiBold,
  },
  labelPill: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  labelText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    letterSpacing: 1.2,
  },
  identity: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  name: {
    fontSize: 20,
    fontFamily: FONTS.semiBold,
    color: '#fff',
    letterSpacing: -0.3,
  },
  jobTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 3,
  },
  company: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
  headline: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 5,
    lineHeight: 16,
  },
  fields: {
    paddingBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  fieldRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#fff',
  },

  // Back face
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    position: 'relative',
  },
  backCardName: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    letterSpacing: 1.2,
  },
  backContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  backPeriod: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1,
    marginBottom: 8,
  },
  backViews: {
    fontSize: 64,
    fontFamily: FONTS.semiBold,
    color: '#fff',
    letterSpacing: -2,
    lineHeight: 68,
  },
  backViewsLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 16,
  },
  backDeltaPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  backDelta: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    letterSpacing: 0.2,
  },
  backEmpty: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 8,
  },
});
