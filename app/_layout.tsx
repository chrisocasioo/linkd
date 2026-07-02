import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk';
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { tokenCache } from '../lib/clerk';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { RevenueCatProvider, useRevenueCat } from '../lib/RevenueCatContext';
import { initRevenueCat } from '../lib/revenuecat';
import { useApi } from '../lib/api';

SplashScreen.preventAutoHideAsync();

const g = global as any;
if (g.ErrorUtils) {
  const prev = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((error: any, isFatal: any) => {
    Alert.alert('Startup Error', error?.message ?? String(error));
    prev?.(error, isFatal);
  });
}

function AppInitializer() {
  const { userId } = useAuth();
  const { refresh, seedIsPro } = useRevenueCat();
  const api = useApi();
  useEffect(() => {
    if (!userId) return;
    initRevenueCat(userId).then(() => refresh()).catch(() => {});
    api.getMe().then((u) => { if (u.isPro) seedIsPro(true); }).catch(() => {});
  }, [userId]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'DMSans-Light': DMSans_400Regular,
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-SemiBold': DMSans_700Bold,
    'PlayfairDisplay-Regular': PlayfairDisplay_400Regular,
    'PlayfairDisplay-Medium': PlayfairDisplay_500Medium,
    'PlayfairDisplay-SemiBold': PlayfairDisplay_600SemiBold,
    'SpaceGrotesk-Regular': SpaceGrotesk_400Regular,
    'SpaceGrotesk-Medium': SpaceGrotesk_500Medium,
    'SpaceGrotesk-SemiBold': SpaceGrotesk_600SemiBold,
    'Nunito-Regular': Nunito_400Regular,
    'Nunito-Medium': Nunito_500Medium,
    'Nunito-SemiBold': Nunito_600SemiBold,
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
            <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="theme" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="analytics" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="edit-card" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </RevenueCatProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}
