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
import { ScanResult } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  initial: Partial<ScanResult> | null;
  onClose: () => void;
  onSave: (fields: Partial<ScanResult> & { notes?: string }) => Promise<void>;
  title?: string;
}

export function ContactReviewSheet({ visible, initial, onClose, onSave, title = 'Review Contact' }: Props) {
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setFirstName(initial?.firstName ?? '');
      setLastName(initial?.lastName ?? '');
      setCompany(initial?.company ?? '');
      setJobTitle(initial?.jobTitle ?? '');
      setEmail(initial?.email ?? '');
      setPhone(initial?.phone ?? '');
      setWebsite(initial?.website ?? '');
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, initial]);

  const close = () => { Keyboard.dismiss(); onClose(); };

  const handleSave = async () => {
    const hasContent = firstName || lastName || email || phone || company;
    if (!hasContent) { Alert.alert('Add some info', 'Fill in at least one field before saving.'); return; }
    setSaving(true);
    try {
      await onSave({ firstName: firstName || null, lastName: lastName || null, company: company || null, jobTitle: jobTitle || null, email: email || null, phone: phone || null, website: website || null });
      close();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={close} hitSlop={12}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>FIRST NAME</Text>
                <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First" placeholderTextColor={COLORS.textTertiary} />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>LAST NAME</Text>
                <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last" placeholderTextColor={COLORS.textTertiary} />
              </View>
            </View>

            <Text style={styles.label}>COMPANY</Text>
            <TextInput style={styles.input} value={company} onChangeText={setCompany} placeholder="Company name" placeholderTextColor={COLORS.textTertiary} autoCorrect={false} />

            <Text style={styles.label}>JOB TITLE</Text>
            <TextInput style={styles.input} value={jobTitle} onChangeText={setJobTitle} placeholder="e.g. Founder" placeholderTextColor={COLORS.textTertiary} autoCorrect={false} />

            <Text style={styles.label}>EMAIL</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={COLORS.textTertiary} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

            <Text style={styles.label}>PHONE</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+1 555 000 0000" placeholderTextColor={COLORS.textTertiary} keyboardType="phone-pad" />

            <Text style={styles.label}>WEBSITE</Text>
            <TextInput style={styles.input} value={website} onChangeText={setWebsite} placeholder="https://example.com" placeholderTextColor={COLORS.textTertiary} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.saveBtn, saving && styles.saveBtnDim]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Contact'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.text },
  body: { paddingHorizontal: 20, paddingBottom: 8, gap: 6 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, gap: 6 },
  label: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 10 },
  input: {
    height: 46, backgroundColor: COLORS.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text,
  },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36 },
  cancelBtn: {
    height: 48, paddingHorizontal: 20, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  saveBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  saveBtnDim: { opacity: 0.5 },
  saveText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
});
