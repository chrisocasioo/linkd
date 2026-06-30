import DateTimePicker from '@react-native-community/datetimepicker';
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.85;

interface Props {
  visible: boolean;
  link: Link | null;
  onClose: () => void;
  onSave: (data: { title: string; url: string; goLiveAt: string | null; expiresAt: string | null }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function LinkEditSheet({ visible, link, onClose, onSave, onDelete }: Props) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [goLiveAt, setGoLiveAt] = useState<Date>(new Date());
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [showExpiry, setShowExpiry] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(link?.title ?? '');
      setUrl(link?.url ?? '');
      const liveAt = link?.goLiveAt ? new Date(link.goLiveAt) : null;
      setScheduled(!!liveAt);
      setGoLiveAt(liveAt ?? new Date(Date.now() + 60 * 60 * 1000));
      const exp = link?.expiresAt ? new Date(link.expiresAt) : null;
      setExpiresAt(exp);
      setShowExpiry(!!exp);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('Title required');
    let finalUrl = url.trim();
    if (finalUrl && !finalUrl.match(/^https?:\/\//)) finalUrl = `https://${finalUrl}`;
    if (!finalUrl) return Alert.alert('URL required');
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        url: finalUrl,
        goLiveAt: scheduled ? goLiveAt.toISOString() : null,
        expiresAt: showExpiry && expiresAt ? expiresAt.toISOString() : null,
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    Alert.alert('Delete Link', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await onDelete();
            onClose();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>{link ? 'Edit Link' : 'Add Link'}</Text>

            <View style={styles.field}>
              <Text style={styles.label}>TITLE</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Instagram"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>URL</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Schedule Go Live</Text>
                <Text style={styles.toggleSub}>Show link after a specific date</Text>
              </View>
              <Switch
                value={scheduled}
                onValueChange={setScheduled}
                trackColor={{ true: COLORS.accent }}
                thumbColor="#fff"
              />
            </View>

            {scheduled && (
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Go Live At</Text>
                <DateTimePicker
                  value={goLiveAt}
                  mode="datetime"
                  display="spinner"
                  onChange={(_, d) => d && setGoLiveAt(d)}
                  minimumDate={new Date()}
                  themeVariant="dark"
                />
              </View>
            )}

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Set Expiration</Text>
                <Text style={styles.toggleSub}>Hide link after a specific date</Text>
              </View>
              <Switch
                value={showExpiry}
                onValueChange={(v) => { setShowExpiry(v); if (v && !expiresAt) setExpiresAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); }}
                trackColor={{ true: COLORS.accent }}
                thumbColor="#fff"
              />
            </View>

            {showExpiry && expiresAt && (
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Expires At</Text>
                <DateTimePicker
                  value={expiresAt}
                  mode="datetime"
                  display="spinner"
                  onChange={(_, d) => d && setExpiresAt(d)}
                  minimumDate={new Date()}
                  themeVariant="dark"
                />
              </View>
            )}

            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>

            {link && onDelete && (
              <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteBtnText}>Delete Link</Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  kav: { flex: 1 },
  handle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  content: { padding: 24, gap: 16, paddingBottom: 48 },
  heading: { fontSize: 20, fontFamily: FONTS.semiBold, color: COLORS.text },
  field: { gap: 6 },
  label: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSecondary, letterSpacing: 1 },
  input: {
    height: 52,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text },
  toggleSub: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },
  pickerContainer: { gap: 8 },
  pickerLabel: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  saveBtn: {
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#fff' },
  deleteBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.danger },
});
