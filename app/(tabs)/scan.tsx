import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScannerCameraView } from '../../components/Scanner/CameraView';
import { ScanResult } from '../../components/Scanner/ScanResult';
import { COLORS, FONTS } from '../../constants/colors';
import { detectQRType } from '../../lib/qr';

export default function ScanScreen() {
  const [isFocused, setIsFocused] = useState(false);
  const [scanned, setScanned] = useState<string | null>(null);
  const [scannedType, setScannedType] = useState<'url' | 'wifi' | 'text'>('text');

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
        setScanned(null);
      };
    }, [])
  );

  const handleScanned = (data: string) => {
    setScanned(data);
    setScannedType(detectQRType(data));
  };

  const handleReset = () => setScanned(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan</Text>
        <Text style={styles.subtitle}>Point at any QR code</Text>
      </View>

      <View style={styles.cameraContainer}>
        {isFocused && (
          <ScannerCameraView
            onScanned={handleScanned}
            isScanned={!!scanned}
          />
        )}
      </View>

      {scanned && (
        <ScanResult
          data={scanned}
          type={scannedType}
          onDismiss={handleReset}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.bg,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cameraContainer: { flex: 1 },
});
