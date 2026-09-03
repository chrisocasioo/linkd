import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
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
import { SocialAuthButtons } from '../../components/SocialAuthButtons';
import { COLORS, FONTS } from '../../constants/colors';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const goToReset = (reason?: 'compromised') =>
    router.push({ pathname: '/(auth)/forgot-password', params: { email: email.trim(), ...(reason ? { reason } : {}) } });

  const onSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      } else if (result.status === 'needs_new_password') {
        // The password verified but Clerk's breach check (HIBP) flagged it —
        // it can't be used again, so send them straight into the reset flow.
        goToReset('compromised');
      } else {
        // Anything else Clerk might want that we don't handle — say so
        // (with the status, so it's diagnosable) instead of looking frozen.
        Alert.alert('Sign in incomplete', `Something interrupted sign-in (${result.status ?? 'unknown'}). Please try again.`);
      }
    } catch (err: any) {
      Alert.alert('Sign in failed', err.errors?.[0]?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Text style={styles.logoText}>Linkd</Text>
            <Text style={styles.logoSub}>Digital Business Cards</Text>
          </View>

          <Text style={styles.heading}>Welcome back</Text>

          <SocialAuthButtons
            onSuccess={async (sessionId, setActive) => {
              await setActive({ session: sessionId });
              router.replace('/');
            }}
          />

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor={COLORS.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />
            <Pressable style={styles.forgotBtn} onPress={() => goToReset()} hitSlop={8}>
              <Text style={styles.footerLink}>Forgot password?</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={onSignIn}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign up</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 16 },
  logo: { alignItems: 'center', marginBottom: 24 },
  logoText: {
    fontSize: 36,
    fontFamily: FONTS.semiBold,
    color: COLORS.accent,
    letterSpacing: -1,
  },
  logoSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  heading: {
    fontSize: 26,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  input: {
    height: 52,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 4 },
  btn: {
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#fff' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  footerLink: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.accent },
});
