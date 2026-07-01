import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContactReviewSheet } from '../../components/Contacts/ContactReviewSheet';
import { useApi, ScanResult } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

export default function ScansScreen() {
  const api = useApi();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Partial<ScanResult> | null>(null);
  const [showReview, setShowReview] = useState(false);

  const handleScan = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      const libStatus = (await ImagePicker.requestMediaLibraryPermissionsAsync()).status;
      if (libStatus !== 'granted') {
        Alert.alert('Permission required', 'Allow camera or photo library access to scan a card.');
        return;
      }
      await pickFromLibrary();
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      await processImage(result.assets[0].uri);
    }
  };

  const processImage = async (uri: string) => {
    setScanning(true);
    try {
      const extracted = await api.scanBusinessCard(uri);
      setScanResult(extracted);
      setShowReview(true);
    } catch (err: any) {
      Alert.alert('Scan failed', err.message ?? 'Could not extract info from the card.');
    } finally {
      setScanning(false);
    }
  };

  const handleSaveContact = async (fields: Partial<ScanResult>) => {
    await api.addContact(fields);
    setScanResult(null);
    router.push('/(tabs)/contacts');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Scans</Text>
      </View>

      {/* Empty / hero state */}
      <View style={styles.hero}>
        <View style={styles.circleOuter}>
          <View style={styles.circleMiddle}>
            <View style={styles.circleInner}>
              {scanning ? (
                <ActivityIndicator color={COLORS.accent} size="large" />
              ) : (
                <Ionicons name="scan-outline" size={48} color={COLORS.accent} />
              )}
            </View>
          </View>
        </View>

        <Text style={styles.heroTitle}>
          {scanning ? 'Extracting contact info…' : 'Scan a business card'}
        </Text>
        <Text style={styles.heroSub}>
          {scanning
            ? 'Claude AI is reading the card'
            : 'Point your camera at any business card to instantly save the contact'}
        </Text>
      </View>

      {/* Scan button */}
      <View style={styles.btnWrapper}>
        <Pressable
          style={[styles.scanBtn, scanning && styles.scanBtnDim]}
          onPress={handleScan}
          disabled={scanning}
        >
          <Ionicons name="camera-outline" size={20} color="#0C0C0E" />
          <Text style={styles.scanBtnText}>Scan</Text>
        </Pressable>
        <Pressable style={styles.libraryBtn} onPress={pickFromLibrary} disabled={scanning}>
          <Text style={styles.libraryBtnText}>Choose from library</Text>
        </Pressable>
      </View>

      <ContactReviewSheet
        visible={showReview}
        initial={scanResult}
        onClose={() => { setShowReview(false); setScanResult(null); }}
        onSave={handleSaveContact}
        title="Review Contact"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  heading: { fontSize: 22, fontFamily: FONTS.semiBold, color: COLORS.text },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  circleOuter: {
    width: 200, height: 200,
    borderRadius: 100,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  circleMiddle: {
    width: 148, height: 148,
    borderRadius: 74,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  circleInner: {
    width: 96, height: 96,
    borderRadius: 48,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.accent + '55',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.accentDim,
  },
  heroTitle: { fontSize: 20, fontFamily: FONTS.semiBold, color: COLORS.text, textAlign: 'center', letterSpacing: -0.4 },
  heroSub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },
  btnWrapper: { paddingHorizontal: 20, paddingBottom: 28, gap: 10 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 16, backgroundColor: COLORS.accent,
  },
  scanBtnDim: { opacity: 0.5 },
  scanBtnText: { fontSize: 15, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
  libraryBtn: { alignItems: 'center', paddingVertical: 8 },
  libraryBtnText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
});
