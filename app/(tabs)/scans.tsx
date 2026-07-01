import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Partial<ScanResult> | null>(null);
  const [showReview, setShowReview] = useState(false);

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission required', 'Allow camera access to scan a business card.');
        return;
      }
    }
    setShowCamera(true);
  };

  const handleCapture = async () => {
    if (!cameraRef.current || scanning) return;
    setScanning(true);
    setShowCamera(false);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      await processImage(photo.uri);
    } catch (err: any) {
      Alert.alert('Scan failed', err.message ?? 'Could not take photo.');
      setScanning(false);
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Scan</Text>
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
          onPress={openCamera}
          disabled={scanning}
        >
          <Ionicons name="camera-outline" size={20} color="#0C0C0E" />
          <Text style={styles.scanBtnText}>Scan</Text>
        </Pressable>
        <Pressable style={styles.libraryBtn} onPress={pickFromLibrary} disabled={scanning}>
          <Text style={styles.libraryBtnText}>Choose from library</Text>
        </Pressable>
      </View>

      {/* In-app camera modal */}
      <Modal visible={showCamera} animationType="slide" statusBarTranslucent>
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            flash={flash}
          />

          {/* Top bar */}
          <SafeAreaView style={styles.cameraTopBar}>
            <Pressable style={styles.cameraIconBtn} onPress={() => setShowCamera(false)}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.cameraTitle}>Scan Card</Text>
            <View style={{ width: 40 }} />
          </SafeAreaView>

          {/* Corner bracket viewfinder */}
          <View style={styles.viewfinderWrap} pointerEvents="none">
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.viewfinderHint}>Align business card within the frame</Text>
          </View>

          {/* Bottom controls */}
          <SafeAreaView edges={['bottom']} style={styles.cameraBottomBar}>
            <View style={styles.cameraControls}>
              {/* Library picker */}
              <Pressable
                style={styles.cameraSecondaryBtn}
                onPress={() => { setShowCamera(false); pickFromLibrary(); }}
              >
                <Ionicons name="images-outline" size={22} color="#fff" />
              </Pressable>

              {/* Shutter */}
              <Pressable style={styles.shutter} onPress={handleCapture}>
                <View style={styles.shutterInner} />
              </Pressable>

              {/* Flash */}
              <Pressable
                style={styles.cameraSecondaryBtn}
                onPress={() => setFlash(f => f === 'off' ? 'on' : 'off')}
              >
                <Ionicons
                  name={flash === 'on' ? 'flash' : 'flash-off'}
                  size={22}
                  color={flash === 'on' ? COLORS.accent : '#fff'}
                />
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

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

const BRACKET = 28;
const BRACKET_THICKNESS = 3;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  heading: { fontSize: 22, fontFamily: FONTS.semiBold, color: COLORS.text },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  circleOuter: {
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  circleMiddle: {
    width: 148, height: 148, borderRadius: 74,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  circleInner: {
    width: 96, height: 96, borderRadius: 48,
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

  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8,
  },
  cameraTitle: { fontSize: 16, fontFamily: FONTS.semiBold, color: '#fff' },
  cameraIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Viewfinder
  viewfinderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  viewfinder: {
    width: 280, height: 180,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: BRACKET, height: BRACKET,
    borderColor: COLORS.accent,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: BRACKET_THICKNESS, borderLeftWidth: BRACKET_THICKNESS },
  cornerTR: { top: 0, right: 0, borderTopWidth: BRACKET_THICKNESS, borderRightWidth: BRACKET_THICKNESS },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: BRACKET_THICKNESS, borderLeftWidth: BRACKET_THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: BRACKET_THICKNESS, borderRightWidth: BRACKET_THICKNESS },
  viewfinderHint: {
    fontSize: 13, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.7)', textAlign: 'center',
  },

  // Bottom controls
  cameraBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  cameraControls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 48, paddingBottom: 24, paddingTop: 16,
  },
  cameraSecondaryBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutter: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#fff',
  },
});
