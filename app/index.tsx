import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { COLORS } from '../constants/colors';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (isSignedIn) return <Redirect href="/(tabs)/generate" />;
  return <Redirect href="/(auth)/sign-up" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
});
