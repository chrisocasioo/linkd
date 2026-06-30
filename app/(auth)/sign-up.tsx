import { useSignUp } from '@clerk/clerk-expo';
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

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSignUp = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      Alert.alert('Sign up failed', err.errors?.[0]?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      }
    } catch (err: any) {
      Alert.alert('Verification failed', err.errors?.[0]?.message ?? err.message);
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

          {!pendingVerification ? (
            <>
              <Text style={styles.heading}>Create account</Text>

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
                  placeholder="8+ characters"
                  placeholderTextColor={COLORS.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                />
              </View>

              <Pressable
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={onSignUp}
                disabled={loading}
              >
                <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create account'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.heading}>Check your email</Text>
              <Text style={styles.bodyText}>
                We sent a 6-digit code to {email}
              </Text>

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
                />
              </View>

              <Pressable
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={onVerify}
                disabled={loading}
              >
                <Text style={styles.btnText}>{loading ? 'Verifying…' : 'Verify email'}</Text>
              </Pressable>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign in</Text>
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
  bodyText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
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
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  footerLink: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.accent },
});
