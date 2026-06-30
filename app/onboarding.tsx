import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UsernameInput } from '../components/Card/UsernameInput';
import { useApi } from '../lib/api';
import { COLORS, FONTS } from '../constants/colors';

export default function OnboardingScreen() {
  const router = useRouter();
  const api = useApi();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  const usernameValid = /^[a-z0-9_-]{3,30}$/.test(username);

  const handleConfirm = async () => {
    if (!usernameValid) return;
    setSaving(true);
    try {
      await api.updateMe({ username });
      router.replace('/card');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save username.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>Linkd</Text>
            <Text style={styles.tagline}>Digital Business Cards</Text>
          </View>

          <Text style={styles.heading}>Claim your link</Text>
          <Text style={styles.sub}>This is your permanent public URL — choose wisely.</Text>

          <UsernameInput value={username} onChange={setUsername} />

          {username.length >= 3 && usernameValid && (
            <Text style={styles.preview}>linkd.tattoo/{username}</Text>
          )}

          <Pressable
            style={[styles.btn, (!usernameValid || saving) && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={!usernameValid || saving}
          >
            <Text style={styles.btnText}>{saving ? 'Setting up…' : 'Confirm'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 20 },
  header: { alignItems: 'center', marginBottom: 8 },
  logo: { fontSize: 40, fontFamily: FONTS.semiBold, color: COLORS.accent, letterSpacing: -1 },
  tagline: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 4 },
  heading: { fontSize: 28, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.5 },
  sub: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 20 },
  preview: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.accent, textAlign: 'center' },
  btn: { height: 52, backgroundColor: COLORS.accent, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#fff' },
});
