import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CardField } from '../../lib/api';
import { parseAppLinks, serializeAppLinks } from '../../lib/appField';
import { COLORS, FONTS } from '../../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');

const FIELD_TYPES = [
  { id: 'email',     label: 'Email',     icon: 'mail' as const,             placeholder: 'you@example.com',   keyboardType: 'email-address' as const },
  { id: 'phone',     label: 'Phone',     icon: 'call' as const,             placeholder: '+1 555 000 0000',   keyboardType: 'phone-pad' as const },
  { id: 'website',   label: 'Website',   icon: 'globe-outline' as const,    placeholder: 'https://yoursite.com', keyboardType: 'url' as const },
  { id: 'app',       label: 'App',       icon: 'logo-apple-appstore' as const, placeholder: '', keyboardType: 'url' as const },
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram' as const,   placeholder: '@handle',           keyboardType: 'default' as const },
  { id: 'twitter',   label: 'Twitter',   icon: 'logo-twitter' as const,     placeholder: '@handle',           keyboardType: 'default' as const },
  { id: 'linkedin',  label: 'LinkedIn',  icon: 'logo-linkedin' as const,    placeholder: 'username',          keyboardType: 'default' as const },
  { id: 'tiktok',    label: 'TikTok',    icon: 'logo-tiktok' as const,      placeholder: '@handle',           keyboardType: 'default' as const },
  { id: 'youtube',   label: 'YouTube',   icon: 'logo-youtube' as const,     placeholder: '@channel',          keyboardType: 'default' as const },
  { id: 'facebook',   label: 'Facebook',   icon: 'logo-facebook' as const,          placeholder: 'username',                 keyboardType: 'default' as const },
  { id: 'whatsapp',   label: 'WhatsApp',   icon: 'logo-whatsapp' as const,          placeholder: '+1 555 000 0000',           keyboardType: 'phone-pad' as const },
  { id: 'spotify',    label: 'Spotify',    icon: 'musical-notes-outline' as const,  placeholder: '@username',                 keyboardType: 'default' as const },
  { id: 'venmo',      label: 'Venmo',      icon: 'logo-venmo' as const,             placeholder: '@username',                 keyboardType: 'default' as const },
  { id: 'paypal',     label: 'PayPal',     icon: 'logo-paypal' as const,            placeholder: 'paypal.me/username',        keyboardType: 'url' as const },
  { id: 'cashapp',    label: 'Cash App',   icon: 'cash-outline' as const,           placeholder: '$cashtag',                  keyboardType: 'default' as const },
  { id: 'zelle',      label: 'Zelle',      icon: 'card-outline' as const,           placeholder: 'Phone or email',            keyboardType: 'default' as const },
  { id: 'telegram',   label: 'Telegram',   icon: 'paper-plane-outline' as const,    placeholder: '@username',                 keyboardType: 'default' as const },
  { id: 'discord',    label: 'Discord',    icon: 'logo-discord' as const,           placeholder: 'username',                  keyboardType: 'default' as const },
  { id: 'signal',     label: 'Signal',     icon: 'chatbubble-ellipses-outline' as const, placeholder: '+1 555 000 0000',      keyboardType: 'phone-pad' as const },
  { id: 'zoom',       label: 'Zoom',       icon: 'videocam-outline' as const,       placeholder: 'zoom.us/j/…',                keyboardType: 'url' as const },
  { id: 'soundcloud', label: 'SoundCloud', icon: 'logo-soundcloud' as const,        placeholder: '@username',                 keyboardType: 'default' as const },
  { id: 'applemusic', label: 'Apple Music', icon: 'logo-apple' as const,            placeholder: 'music.apple.com/…',         keyboardType: 'url' as const },
  { id: 'vimeo',      label: 'Vimeo',      icon: 'logo-vimeo' as const,             placeholder: '@username',                 keyboardType: 'default' as const },
  { id: 'twitch',     label: 'Twitch',     icon: 'logo-twitch' as const,            placeholder: 'username',                  keyboardType: 'default' as const },
  { id: 'behance',    label: 'Behance',    icon: 'logo-behance' as const,           placeholder: 'username',                  keyboardType: 'default' as const },
  { id: 'dribbble',   label: 'Dribbble',   icon: 'logo-dribbble' as const,          placeholder: 'username',                  keyboardType: 'default' as const },
  { id: 'github',     label: 'GitHub',     icon: 'logo-github' as const,            placeholder: 'username',                  keyboardType: 'default' as const },
  { id: 'snapchat',   label: 'Snapchat',   icon: 'logo-snapchat' as const,          placeholder: '@username',                 keyboardType: 'default' as const },
  { id: 'pinterest',  label: 'Pinterest',  icon: 'logo-pinterest' as const,         placeholder: 'username',                  keyboardType: 'default' as const },
  { id: 'threads',    label: 'Threads',    icon: 'logo-threads' as const,           placeholder: '@username',                 keyboardType: 'default' as const },
  { id: 'calendly',   label: 'Calendly',   icon: 'calendar-outline' as const,       placeholder: 'calendly.com/username',     keyboardType: 'url' as const },
  { id: 'patreon',    label: 'Patreon',    icon: 'heart-outline' as const,          placeholder: 'patreon.com/username',      keyboardType: 'url' as const },
  { id: 'address',    label: 'Address',    icon: 'location-outline' as const,       placeholder: '123 Main St, City',         keyboardType: 'default' as const },
  { id: 'title',      label: 'Title',      icon: 'briefcase-outline' as const,      placeholder: 'e.g. Founder',             keyboardType: 'default' as const },
  { id: 'company',    label: 'Company',    icon: 'business-outline' as const,       placeholder: 'e.g. Acme Inc',            keyboardType: 'default' as const },
  { id: 'department', label: 'Department', icon: 'people-outline' as const,         placeholder: 'e.g. Engineering',         keyboardType: 'default' as const },
  { id: 'headline',   label: 'Headline',   icon: 'document-text-outline' as const,  placeholder: 'e.g. Connecting people',   keyboardType: 'default' as const },
  { id: 'custom',     label: 'Custom',     icon: 'ellipsis-horizontal' as const,    placeholder: 'Value',                    keyboardType: 'default' as const },
];

interface Props {
  visible: boolean;
  cardId: string;
  field: CardField | null;
  initialType?: string;
  onClose: () => void;
  onSave: (cardId: string, data: { type: string; value: string; label?: string }, fieldId?: string) => Promise<void>;
  onDelete?: (cardId: string, fieldId: string) => Promise<void>;
}

export function CardFieldSheet({ visible, cardId, field, initialType, onClose, onSave, onDelete }: Props) {
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const [selectedType, setSelectedType] = useState(field?.type ?? initialType ?? 'email');
  const [value, setValue] = useState(field?.value ?? '');
  const [label, setLabel] = useState(field?.label ?? '');
  // 'app' stores both store links in one field; edited via two dedicated inputs
  const [iosUrl, setIosUrl] = useState('');
  const [androidUrl, setAndroidUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedType(field?.type ?? initialType ?? 'email');
      setValue(field?.value ?? '');
      setLabel(field?.label ?? '');
      const links = field?.type === 'app' ? parseAppLinks(field.value) : {};
      setIosUrl(links.ios ?? '');
      setAndroidUrl(links.android ?? '');
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, field, initialType]);

  const close = () => { Keyboard.dismiss(); onClose(); };

  const isApp = selectedType === 'app';
  const canSave = isApp ? !!(iosUrl.trim() || androidUrl.trim()) : !!value.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const saveValue = isApp ? serializeAppLinks({ ios: iosUrl, android: androidUrl }) : value.trim();
      await onSave(cardId, { type: selectedType, value: saveValue, label: label.trim() || undefined }, field?.id);
      close();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!field || !onDelete) return;
    Alert.alert('Delete field?', 'This will remove the field from your card.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try { await onDelete(cardId, field.id); close(); }
          catch (err: any) { Alert.alert('Error', err.message); }
          finally { setSaving(false); }
        },
      },
    ]);
  };

  const currentTypeDef = FIELD_TYPES.find((t) => t.id === selectedType) ?? FIELD_TYPES[0];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{field ? 'Edit Field' : 'Add Field'}</Text>
            <Pressable onPress={close} hitSlop={12}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          {/* Type picker */}
          {!field && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {FIELD_TYPES.map((t) => (
                <Pressable
                  key={t.id}
                  style={[styles.typeChip, selectedType === t.id && styles.typeChipActive]}
                  onPress={() => setSelectedType(t.id)}
                >
                  <Ionicons name={t.icon} size={14} color={selectedType === t.id ? COLORS.accent : COLORS.textSecondary} />
                  <Text style={[styles.typeChipLabel, selectedType === t.id && styles.typeChipLabelActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={styles.body}>
            {isApp ? (
              <>
                <Text style={styles.fieldLabel}>Apple App Store (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={iosUrl}
                  onChangeText={setIosUrl}
                  placeholder="https://apps.apple.com/app/…"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Google Play Store (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={androidUrl}
                  onChangeText={setAndroidUrl}
                  placeholder="https://play.google.com/store/apps/…"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.appHint}>
                  Visitors are sent to the store that matches their phone. Fill in at least one link.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>{currentTypeDef.label}</Text>
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={setValue}
                  placeholder={currentTypeDef.placeholder}
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType={currentTypeDef.keyboardType}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Label (optional)</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder={`e.g. Work ${currentTypeDef.label}`}
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>

          <View style={styles.actions}>
            {field && onDelete && (
              <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={saving}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDim]}
              onPress={handleSave}
              disabled={!canSave || saving}
            >
              <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text },
  typeRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.surface2, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border,
  },
  typeChipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  typeChipLabel: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  typeChipLabelActive: { color: COLORS.accent },
  body: { paddingHorizontal: 20 },
  fieldLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  appHint: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 8, lineHeight: 15 },
  input: {
    height: 48, backgroundColor: COLORS.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.text,
  },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 20 },
  deleteBtn: {
    height: 48, paddingHorizontal: 20, borderRadius: 14,
    borderWidth: 1, borderColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 15, fontFamily: FONTS.medium, color: '#ef4444' },
  saveBtn: {
    flex: 1, height: 48, borderRadius: 14,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDim: { opacity: 0.5 },
  saveBtnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
});
