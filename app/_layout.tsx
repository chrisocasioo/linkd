import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0D0F', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#C9A84C', fontSize: 32, fontWeight: 'bold' }}>Linkd</Text>
      <Text style={{ color: '#fff', marginTop: 8 }}>Native runtime OK</Text>
    </View>
  );
}
