import { Ionicons } from '@expo/vector-icons';
import * as ExpoContacts from 'expo-contacts/legacy';
import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Contact } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';
import { formatPhone } from '../../lib/format';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  contact: Contact | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (contact: Contact) => void;
}

type FieldRow = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; url: string };

function getInitials(contact: Contact): string {
  const f = contact.firstName?.[0] ?? '';
  const l = contact.lastName?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
}

function getDisplayName(contact: Contact): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown';
}

export function ContactDetailSheet({ visible, contact, onClose, onDelete, onEdit }: Props) {
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!contact) return null;

  const rows: FieldRow[] = [
    contact.email   ? { icon: 'mail-outline',      label: 'Email',   value: contact.email,   url: `mailto:${contact.email}` }   : null,
    contact.phone   ? { icon: 'call-outline',      label: 'Phone',   value: formatPhone(contact.phone),   url: `tel:${contact.phone}` }   : null,
    contact.fax     ? { icon: 'print-outline',     label: 'Fax',     value: formatPhone(contact.fax),     url: `tel:${contact.fax}` }     : null,
    contact.website ? { icon: 'globe-outline',     label: 'Website', value: contact.website, url: contact.website.startsWith('http') ? contact.website : `https://${contact.website}` } : null,
    contact.company ? { icon: 'business-outline',  label: 'Company', value: contact.company, url: '' } : null,
    contact.jobTitle ? { icon: 'briefcase-outline', label: 'Title',  value: contact.jobTitle, url: '' } : null,
    contact.address ? { icon: 'location-outline',  label: 'Address', value: contact.address, url: `https://maps.apple.com/?q=${encodeURIComponent(contact.address)}` } : null,
  ].filter(Boolean) as FieldRow[];

  const handleSaveToPhone = async () => {
    try {
      const { status } = await ExpoContacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow contacts access to save this contact to your phone.');
        return;
      }
      // Native pre-filled new-contact form — user reviews and taps Done to save
      await ExpoContacts.presentFormAsync(
        null,
        {
          contactType: 'person',
          firstName: contact.firstName ?? '',
          lastName: contact.lastName ?? '',
          company: contact.company ?? '',
          jobTitle: contact.jobTitle ?? '',
          emails: contact.email ? [{ label: 'work', email: contact.email }] : [],
          phoneNumbers: contact.phone ? [{ label: 'mobile', number: contact.phone }] : [],
          urlAddresses: contact.website ? [{ label: 'website', url: contact.website }] : [],
          note: contact.notes ?? undefined,
        } as any,
        { isNew: true } as any,
      );
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not open the contact form.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete contact?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await onDelete(contact.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={styles.handle} />

        <Pressable style={styles.editBtn} hitSlop={8} onPress={() => onEdit(contact)}>
          <Ionicons name="pencil" size={16} color={COLORS.textSecondary} />
        </Pressable>

        {/* Avatar + Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(contact)}</Text>
          </View>
          <Text style={styles.name}>{getDisplayName(contact)}</Text>
          {(contact.company || contact.jobTitle) && (
            <Text style={styles.sub}>
              {[contact.jobTitle, contact.company].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        {/* Field rows */}
        <View style={styles.fields}>
          {rows.map((row) => (
            <Pressable
              key={row.label}
              style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed, !row.url && styles.fieldRowNoAction]}
              onPress={() => row.url ? Linking.openURL(row.url).catch(() => {}) : undefined}
            >
              <View style={styles.fieldIcon}>
                <Ionicons name={row.icon} size={18} color={COLORS.accent} />
              </View>
              <View style={styles.fieldText}>
                <Text style={styles.fieldLabel}>{row.label}</Text>
                <Text style={styles.fieldValue} numberOfLines={1}>{row.value}</Text>
              </View>
              {!!row.url && <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />}
            </Pressable>
          ))}
        </View>

        {/* Scanned card photo — reference for double-checking OCR'd fields */}
        {contact.photo && (
          <View style={styles.cardPhotoSection}>
            <Text style={styles.cardPhotoLabel}>Scanned Card</Text>
            <Image source={{ uri: contact.photo }} style={styles.cardPhotoImg} resizeMode="contain" />
          </View>
        )}

        <View style={styles.footer}>
          <Pressable style={styles.saveBtn} onPress={handleSaveToPhone}>
            <Ionicons name="person-add-outline" size={16} color="#0C0C0E" />
            <Text style={styles.saveBtnText}>Save to Phone Contacts</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={styles.deleteBtnText}>Delete Contact</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingBottom: 40,
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  editBtn: {
    position: 'absolute', top: 20, right: 20,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontFamily: FONTS.semiBold, color: COLORS.accent },
  name: { fontSize: 20, fontFamily: FONTS.semiBold, color: COLORS.text },
  sub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  fields: { borderTopWidth: 1, borderTopColor: COLORS.border },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  fieldRowPressed: { backgroundColor: COLORS.surface2 },
  fieldRowNoAction: { opacity: 1 },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accentDim, alignItems: 'center', justifyContent: 'center' },
  fieldText: { flex: 1 },
  fieldLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text, marginTop: 2 },
  cardPhotoSection: { paddingHorizontal: 20, paddingTop: 20 },
  cardPhotoLabel: {
    fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },
  cardPhotoImg: {
    width: '100%', height: 180, borderRadius: 14,
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
  },
  footer: { paddingHorizontal: 20, paddingTop: 20, gap: 10 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 14, backgroundColor: COLORS.accent,
  },
  saveBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#ef444433',
    backgroundColor: '#ef444408',
  },
  deleteBtnText: { fontSize: 14, fontFamily: FONTS.medium, color: '#ef4444' },
});
