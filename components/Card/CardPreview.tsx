import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Animated, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, CardAnalytics, CardField, User } from '../../lib/api';
import { APP_FIELD_DISPLAY, parseAppLinks } from '../../lib/appField';
import { COLORS, FONTS } from '../../constants/colors';
import { formatPhone } from '../../lib/format';

const CARD_FONTS: Record<string, { regular: string; medium: string; semiBold: string }> = {
  'dm-sans':       { regular: 'DMSans-Regular',          medium: 'DMSans-Medium',          semiBold: 'DMSans-SemiBold' },
  'playfair':      { regular: 'PlayfairDisplay-Regular',  medium: 'PlayfairDisplay-Medium',  semiBold: 'PlayfairDisplay-SemiBold' },
  'space-grotesk': { regular: 'SpaceGrotesk-Regular',     medium: 'SpaceGrotesk-Medium',     semiBold: 'SpaceGrotesk-SemiBold' },
  'nunito':        { regular: 'Nunito-Regular',           medium: 'Nunito-Medium',           semiBold: 'Nunito-SemiBold' },
};

const { height: SCREEN_H } = Dimensions.get('window');
const MAX_CARD_H = SCREEN_H - 350; // fallback only — cards.tsx passes an accurate maxHeight

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
  app:        'logo-apple-appstore',
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
    case 'app': {
      // This app runs on iOS, so prefer the App Store link
      const links = parseAppLinks(v);
      return links.ios ?? links.android ?? '';
    }
    case 'title':
    case 'company':
    case 'department':
    case 'headline':   return '';
    default:           return v.startsWith('http') ? v : `https://${v}`;
  }
}

function fieldDisplayValue(field: CardField): string {
  if (field.label) return field.label;
  if (field.type === 'phone') return formatPhone(field.value);
  if (field.type === 'app') return APP_FIELD_DISPLAY;
  return field.value;
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
  onPreview?: () => void;
  /** Fires when the user pulls down while the card content is at the top. */
  onPullRefresh?: () => void;
  /** Free tier: back face shows the views teaser; field click counts are gold-locked. */
  analyticsLocked?: boolean;
  onUnlockAnalytics?: () => void;
}

export function CardPreview({ card, user, analytics, maxHeight, onPreview, onPullRefresh, analyticsLocked, onUnlockAnalytics }: Props) {
  const accent = card.accentColor;
  const fonts = CARD_FONTS[card.font ?? 'dm-sans'] ?? CARD_FONTS['dm-sans'];
  const initial = (user.displayName ?? user.username ?? '?')[0].toUpperCase();
  const capH = maxHeight ?? MAX_CARD_H;
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  // Pull-to-refresh: the card scroll stops dead at the top (no bounce). A
  // pull that STARTS with content at the top is measured on the wrapper's
  // raw touches; past the threshold it fires onPullRefresh once.
  const atTopRef = useRef(true);
  const backAtTopRef = useRef(true);
  const touchStartYRef = useRef(0);
  const startedAtTopRef = useRef(false);
  const pullTriggeredRef = useRef(false);

  const flip = () => {
    const toValue = isFlipped ? 0 : 1;
    setIsFlipped(!isFlipped);
    Animated.spring(flipAnim, { toValue, useNativeDriver: false, friction: 8, tension: 10 }).start();
  };

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <View
      style={styles.card}
      onTouchStart={(e) => {
        touchStartYRef.current = e.nativeEvent.pageY;
        // "At top" of whichever face is showing — refresh works from both
        startedAtTopRef.current = isFlipped ? backAtTopRef.current : atTopRef.current;
        pullTriggeredRef.current = false;
      }}
      onTouchMove={(e) => {
        if (
          onPullRefresh &&
          !pullTriggeredRef.current &&
          startedAtTopRef.current &&
          e.nativeEvent.pageY - touchStartYRef.current > 80
        ) {
          pullTriggeredRef.current = true;
          onPullRefresh();
        }
      }}
    >
      {/* ── Front face ── */}
      <Animated.View
        pointerEvents={isFlipped ? 'none' : 'auto'}
        style={[styles.face, { transform: [{ rotateY: frontRotate }] }]}
      >
        <ScrollView
          style={{ maxHeight: capH, borderRadius: 22 }}
          showsVerticalScrollIndicator={false}
          bounces={false}
          onScroll={(e) => {
            atTopRef.current = e.nativeEvent.contentOffset.y <= 0;
          }}
          scrollEventThrottle={16}
        >
          {/* Banner — tapping opens the public card */}
          <Pressable style={styles.banner} onPress={onPreview}>
            {card.photo ? (
              <Image source={{ uri: card.photo }} style={styles.bannerImg} />
            ) : (
              <View style={[styles.bannerPlaceholder, { backgroundColor: accent + '22' }]}>
                <Text style={[styles.bannerInitial, { color: accent }]}>{initial}</Text>
              </View>
            )}
            <View style={styles.labelPill}>
              <Text style={styles.labelText}>{card.name.toUpperCase()}</Text>
            </View>
          </Pressable>

          {/* Identity — tapping opens the public card */}
          <Pressable style={styles.identity} onPress={onPreview}>
            <Text style={[styles.name, { fontFamily: fonts.semiBold }]}>{user.displayName ?? user.username ?? ''}</Text>
            {(() => {
              const title      = card.fields.find(f => f.type === 'title')?.value;
              const department = card.fields.find(f => f.type === 'department')?.value;
              const company    = card.fields.find(f => f.type === 'company')?.value;
              const headline   = card.fields.find(f => f.type === 'headline')?.value;
              return (
                <>
                  {title      ? <Text style={[styles.jobTitle,   { fontFamily: fonts.semiBold }]}>{title}</Text>      : null}
                  {department ? <Text style={[styles.department, { fontFamily: fonts.regular  }]}>{department}</Text> : null}
                  {company    ? <Text style={[styles.company,    { fontFamily: fonts.regular  }]}>{company}</Text>    : null}
                  {headline   ? <Text style={[styles.headline,   { fontFamily: fonts.regular  }]}>{headline}</Text>   : null}
                </>
              );
            })()}
          </Pressable>

          {/* Fields */}
          <View style={styles.fields}>
            {card.fields
              .filter(f => !['title', 'company', 'department', 'headline'].includes(f.type))
              .map((field) => (
                <Pressable
                  key={field.id}
                  style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed]}
                  onPress={onPreview}
                >
                  <View style={[styles.fieldIcon, { backgroundColor: accent }]}>
                    <Ionicons name={FIELD_ICONS[field.type] ?? FIELD_ICONS.custom} size={16} color="#fff" />
                  </View>
                  <Text style={[styles.fieldValue, { fontFamily: fonts.regular }]} numberOfLines={1}>
                    {fieldDisplayValue(field)}
                  </Text>
                </Pressable>
              ))}
          </View>
        </ScrollView>
      </Animated.View>

      {/* ── Back face ── */}
      <Animated.View
        pointerEvents={isFlipped ? 'auto' : 'none'}
        style={[styles.face, styles.backFace, StyleSheet.absoluteFill, { transform: [{ rotateY: backRotate }] }]}
      >
        <View style={[styles.backHeader, { backgroundColor: accent + '22', borderBottomColor: accent + '33' }]}>
          <Text style={[styles.backCardName, { color: accent }]}>{card.name.toUpperCase()}</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          onScroll={(e) => {
            backAtTopRef.current = e.nativeEvent.contentOffset.y <= 0;
          }}
          scrollEventThrottle={16}
        >
          {/* Views summary */}
          <View style={styles.backViewsSection}>
            <Text style={styles.backPeriod}>LAST 30 DAYS</Text>
            <Text style={styles.backViews}>
              {analytics ? analytics.views.toLocaleString() : '—'}
            </Text>
            <Text style={styles.backViewsLabel}>card views</Text>
            {!analyticsLocked && analytics && analytics.prevViews > 0 && (
              <View style={[styles.backDeltaPill, { backgroundColor: accent + '22' }]}>
                <Text style={[styles.backDelta, { color: accent }]}>
                  {deltaText(analytics.views, analytics.prevViews)}
                </Text>
              </View>
            )}
            {!analyticsLocked && !analytics && (
              <Text style={styles.backEmpty}>No analytics data yet</Text>
            )}
          </View>

          {/* Field clicks breakdown — free tier sees the same list, with a
              gold lock badge standing in for each click count */}
          {analytics && analytics.fieldClicks.length > 0 && (
            <>
              <View style={[styles.backDivider, { backgroundColor: accent + '22' }]} />
              <View style={styles.backFieldsSection}>
                <Text style={styles.backSectionLabel}>FIELD CLICKS</Text>
                {analytics.fieldClicks.map((fc) => (
                  <Pressable
                    key={fc.fieldId}
                    style={styles.backFieldRow}
                    disabled={!analyticsLocked}
                    onPress={analyticsLocked ? onUnlockAnalytics : undefined}
                  >
                    <View style={[styles.backFieldIcon, { backgroundColor: accent + '22' }]}>
                      <Ionicons name={FIELD_ICONS[fc.fieldType] ?? FIELD_ICONS.custom} size={13} color={accent} />
                    </View>
                    <Text style={styles.backFieldName} numberOfLines={1}>
                      {fc.label ?? (fc.fieldType === 'app' ? APP_FIELD_DISPLAY : fc.fieldValue)}
                    </Text>
                    {analyticsLocked ? (
                      <View style={styles.backFieldLock}>
                        <Ionicons name="lock-closed" size={11} color="#0C0C0E" />
                      </View>
                    ) : (
                      <Text style={[styles.backFieldClicks, { color: accent }]}>
                        {fc.clicks}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Flip button — top-right */}
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
  department: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
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
    paddingBottom: 0,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    position: 'relative',
  },
  backCardName: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    letterSpacing: 1.2,
  },
  backViewsSection: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
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
    marginBottom: 8,
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
  backDivider: {
    height: 1,
    marginHorizontal: 18,
  },
  backFieldLock: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFieldsSection: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 4,
  },
  backSectionLabel: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1,
    marginBottom: 10,
  },
  backFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  backFieldIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFieldName: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.75)',
  },
  backFieldClicks: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
});
