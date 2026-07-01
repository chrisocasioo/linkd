import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useApi } from '../lib/api';
import { COLORS } from '../constants/colors';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApi();
  const [checking, setChecking] = useState(true);
  const [hasUsername, setHasUsername] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setChecking(false); return; }
    api.getMe()
      .then((user) => setHasUsername(!!user.username))
      .catch(() => setHasUsername(false))
      .finally(() => setChecking(false));
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (!isSignedIn) return <Redirect href="/(auth)/sign-up" />;
  if (!hasUsername) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/cards" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
});
