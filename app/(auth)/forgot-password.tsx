import { useSignIn } from '@clerk/clerk-expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { COLORS, FONTS } from '../../constants/colors';

// Clerk's reset flow, using the reset_password_email_code first factor:
//   1. signIn.create({ strategy: 'reset_password_email_code', identifier })
//      — emails a 6-digit code
//   2. signIn.attemptFirstFactor({ strategy, code }) → needs_new_password
//   3. signIn.resetPassword({ password }) → complete → setActive
export default function ForgotPasswordScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  // Sign-in hands over the email it already has, and a reason when Clerk's
  // breach check refused the current password (so we can explain why).
  const params = useLocalSearchParams<{ email?: string; reason?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!isLoaded) return;
    const identifier = email.trim();
    if (!identifier) {
      Alert.alert('Email required', 'Enter the email address on your account.');
      return;
    }
    setLoading(true);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier });
      setCodeSent(true);
    } catch (err: any) {
      Alert.alert('Couldn’t send code', err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!isLoaded) return;
    if (code.trim().length < 6) {
      Alert.alert('Code required', 'Enter the 6-digit code from your email.');
      return;
    }
    if (!password) {
      Alert.alert('Password required', 'Choose a new password.');
      return;
    }
    setLoading(true);
    try {
      const verified = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
      });
      const result =
        verified.status === 'needs_new_password' ? await signIn.resetPassword({ password }) : verified;
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      } else {
        Alert.alert('Reset incomplete', `Something interrupted the reset (${result.status ?? 'unknown'}). Please try again.`);
      }
    } catch (err: any) {
      Alert.alert('Reset failed', err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? err.message);
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

          {!codeSent ? (
            <>
              <Text style={styles.heading}>Reset your password</Text>
              <Text style={styles.bodyText}>
                {params.reason === 'compromised'
                  ? 'For security, that password can no longer be used. We’ll email you a code so you can set a new one.'
                  : 'Enter your email and we’ll send you a code to set a new password.'}
              </Text>

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

              <Pressable
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={sendCode}
                disabled={loading}
              >
                <Text style={styles.btnText}>{loading ? 'Sending…' : 'Send code'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.heading}>Check your email</Text>
              <Text style={styles.bodyText}>We sent a 6-digit code to {email.trim()}</Text>

              <View style={styles.field}>
                <Text style={styles.label}>VERIFICATION CODE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  placeholderTextColor={COLORS.textTertiary}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>NEW PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholder="8+ characters"
                  placeholderTextColor={COLORS.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
              </View>

              <Pressable
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={resetPassword}
                disabled={loading}
              >
                <Text style={styles.btnText}>{loading ? 'Resetting…' : 'Reset password'}</Text>
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Didn't get it? </Text>
                <Pressable onPress={sendCode} disabled={loading} hitSlop={8}>
                  <Text style={styles.footerLink}>Resend code</Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={styles.footer}>
            <Pressable onPress={() => router.back()} disabled={loading} hitSlop={8}>
              <Text style={styles.footerLink}>Back to sign in</Text>
            </Pressable>
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
  bodyText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 20,
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
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  footerText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  footerLink: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.accent },
});
