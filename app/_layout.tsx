import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { tokenCache } from '../lib/clerk';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { RevenueCatProvider } from '../lib/RevenueCatContext';
import { initRevenueCat } from '../lib/revenuecat';

SplashScreen.preventAutoHideAsync();

if (global.ErrorUtils) {
  const prev = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    Alert.alert('Startup Error', error?.message ?? String(error));
    prev?.(error, isFatal);
  });
}

function AppInitializer() {
  const { userId } = useAuth();
  useEffect(() => {
    if (userId) initRevenueCat(userId).catch(() => {});
  }, [userId]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'DMSans-Light': DMSans_300Light,
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-SemiBold': DMSans_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
        tokenCache={tokenCache}
      >
        <RevenueCatProvider>
          <AppInitializer />
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="card" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="theme" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="analytics" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </RevenueCatProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}
