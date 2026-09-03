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
  const [code, setCode] = useState('');
  // Clerk can accept the password but still demand an emailed code — its
  // new-device (client trust) verification does this for any device it
  // hasn't seen before. Without this step the screen dead-ended there.
  const [pendingSecondFactor, setPendingSecondFactor] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      // Clerk's Client Trust (new-device verification) reports as
      // `needs_second_factor` + `client_trust_state: "new"` to this SDK
      // generation, and as `needs_client_trust` to newer ones; both are
      // resolved by the same email-code step.
      const status = result.status as string;
      if (status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      } else if (status === 'needs_second_factor' || status === 'needs_client_trust') {
        const emailFactor = result.supportedSecondFactors?.find((f) => f.strategy === 'email_code');
        if (!emailFactor) {
          Alert.alert('Sign in incomplete', 'This account needs a verification method the app doesn’t support yet.');
          return;
        }
        await signIn.prepareSecondFactor({
          strategy: 'email_code',
          emailAddressId: (emailFactor as { emailAddressId?: string }).emailAddressId,
        });
        setPendingSecondFactor(true);
      } else if (result.status === 'needs_new_password') {
        Alert.alert(
          'Password reset required',
          'For security, this password can no longer be used. Please reset it to continue.'
        );
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

  const onVerifyCode = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.attemptSecondFactor({ strategy: 'email_code', code });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/');
      } else {
        Alert.alert('Verification incomplete', `Please try again (${result.status ?? 'unknown'}).`);
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

          {!pendingSecondFactor ? (
            <>
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
            </>
          ) : (
            <>
              <Text style={styles.heading}>Check your email</Text>
              <Text style={styles.bodyText}>
                This device is new to us — we sent a 6-digit code to {email.trim()}
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
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                />
              </View>

              <Pressable
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={onVerifyCode}
                disabled={loading}
              >
                <Text style={styles.btnText}>{loading ? 'Verifying…' : 'Verify code'}</Text>
              </Pressable>

              <View style={styles.footer}>
                <Pressable onPress={() => { setPendingSecondFactor(false); setCode(''); }} disabled={loading}>
                  <Text style={styles.footerLink}>Back to sign in</Text>
                </Pressable>
              </View>
            </>
          )}
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
