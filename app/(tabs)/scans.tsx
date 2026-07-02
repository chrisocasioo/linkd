import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
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

const BRACKET = 28;
const BRACKET_THICKNESS = 3;

export default function ScansScreen() {
  const api = useApi();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Partial<ScanResult> | null>(null);
  const [showReview, setShowReview] = useState(false);

  const handleCapture = async () => {
    if (!cameraRef.current || scanning) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      await processImage(photo!.uri);
    } catch (err: any) {
      Alert.alert('Scan failed', err.message ?? 'Could not take photo.');
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
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

  // Permission not yet determined
  if (!permission) {
    return <View style={styles.safe} />;
  }

  // Permission denied — show prompt
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={48} color={COLORS.accent} />
          <Text style={styles.permTitle}>Camera Access</Text>
          <Text style={styles.permSub}>Allow camera access to scan business cards</Text>
          <Pressable style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Allow Camera</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Camera fills available space */}
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          flash={flash}
        />

        {/* Viewfinder overlay */}
        <View style={styles.viewfinderWrap} pointerEvents="none">
          <Text style={styles.hint}>Align business card within the frame</Text>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        {/* Scanning overlay */}
        {scanning && (
          <View style={styles.scanningOverlay} pointerEvents="none">
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.scanningText}>Reading card…</Text>
          </View>
        )}
      </View>

      {/* Controls below camera, above tab bar */}
      <View style={styles.controls}>
        <Pressable style={styles.secondaryBtn} onPress={pickFromLibrary} disabled={scanning}>
          <Ionicons name="images-outline" size={22} color="#fff" />
        </Pressable>

        <Pressable
          style={[styles.shutter, scanning && { opacity: 0.4 }]}
          onPress={handleCapture}
          disabled={scanning}
        >
          <View style={styles.shutterInner} />
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
          disabled={scanning}
        >
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off'}
            size={22}
            color={flash === 'on' ? COLORS.accent : '#fff'}
          />
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
  safe: { flex: 1, backgroundColor: '#000' },

  permissionBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingHorizontal: 40, backgroundColor: COLORS.bg,
  },
  permTitle: { fontSize: 20, fontFamily: FONTS.semiBold, color: COLORS.text },
  permSub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  permBtn: {
    marginTop: 8, height: 48, paddingHorizontal: 28,
    borderRadius: 14, backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  permBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#0C0C0E' },

  cameraWrap: { flex: 1, overflow: 'hidden' },

  viewfinderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  hint: {
    fontSize: 12, fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.65)', textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  viewfinder: { width: 280, height: 180, position: 'relative' },
  corner: { position: 'absolute', width: BRACKET, height: BRACKET, borderColor: COLORS.accent },
  cornerTL: { top: 0, left: 0, borderTopWidth: BRACKET_THICKNESS, borderLeftWidth: BRACKET_THICKNESS },
  cornerTR: { top: 0, right: 0, borderTopWidth: BRACKET_THICKNESS, borderRightWidth: BRACKET_THICKNESS },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: BRACKET_THICKNESS, borderLeftWidth: BRACKET_THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: BRACKET_THICKNESS, borderRightWidth: BRACKET_THICKNESS },

  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  scanningText: { fontSize: 15, fontFamily: FONTS.medium, color: '#fff' },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 56,
    paddingVertical: 20,
    backgroundColor: '#000',
  },
  secondaryBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutter: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
});
