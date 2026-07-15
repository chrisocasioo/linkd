import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ColorPicker from 'react-native-wheel-color-picker';
import { CardFieldSheet } from '../components/Card/CardFieldSheet';
import { PaywallSheet } from '../components/Card/PaywallSheet';
import { useApi, Card, CardField, User } from '../lib/api';
import { APP_FIELD_DISPLAY } from '../lib/appField';
import { useRevenueCat } from '../lib/RevenueCatContext';
import { syncWidgetData } from '../lib/widgetSync';
import { COLORS, FONTS } from '../constants/colors';

const ACCENT_COLORS = ['#C9973A', '#7C3AED', '#22C55E', '#F43F5E', '#0EA5E9', '#EC4899'];
// QR Color/Background also offer black & white as one-tap quick picks inside
// the custom-color panel (not shown as swatches), so they count as "known".
const QR_SWATCH_COLORS = [...ACCENT_COLORS, '#000000', '#FFFFFF'];

const FONT_OPTIONS = [
  { id: 'dm-sans',        label: 'Modern',   preview: 'Aa', family: 'DMSans-SemiBold' },
  { id: 'playfair',       label: 'Elegant',  preview: 'Aa', family: 'PlayfairDisplay-SemiBold' },
  { id: 'space-grotesk',  label: 'Techy',    preview: 'Aa', family: 'SpaceGrotesk-SemiBold' },
  { id: 'nunito',         label: 'Friendly', preview: 'Aa', family: 'Nunito-SemiBold' },
  { id: 'oswald',         label: 'Bold',     preview: 'Aa', family: 'Oswald-SemiBold' },
  { id: 'roboto-slab',    label: 'Classic',  preview: 'Aa', family: 'RobotoSlab-SemiBold' },
  { id: 'caveat',         label: 'Casual',   preview: 'Aa', family: 'Caveat-SemiBold' },
  { id: 'jetbrains-mono', label: 'Code',     preview: 'Aa', family: 'JetBrainsMono-SemiBold' },
];
const FONT_ROWS = [FONT_OPTIONS.slice(0, 4), FONT_OPTIONS.slice(4, 8)];

const INFO_TYPES = new Set(['title', 'company', 'department', 'headline']);

type FieldChip = { type: string; label: string; icon: keyof typeof Ionicons.glyphMap };

const FIELD_CATEGORIES: Array<{ label: string; items: FieldChip[] }> = [
  {
    label: 'Contact',
    items: [
      { type: 'email',   label: 'Email',   icon: 'mail' },
      { type: 'phone',   label: 'Phone',   icon: 'call' },
      { type: 'website', label: 'Website', icon: 'globe-outline' },
      { type: 'address', label: 'Address', icon: 'location-outline' },
    ],
  },
  {
    label: 'Social',
    items: [
      { type: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
      { type: 'linkedin',  label: 'LinkedIn',  icon: 'logo-linkedin' },
      { type: 'twitter',   label: 'Twitter',   icon: 'logo-twitter' },
      { type: 'tiktok',    label: 'TikTok',    icon: 'logo-tiktok' },
      { type: 'youtube',   label: 'YouTube',   icon: 'logo-youtube' },
      { type: 'facebook',  label: 'Facebook',  icon: 'logo-facebook' },
      { type: 'snapchat',  label: 'Snapchat',  icon: 'logo-snapchat' },
      { type: 'pinterest', label: 'Pinterest', icon: 'logo-pinterest' },
      { type: 'threads',   label: 'Threads',   icon: 'logo-threads' },
    ],
  },
  {
    label: 'Messaging',
    items: [
      { type: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
      { type: 'telegram', label: 'Telegram', icon: 'paper-plane-outline' },
      { type: 'discord',  label: 'Discord',  icon: 'logo-discord' },
      { type: 'signal',   label: 'Signal',   icon: 'chatbubble-ellipses-outline' },
      { type: 'zoom',     label: 'Zoom',     icon: 'videocam-outline' },
    ],
  },
  {
    label: 'Payments',
    items: [
      { type: 'venmo',   label: 'Venmo',    icon: 'logo-venmo' },
      { type: 'paypal',  label: 'PayPal',   icon: 'logo-paypal' },
      { type: 'cashapp', label: 'Cash App', icon: 'cash-outline' },
      { type: 'zelle',   label: 'Zelle',    icon: 'card-outline' },
    ],
  },
  {
    label: 'Scheduling',
    items: [
      { type: 'calendly', label: 'Calendly', icon: 'calendar-outline' },
      { type: 'cal',      label: 'Cal.com',  icon: 'time-outline' },
      { type: 'acuity',   label: 'Acuity',   icon: 'calendar-clear-outline' },
      { type: 'booksy',   label: 'Booksy',   icon: 'today-outline' },
    ],
  },
  {
    label: 'Music & Media',
    items: [
      { type: 'spotify',    label: 'Spotify',    icon: 'musical-notes-outline' },
      { type: 'soundcloud', label: 'SoundCloud', icon: 'logo-soundcloud' },
      { type: 'applemusic', label: 'Apple Music', icon: 'logo-apple' },
      { type: 'vimeo',      label: 'Vimeo',      icon: 'logo-vimeo' },
      { type: 'twitch',     label: 'Twitch',     icon: 'logo-twitch' },
    ],
  },
  {
    label: 'Dev & Design',
    items: [
      { type: 'github',   label: 'GitHub',   icon: 'logo-github' },
      { type: 'behance',  label: 'Behance',  icon: 'logo-behance' },
      { type: 'dribbble', label: 'Dribbble', icon: 'logo-dribbble' },
    ],
  },
  {
    label: 'More',
    items: [
      { type: 'app',     label: 'App',     icon: 'logo-apple-appstore' },
      { type: 'patreon', label: 'Patreon', icon: 'heart-outline' },
      { type: 'custom',  label: 'Custom',  icon: 'ellipsis-horizontal' },
    ],
  },
];

const FIELD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  email:      'mail',
  phone:      'call',
  website:    'globe-outline',
  instagram:  'logo-instagram',
  twitter:    'logo-twitter',
  linkedin:   'logo-linkedin',
  tiktok:     'logo-tiktok',
  youtube:    'logo-youtube',
  facebook:   'logo-facebook',
  whatsapp:   'logo-whatsapp',
  spotify:    'musical-notes-outline',
  app:        'logo-apple-appstore',
  venmo:      'logo-venmo',
  paypal:     'logo-paypal',
  cashapp:    'cash-outline',
  zelle:      'card-outline',
  telegram:   'paper-plane-outline',
  discord:    'logo-discord',
  signal:     'chatbubble-ellipses-outline',
  zoom:       'videocam-outline',
  soundcloud: 'logo-soundcloud',
  applemusic: 'logo-apple',
  vimeo:      'logo-vimeo',
  twitch:     'logo-twitch',
  behance:    'logo-behance',
  dribbble:   'logo-dribbble',
  github:     'logo-github',
  snapchat:   'logo-snapchat',
  pinterest:  'logo-pinterest',
  threads:    'logo-threads',
  calendly:   'calendar-outline',
  cal:        'time-outline',
  acuity:     'calendar-clear-outline',
  booksy:     'today-outline',
  patreon:    'heart-outline',
  address:    'location-outline',
  title:      'briefcase-outline',
  company:    'business-outline',
  department: 'people-outline',
  headline:   'document-text-outline',
  custom:     'ellipsis-horizontal',
};

export default function EditCardScreen() {
  const api = useApi();
  const router = useRouter();
  const { cardId, isNew } = useLocalSearchParams<{ cardId: string; isNew?: string }>();
  // Unsaved new cards are scratch drafts — leaving via back (not Save) discards them
  const savedRef = useRef(false);

  const [tab, setTab] = useState<'display' | 'information' | 'fields'>('display');
  const [card, setCard] = useState<Card | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cardName, setCardName] = useState('');
  const [accent, setAccent] = useState('');
  const [cardFont, setCardFont] = useState('dm-sans');
  const [showPaywall, setShowPaywall] = useState(false);
  const { isPro } = useRevenueCat();

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [infoTitle, setInfoTitle] = useState('');
  const [company, setCompany] = useState('');
  const [department, setDepartment] = useState('');
  const [headline, setHeadline] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showHexInput, setShowHexInput] = useState(false);
  const [hexDraft, setHexDraft] = useState('');

  // QR branding — deliberately separate from the card's own accentColor/photo
  const [qrColor, setQrColor] = useState('#000000');
  const [qrBgColor, setQrBgColor] = useState('#FFFFFF');
  const [qrLogoUri, setQrLogoUri] = useState<string | null>(null);
  const [removeQrLogo, setRemoveQrLogo] = useState(false);
  const [showQrHexInput, setShowQrHexInput] = useState(false);
  const [qrHexDraft, setQrHexDraft] = useState('');
  const [showQrBgHexInput, setShowQrBgHexInput] = useState(false);
  const [qrBgHexDraft, setQrBgHexDraft] = useState('');

  const [showFieldSheet, setShowFieldSheet] = useState(false);
  const [fieldSheetCtx, setFieldSheetCtx] = useState<{ field: CardField | null; initialType?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [u, cards] = await Promise.all([api.getMe(), api.getMyCards()]);
        const found = cards.find((c) => c.id === cardId);
        if (!found) { router.back(); return; }
        setUser(u);
        setCard(found);
        setCardName(found.name);
        setAccent(found.accentColor);
        setCardFont(found.font ?? 'dm-sans');
        setQrColor(found.qrColor ?? '#000000');
        setQrBgColor(found.qrBgColor ?? '#FFFFFF');
        const nameParts = (u.displayName ?? '').split(' ');
        setFirstName(nameParts[0] ?? '');
        if (nameParts.length === 2) { setLastName(nameParts[1]); }
        else if (nameParts.length >= 3) { setMiddleName(nameParts[1]); setLastName(nameParts.slice(2).join(' ')); }
        setInfoTitle(found.fields.find((f) => f.type === 'title')?.value ?? '');
        setCompany(found.fields.find((f) => f.type === 'company')?.value ?? '');
        setDepartment(found.fields.find((f) => f.type === 'department')?.value ?? '');
        setHeadline(found.fields.find((f) => f.type === 'headline')?.value ?? '');
      } catch (err: any) {
        Alert.alert('Error', err.message);
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [cardId]);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access to change your photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePickQrLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access to set a QR logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setQrLogoUri(result.assets[0].uri);
      setRemoveQrLogo(false);
    }
  };

  const handleRemoveQrLogo = () => {
    setQrLogoUri(null);
    setRemoveQrLogo(true);
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('Add your name', 'Enter at least a first name before saving.');
      return;
    }
    const contactFieldCount = card!.fields.filter((f) => !INFO_TYPES.has(f.type)).length;
    if (contactFieldCount === 0) {
      Alert.alert('Add a field', 'Add at least one field (phone, email, etc.) on the Fields tab before saving.');
      return;
    }
    setSaving(true);
    try {
      const displayName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ');
      const infoFieldDefs = [
        { type: 'title',      value: infoTitle  },
        { type: 'company',    value: company    },
        { type: 'department', value: department },
        { type: 'headline',   value: headline   },
      ];

      // All independent — run in parallel instead of paying each round trip in sequence
      const ops: Promise<unknown>[] = [
        api.updateCard(cardId, {
          name: cardName.trim() || 'Card',
          accentColor: accent,
          font: cardFont,
          qrColor,
          qrBgColor,
          ...(removeQrLogo ? { qrLogo: null } : {}),
        }),
        ...infoFieldDefs.map(async ({ type, value }) => {
          const existing = card!.fields.find((f) => f.type === type);
          if (value.trim() && existing)       await api.updateField(cardId, existing.id, { value: value.trim() });
          else if (value.trim() && !existing) await api.addField(cardId, { type, value: value.trim() });
          else if (!value.trim() && existing) await api.deleteField(cardId, existing.id);
        }),
      ];
      if (photoUri) ops.push(api.uploadCardPhoto(cardId, photoUri));
      if (qrLogoUri) ops.push(api.uploadCardQrLogo(cardId, qrLogoUri));
      if (displayName) ops.push(api.updateMe({ displayName }));
      await Promise.all(ops);

      if (user?.username) {
        api.getMyCards().then((cs) => syncWidgetData(cs, user, user.username!)).catch(() => {});
      }

      savedRef.current = true;
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setSaving(false);
    }
  };

  const handleFieldSave = async (
    cId: string,
    data: { type: string; value: string; label?: string; icon?: string },
    fieldId?: string,
  ) => {
    if (fieldId) {
      const updated = await api.updateField(cId, fieldId, { value: data.value, label: data.label, icon: data.icon });
      setCard((c) => c ? { ...c, fields: c.fields.map((f) => f.id === fieldId ? updated : f) } : c);
    } else {
      const created = await api.addField(cId, data);
      setCard((c) => c ? { ...c, fields: [...c.fields, created] } : c);
    }
  };

  const handleFieldDelete = async (cId: string, fieldId: string) => {
    await api.deleteField(cId, fieldId);
    setCard((c) => c ? { ...c, fields: c.fields.filter((f) => f.id !== fieldId) } : c);
  };

  const handleMoveField = async (fieldId: string, direction: 'up' | 'down') => {
    if (!card) return;
    const contactFields = card.fields.filter((f) => !INFO_TYPES.has(f.type));
    const infoFields = card.fields.filter((f) => INFO_TYPES.has(f.type));
    const idx = contactFields.findIndex((f) => f.id === fieldId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= contactFields.length) return;
    const reordered = [...contactFields];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const items = reordered.map((f, i) => ({ id: f.id, order: i }));
    setCard((c) => c ? { ...c, fields: [...infoFields, ...reordered] } : c);
    try { await api.reorderFields(cardId, items); } catch {}
  };

  const handleBack = () => {
    // A brand-new card the user never explicitly saved is just a scratch
    // draft — leaving without saving discards it instead of leaving an
    // empty "New Card" behind
    if (isNew === 'true' && !savedRef.current) {
      api.deleteCard(cardId).catch(() => {});
    }
    router.back();
  };

  const handleDeleteCard = () => {
    Alert.alert('Delete Card', 'This card and all its fields will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.deleteCard(cardId);
            if (user?.username) {
              api.getMyCards().then((cs) => syncWidgetData(cs, user, user.username!)).catch(() => {});
            }
            router.back();
          } catch (err: any) {
            Alert.alert('Error', err.message);
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const openFieldSheet = (field: CardField | null, initialType?: string) => {
    setFieldSheetCtx({ field, initialType });
    setShowFieldSheet(true);
  };

  if (loading || !card || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const contactFields = card.fields.filter((f) => !INFO_TYPES.has(f.type));
  // Every type stays tappable even once added — users can add multiple
  // phone numbers, emails, social handles, etc. instead of just one each.
  const suggestedCategories = FIELD_CATEGORIES;
  const photoSource = photoUri ?? card.photo ?? null;
  const qrLogoSource = qrLogoUri ?? (removeQrLogo ? null : card.qrLogo ?? null);
  const initial = ((user.displayName ?? user.username ?? '?')[0]).toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerIconBtn} onPress={handleBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Card</Text>
        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderColor: accent + '33' }]}>
        {(['display', 'information', 'fields'] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabItem, tab === t && { backgroundColor: accent }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'display' ? 'Display' : t === 'information' ? 'Information' : 'Fields'}
            </Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Display Tab ── */}
          {tab === 'display' && (
            <>
              <View style={styles.photoRow}>
                <Pressable onPress={handlePickPhoto} style={styles.photoWrap}>
                  {photoSource ? (
                    <Image source={{ uri: photoSource }} style={styles.photoImg} />
                  ) : (
                    <View style={[styles.photoPlaceholder, { backgroundColor: accent + '22' }]}>
                      <Text style={[styles.photoInitial, { color: accent }]}>{initial}</Text>
                    </View>
                  )}
                  <View style={[styles.photoBadge, { backgroundColor: accent }]}>
                    <Ionicons name="pencil" size={11} color="#fff" />
                  </View>
                </Pressable>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>Card Name</Text>
                <TextInput
                  style={styles.input}
                  value={cardName}
                  onChangeText={setCardName}
                  placeholder="e.g. Work, Personal"
                  placeholderTextColor={COLORS.textTertiary}
                  maxLength={30}
                />

                <Text style={[styles.label, { marginTop: 20 }]}>Accent Color</Text>
                <View style={styles.colorRow}>
                  {/* Color picker swatch — custom accent color is a Pro feature */}
                  <Pressable
                    style={[
                      styles.colorDot, styles.colorPickerDot,
                      !ACCENT_COLORS.includes(accent) && styles.colorDotActive,
                      !ACCENT_COLORS.includes(accent) && { borderColor: accent },
                    ]}
                    onPress={() => {
                      if (!isPro) { setShowPaywall(true); return; }
                      setHexDraft(accent);
                      setShowHexInput((v) => !v);
                    }}
                  >
                    <Ionicons
                      name="color-palette-outline"
                      size={16}
                      color={!ACCENT_COLORS.includes(accent) ? accent : 'rgba(255,255,255,0.6)'}
                    />
                  </Pressable>

                  {ACCENT_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.colorDot, { backgroundColor: c }, accent === c && styles.colorDotActive]}
                      onPress={() => { setAccent(c); setShowHexInput(false); }}
                    >
                      {accent === c && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </Pressable>
                  ))}
                </View>

                {showHexInput && (
                  <>
                    <View style={styles.wheelWrap}>
                      <ColorPicker
                        color={accent}
                        onColorChangeComplete={(c: string) => {
                          setAccent(c);
                          setHexDraft(c);
                        }}
                        thumbSize={26}
                        sliderSize={26}
                        gapSize={20}
                        swatches={false}
                      />
                    </View>
                    <View style={styles.hexRow}>
                      <View style={[styles.hexPreview, { backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(hexDraft) ? hexDraft : COLORS.border }]} />
                      <TextInput
                        style={styles.hexInput}
                        value={hexDraft}
                        onChangeText={(v) => {
                          const clean = v.startsWith('#') ? v : '#' + v;
                          setHexDraft(clean);
                          if (/^#[0-9A-Fa-f]{6}$/.test(clean)) setAccent(clean);
                        }}
                        placeholder="#C9973A"
                        placeholderTextColor={COLORS.textTertiary}
                        autoCapitalize="characters"
                        maxLength={7}
                      />
                    </View>
                  </>
                )}

                <Text style={[styles.label, { marginTop: 20 }]}>Font</Text>
                {FONT_ROWS.map((row, rowIdx) => (
                  <View key={rowIdx} style={[styles.fontRow, rowIdx > 0 && { marginTop: 8 }]}>
                    {row.map((f) => {
                      const locked = !isPro && f.id !== 'dm-sans';
                      return (
                        <Pressable
                          key={f.id}
                          style={[styles.fontOption, cardFont === f.id && { borderColor: accent, backgroundColor: accent + '18' }]}
                          onPress={() => {
                            if (locked) { setShowPaywall(true); return; }
                            setCardFont(f.id);
                          }}
                        >
                          <Text style={[styles.fontPreview, { fontFamily: f.family }]}>{f.preview}</Text>
                          <View style={styles.fontLabelRow}>
                            {locked && <Ionicons name="lock-closed" size={8} color={COLORS.textTertiary} />}
                            <Text style={[styles.fontLabel, cardFont === f.id && { color: accent }]}>{f.label}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              <Text style={styles.sectionHeader}>QR CODE</Text>
              <View style={styles.card}>
                {!isPro && (
                  <Pressable style={styles.proLockOverlay} onPress={() => setShowPaywall(true)}>
                    <View style={styles.proLockBadge}>
                      <Ionicons name="lock-closed" size={13} color={COLORS.text} />
                      <Text style={styles.proLockText}>Unlock with Pro</Text>
                    </View>
                  </Pressable>
                )}
                <Text style={styles.label}>Logo</Text>
                <View style={styles.qrLogoRow}>
                  <Pressable onPress={handlePickQrLogo} style={styles.qrLogoWrap}>
                    {qrLogoSource ? (
                      <Image source={{ uri: qrLogoSource }} style={styles.qrLogoImg} />
                    ) : (
                      <View style={styles.qrLogoPlaceholder}>
                        <Ionicons name="image-outline" size={20} color={COLORS.textTertiary} />
                      </View>
                    )}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.qrLogoHint}>
                      Shown in the center of this card's QR code — independent from the card's own photo.
                    </Text>
                    <View style={styles.qrLogoActions}>
                      <Pressable onPress={handlePickQrLogo}>
                        <Text style={[styles.qrLogoActionText, { color: accent }]}>
                          {qrLogoSource ? 'Change' : 'Add Logo'}
                        </Text>
                      </Pressable>
                      {qrLogoSource && (
                        <Pressable onPress={handleRemoveQrLogo}>
                          <Text style={styles.qrLogoActionTextRemove}>Remove</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>

                <Text style={[styles.label, { marginTop: 20 }]}>QR Color</Text>
                <View style={styles.colorRow}>
                  <Pressable
                    style={[
                      styles.colorDot, styles.colorPickerDot,
                      !QR_SWATCH_COLORS.includes(qrColor) && styles.colorDotActive,
                      !QR_SWATCH_COLORS.includes(qrColor) && { borderColor: qrColor },
                    ]}
                    onPress={() => {
                      setQrHexDraft(qrColor);
                      setShowQrHexInput((v) => !v);
                    }}
                  >
                    <Ionicons
                      name="color-palette-outline"
                      size={16}
                      color={!QR_SWATCH_COLORS.includes(qrColor) ? qrColor : 'rgba(255,255,255,0.6)'}
                    />
                  </Pressable>

                  {ACCENT_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.colorDot, { backgroundColor: c }, qrColor === c && styles.colorDotActive]}
                      onPress={() => { setQrColor(c); setShowQrHexInput(false); }}
                    >
                      {qrColor === c && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </Pressable>
                  ))}
                </View>

                {showQrHexInput && (
                  <>
                    <View style={styles.quickBwRow}>
                      <Pressable
                        style={styles.quickBwBtn}
                        onPress={() => { setQrColor('#000000'); setQrHexDraft('#000000'); setShowQrHexInput(false); }}
                      >
                        <View style={[styles.quickBwSwatch, { backgroundColor: '#000000' }]} />
                        <Text style={styles.quickBwText}>Black</Text>
                      </Pressable>
                      <Pressable
                        style={styles.quickBwBtn}
                        onPress={() => { setQrColor('#FFFFFF'); setQrHexDraft('#FFFFFF'); setShowQrHexInput(false); }}
                      >
                        <View style={[styles.quickBwSwatch, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border }]} />
                        <Text style={styles.quickBwText}>White</Text>
                      </Pressable>
                    </View>
                    <View style={styles.wheelWrap}>
                      <ColorPicker
                        color={qrColor}
                        onColorChangeComplete={(c: string) => {
                          setQrColor(c);
                          setQrHexDraft(c);
                        }}
                        thumbSize={26}
                        sliderSize={26}
                        gapSize={20}
                        swatches={false}
                      />
                    </View>
                    <View style={styles.hexRow}>
                      <View style={[styles.hexPreview, { backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(qrHexDraft) ? qrHexDraft : COLORS.border }]} />
                      <TextInput
                        style={styles.hexInput}
                        value={qrHexDraft}
                        onChangeText={(v) => {
                          const clean = v.startsWith('#') ? v : '#' + v;
                          setQrHexDraft(clean);
                          if (/^#[0-9A-Fa-f]{6}$/.test(clean)) setQrColor(clean);
                        }}
                        placeholder="#000000"
                        placeholderTextColor={COLORS.textTertiary}
                        autoCapitalize="characters"
                        maxLength={7}
                      />
                    </View>
                  </>
                )}

                <Text style={[styles.label, { marginTop: 20 }]}>QR Background</Text>
                <View style={styles.colorRow}>
                  <Pressable
                    style={[
                      styles.colorDot, styles.colorPickerDot,
                      !QR_SWATCH_COLORS.includes(qrBgColor) && styles.colorDotActive,
                      !QR_SWATCH_COLORS.includes(qrBgColor) && { borderColor: qrBgColor },
                    ]}
                    onPress={() => {
                      setQrBgHexDraft(qrBgColor);
                      setShowQrBgHexInput((v) => !v);
                    }}
                  >
                    <Ionicons
                      name="color-palette-outline"
                      size={16}
                      color={!QR_SWATCH_COLORS.includes(qrBgColor) ? qrBgColor : 'rgba(255,255,255,0.6)'}
                    />
                  </Pressable>

                  {ACCENT_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.colorDot, { backgroundColor: c }, qrBgColor === c && styles.colorDotActive]}
                      onPress={() => { setQrBgColor(c); setShowQrBgHexInput(false); }}
                    >
                      {qrBgColor === c && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </Pressable>
                  ))}
                </View>

                {showQrBgHexInput && (
                  <>
                    <View style={styles.quickBwRow}>
                      <Pressable
                        style={styles.quickBwBtn}
                        onPress={() => { setQrBgColor('#000000'); setQrBgHexDraft('#000000'); setShowQrBgHexInput(false); }}
                      >
                        <View style={[styles.quickBwSwatch, { backgroundColor: '#000000' }]} />
                        <Text style={styles.quickBwText}>Black</Text>
                      </Pressable>
                      <Pressable
                        style={styles.quickBwBtn}
                        onPress={() => { setQrBgColor('#FFFFFF'); setQrBgHexDraft('#FFFFFF'); setShowQrBgHexInput(false); }}
                      >
                        <View style={[styles.quickBwSwatch, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border }]} />
                        <Text style={styles.quickBwText}>White</Text>
                      </Pressable>
                    </View>
                    <View style={styles.wheelWrap}>
                      <ColorPicker
                        color={qrBgColor}
                        onColorChangeComplete={(c: string) => {
                          setQrBgColor(c);
                          setQrBgHexDraft(c);
                        }}
                        thumbSize={26}
                        sliderSize={26}
                        gapSize={20}
                        swatches={false}
                      />
                    </View>
                    <View style={styles.hexRow}>
                      <View style={[styles.hexPreview, { backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(qrBgHexDraft) ? qrBgHexDraft : COLORS.border }]} />
                      <TextInput
                        style={styles.hexInput}
                        value={qrBgHexDraft}
                        onChangeText={(v) => {
                          const clean = v.startsWith('#') ? v : '#' + v;
                          setQrBgHexDraft(clean);
                          if (/^#[0-9A-Fa-f]{6}$/.test(clean)) setQrBgColor(clean);
                        }}
                        placeholder="#FFFFFF"
                        placeholderTextColor={COLORS.textTertiary}
                        autoCapitalize="characters"
                        maxLength={7}
                      />
                    </View>
                  </>
                )}
              </View>
            </>
          )}

          {/* ── Information Tab ── */}
          {tab === 'information' && (
            <>
              <Text style={styles.sectionHeader}>PERSONAL</Text>
              <View style={styles.card}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={COLORS.textTertiary}
                />
                <Text style={[styles.label, { marginTop: 16 }]}>Middle Name</Text>
                <TextInput
                  style={styles.input}
                  value={middleName}
                  onChangeText={setMiddleName}
                  placeholder="Middle name (optional)"
                  placeholderTextColor={COLORS.textTertiary}
                />
                <Text style={[styles.label, { marginTop: 16 }]}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={COLORS.textTertiary}
                />
              </View>

              <Text style={styles.sectionHeader}>AFFILIATION</Text>
              <View style={styles.card}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={infoTitle}
                  onChangeText={setInfoTitle}
                  placeholder="e.g. Founder"
                  placeholderTextColor={COLORS.textTertiary}
                />
                <Text style={[styles.label, { marginTop: 16 }]}>Company</Text>
                <TextInput
                  style={styles.input}
                  value={company}
                  onChangeText={setCompany}
                  placeholder="e.g. Acme Inc"
                  placeholderTextColor={COLORS.textTertiary}
                />
                <Text style={[styles.label, { marginTop: 16 }]}>Department</Text>
                <TextInput
                  style={styles.input}
                  value={department}
                  onChangeText={setDepartment}
                  placeholder="e.g. Engineering"
                  placeholderTextColor={COLORS.textTertiary}
                />
                <Text style={[styles.label, { marginTop: 16 }]}>Headline</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={headline}
                  onChangeText={setHeadline}
                  placeholder="e.g. Connecting great people"
                  placeholderTextColor={COLORS.textTertiary}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </View>
            </>
          )}

          {/* ── Fields Tab ── */}
          {tab === 'fields' && (
            <>
              {contactFields.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>YOUR FIELDS</Text>
                  <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
                    {contactFields.map((field, idx) => (
                      <Pressable
                        key={field.id}
                        style={({ pressed }) => [
                          styles.fieldRow,
                          idx > 0 && styles.fieldRowBorder,
                          pressed && { backgroundColor: COLORS.surface2 },
                        ]}
                        onPress={() => openFieldSheet(field)}
                      >
                        <View style={[styles.fieldIconWrap, { backgroundColor: accent + '22' }]}>
                          <Ionicons
                            name={(field.icon as keyof typeof Ionicons.glyphMap) || FIELD_ICONS[field.type] || 'ellipsis-horizontal'}
                            size={17}
                            color={accent}
                          />
                        </View>
                        <Text style={styles.fieldValue} numberOfLines={1}>
                          {field.label ?? (field.type === 'app' ? APP_FIELD_DISPLAY : field.value)}
                        </Text>
                        <View style={styles.fieldActions}>
                          <Pressable
                            hitSlop={10}
                            onPress={() => handleMoveField(field.id, 'up')}
                            style={[styles.reorderBtn, idx === 0 && { opacity: 0.2 }]}
                            disabled={idx === 0}
                          >
                            <Ionicons name="chevron-up" size={16} color={COLORS.textSecondary} />
                          </Pressable>
                          <Pressable
                            hitSlop={10}
                            onPress={() => handleMoveField(field.id, 'down')}
                            style={[styles.reorderBtn, idx === contactFields.length - 1 && { opacity: 0.2 }]}
                            disabled={idx === contactFields.length - 1}
                          >
                            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                          </Pressable>
                          <Pressable
                            hitSlop={12}
                            onPress={() =>
                              Alert.alert('Delete field?', undefined, [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete', style: 'destructive',
                                  onPress: () => handleFieldDelete(cardId, field.id),
                                },
                              ])
                            }
                          >
                            <Ionicons name="close-circle" size={20} color={COLORS.textTertiary} />
                          </Pressable>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {suggestedCategories.map((cat) => (
                <View key={cat.label}>
                  <Text style={styles.sectionHeader}>{cat.label.toUpperCase()}</Text>
                  <View style={styles.chipsWrap}>
                    {cat.items.map((p) => (
                      <Pressable key={p.type + p.label} style={styles.chip} onPress={() => openFieldSheet(null, p.type)}>
                        <Ionicons name={p.icon} size={13} color={COLORS.textSecondary} />
                        <Text style={styles.chipLabel}>{p.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete card */}
      <Pressable
        style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
        onPress={handleDeleteCard}
        disabled={deleting}
      >
        <Ionicons name="trash-outline" size={16} color="#EF4444" />
        <Text style={styles.deleteBtnText}>{deleting ? 'Deleting…' : 'Delete Card'}</Text>
      </Pressable>

      <CardFieldSheet
        visible={showFieldSheet}
        cardId={cardId}
        field={fieldSheetCtx?.field ?? null}
        initialType={fieldSheetCtx?.initialType}
        onClose={() => { setShowFieldSheet(false); setFieldSheetCtx(null); }}
        onSave={handleFieldSave}
        onDelete={handleFieldDelete}
      />
      <PaywallSheet visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
  },
  headerIconBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text },
  saveBtn: {
    paddingHorizontal: 18, height: 36, borderRadius: 10,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#0C0C0E' },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 16,
    backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  tabItem: {
    flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10,
  },
  tabLabel: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  tabLabelActive: { color: '#0C0C0E', fontFamily: FONTS.semiBold },

  scroll: { paddingBottom: 40 },

  photoRow: { alignItems: 'center', paddingVertical: 24 },
  photoWrap: { position: 'relative' },
  photoImg: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  photoInitial: { fontSize: 40, fontFamily: FONTS.semiBold },
  photoBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.bg,
  },

  qrLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qrLogoWrap: {
    width: 56, height: 56, borderRadius: 14, overflow: 'hidden',
  },
  qrLogoImg: { width: 56, height: 56, borderRadius: 14 },
  qrLogoPlaceholder: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qrLogoHint: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 16 },
  qrLogoActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  qrLogoActionText: { fontSize: 13, fontFamily: FONTS.semiBold },
  qrLogoActionTextRemove: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#EF4444' },

  card: {
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 16,
  },
  proLockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(12,12,14,0.82)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  proLockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  proLockText: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.text },
  label: {
    fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },
  input: {
    height: 48, backgroundColor: COLORS.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.text,
  },
  inputMultiline: { height: 72, paddingTop: 14 },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorPickerDot: { backgroundColor: 'rgba(255,255,255,0.08)' },
  colorDotActive: { borderColor: '#fff' },
  wheelWrap: { height: 280, marginTop: 16, paddingHorizontal: 8 },
  quickBwRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  quickBwBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
  },
  quickBwSwatch: { width: 16, height: 16, borderRadius: 8 },
  quickBwText: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.text },
  hexRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20,
  },
  hexPreview: { width: 32, height: 32, borderRadius: 16 },
  hexInput: {
    flex: 1, height: 42, backgroundColor: COLORS.surface2, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.text,
    letterSpacing: 1,
  },

  fontRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  fontOption: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: COLORS.surface2, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    gap: 4,
  },
  fontPreview: { fontSize: 20, color: COLORS.text },
  fontLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  fontLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.4 },

  sectionHeader: {
    fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary,
    letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  fieldRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  fieldIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  fieldValue: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text },
  fieldActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reorderBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  chipsWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, paddingTop: 4,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: COLORS.surface, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipLabel: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 12, paddingVertical: 14, borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  deleteBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#EF4444' },
});
