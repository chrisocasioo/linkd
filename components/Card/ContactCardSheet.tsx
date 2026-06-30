import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ContactMeta } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.88;

interface Props {
  visible: boolean;
  existing: ContactMeta | null;
  onClose: () => void;
  onSave: (meta: ContactMeta) => Promise<void>;
}

export function ContactCardSheet({ visible, existing, onClose, onSave }: Props) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setFirstName(existing?.firstName ?? '');
      setLastName(existing?.lastName ?? '');
      setEmail(existing?.email ?? '');
      setPhone(existing?.phone ?? '');
      setCompany(existing?.company ?? '');
      setJobTitle(existing?.jobTitle ?? '');
      setWebsite(existing?.website ?? '');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        website: website.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <Text style={styles.heading}>{existing ? 'Edit Contact Card' : 'Add Contact Card'}</Text>
              <Text style={styles.subheading}>Visitors can save you to their phone contacts</Text>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Field label="FIRST NAME" value={firstName} onChange={setFirstName} placeholder="Alex" />
              </View>
              <View style={styles.half}>
                <Field label="LAST NAME" value={lastName} onChange={setLastName} placeholder="Rivera" />
              </View>
            </View>
            <Field label="EMAIL" value={email} onChange={setEmail} placeholder="alex@example.com" keyboard="email-address" autoCapitalize="none" />
            <Field label="PHONE" value={phone} onChange={setPhone} placeholder="+1 555 000 0000" keyboard="phone-pad" autoCapitalize="none" />
            <Field label="COMPANY" value={company} onChange={setCompany} placeholder="Santrico Apps" />
            <Field label="JOB TITLE" value={jobTitle} onChange={setJobTitle} placeholder="Founder & CEO" />
            <Field label="WEBSITE" value={website} onChange={setWebsite} placeholder="https://example.com" keyboard="url" autoCapitalize="none" />

            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Contact Card'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, keyboard, autoCapitalize,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; keyboard?: any; autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
}) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.06 * 10, textTransform: 'uppercase', paddingLeft: 2 },
  input: {
    height: 44, backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, fontSize: 13, fontFamily: FONTS.regular, color: COLORS.text,
  },
});

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_HEIGHT,
    backgroundColor: '#161618', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  kav: { flex: 1 },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 16 },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  headerRow: { gap: 4, marginBottom: 4 },
  heading: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.2 },
  subheading: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  saveBtn: { height: 46, backgroundColor: COLORS.accent, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
});
