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
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { ContactReviewSheet } from '../../components/Contacts/ContactReviewSheet';
import { useApi, ScanResult } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

function parseBusinessCard(rawText: string): Partial<ScanResult> {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  const emailMatch = lines.find((l) =>
    /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(l.replace(/\s/g, ''))
  );
  const email = emailMatch ? emailMatch.replace(/\s/g, '') : null;

  const phoneMatch = lines.find(
    (l) => /^[\+]?[\d\s\.\-\(\)]{7,}$/.test(l.trim()) && (l.match(/\d/g) ?? []).length >= 7
  );

  const websiteMatch = lines.find(
    (l) => /^(https?:\/\/|www\.)/i.test(l) || /\.(com|io|co|net|org|app|me|dev)\/?$/i.test(l)
  );

  const used = new Set([emailMatch, phoneMatch, websiteMatch].filter(Boolean) as string[]);
  const remaining = lines.filter((l) => !used.has(l));

  const nameLine = remaining.find((l) => {
    const w = l.split(/\s+/);
    return w.length >= 2 && w.length <= 4 && /^[A-Za-z\s\.\-\']+$/.test(l) && l !== l.toUpperCase();
  });
  const firstName = nameLine ? nameLine.split(/\s+/)[0] : null;
  const lastName = nameLine ? nameLine.split(/\s+/).slice(1).join(' ') || null : null;
  if (nameLine) used.add(nameLine);

  const afterName = remaining.filter((l) => !used.has(l));

  const titleKw = /\b(CEO|CTO|CFO|COO|VP|SVP|EVP|Director|Manager|Engineer|Developer|Designer|Founder|President|Lead|Head|Consultant|Advisor|Partner|Associate|Analyst|Specialist|Officer|Coordinator|Executive|Producer|Architect|Strategist)\b/i;
  const jobTitleLine = afterName.find(
    (l) => titleKw.test(l) || (l.split(/\s+/).length <= 4 && !/\d/.test(l))
  );
  if (jobTitleLine) used.add(jobTitleLine);

  const coKw = /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Group|Studio|Agency|Labs?|Technologies?|Solutions?|Services?|Consulting|Co\.?|International|Global|Holdings?)\b/i;
  const companyLine = afterName.find(
    (l) => !used.has(l) && (coKw.test(l) || l === l.toUpperCase() || l.split(/\s+/).length <= 4)
  );

  return {
    firstName,
    lastName,
    email,
    phone: phoneMatch ?? null,
    company: companyLine ?? null,
    jobTitle: jobTitleLine ?? null,
    website: websiteMatch ?? null,
  };
}

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
      const result = await TextRecognition.recognize(uri);
      const extracted = parseBusinessCard(result.text);
      setScanResult(extracted);
      setShowReview(true);
    } catch (err: any) {
      Alert.alert('Scan failed', err.message ?? 'Could not read the card.');
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
          {scanning ? 'Reading card…' : 'Scan a business card'}
        </Text>
        <Text style={styles.heroSub}>
          {scanning
            ? 'Extracting contact info on-device'
            : 'Point your camera at any business card to instantly save the contact'}
        </Text>
      </View>

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
