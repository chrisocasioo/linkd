import { useSignInWithApple, useSSO } from '@clerk/clerk-expo';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONTS } from '../constants/colors';

WebBrowser.maybeCompleteAuthSession();

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function AppleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 814 1000">
      <Path
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 391.6 0 302.5 0 217.4c0-159.4 104.1-244 206.6-244 54.8 0 100.5 36.1 134.2 36.1 32.4 0 83.3-38.2 145.5-38.2 23.7 0 108.1 2 166 79.7zm-54.1-216.4c24.5-29 41.3-69.4 41.3-109.8 0-5.8-.6-11.6-1.9-16.1-39.3 1.3-85.5 26.1-113.6 58.8-22.5 25.9-41.9 66.3-41.9 107.4 0 6.4.6 12.8 1.9 18 2.6.6 6.5 1.3 10.3 1.3 35.5 0 79.8-23.2 103.9-59.6z"
        fill={COLORS.text}
      />
    </Svg>
  );
}

interface Props {
  onSuccess: (sessionId: string, setActive: any) => void;
}

export function SocialAuthButtons({ onSuccess }: Props) {
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: Linking.createURL('/oauth-native-callback', { scheme: 'linkd' }),
      });
      if (createdSessionId && setActive) {
        onSuccess(createdSessionId, setActive);
      }
    } catch (err: any) {
      Alert.alert('Google sign-in failed', err.message);
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleApple = async () => {
    setLoadingApple(true);
    try {
      const { createdSessionId, setActive } = await startAppleAuthenticationFlow();
      if (createdSessionId && setActive) {
        onSuccess(createdSessionId, setActive);
      }
    } catch (err: any) {
      Alert.alert('Apple sign-in failed', err.message);
    } finally {
      setLoadingApple(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.btn, loadingGoogle && styles.btnDisabled]}
        onPress={handleGoogle}
        disabled={loadingGoogle}
      >
        <GoogleIcon />
        <Text style={styles.btnText}>
          {loadingGoogle ? 'Connecting…' : 'Continue with Google'}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.btn, loadingApple && styles.btnDisabled]}
        onPress={handleApple}
        disabled={loadingApple}
      >
        <AppleIcon />
        <Text style={styles.btnText}>
          {loadingApple ? 'Connecting…' : 'Continue with Apple'}
        </Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  btn: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
});
