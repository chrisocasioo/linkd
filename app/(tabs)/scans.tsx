import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
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

  // Mark fax lines so they aren't picked up as the phone number
  const faxSet = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    if (/\bfax\b/i.test(lines[i])) {
      faxSet.add(lines[i]);
      // "Fax:" label on its own line — skip the following number line too
      if (/^fax:?\s*$/i.test(lines[i].trim()) && i + 1 < lines.length) {
        faxSet.add(lines[i + 1]);
      }
    }
  }

  // Strip common phone label prefixes ("Phone:", "Tel:", "Bus.", "Cel:", etc.)
  // and suffixes ("- Cell", "- Mobile", etc.) then validate what remains
  const PHONE_PREFIX = /^(?:phone|tel(?:ephone)?|bus(?:iness)?|cel(?:l)?|mob(?:ile)?|ph|dir(?:ect)?|off(?:ice)?|work|home|main|direct|p[&\/]f|t|p|c|m)\s*[:\.\-]?\s*/i;
  const PHONE_SUFFIX = /\s*[-–—|]\s*(?:cell|mobile|office|work|home|direct|bus(?:iness)?|main|ph(?:one)?)\s*$/i;

  function stripPhoneLabel(line: string): string {
    return line.replace(PHONE_PREFIX, '').replace(PHONE_SUFFIX, '').trim();
  }

  let phoneLine: string | null = null;
  let phone: string | null = null;
  for (const l of lines) {
    if (faxSet.has(l)) continue;
    const stripped = stripPhoneLabel(l);
    if (/^[\+]?[\d\s\.\-\(\)x]{7,}$/.test(stripped) && (stripped.match(/\d/g) ?? []).length >= 7) {
      phoneLine = l;
      phone = stripped;
      break;
    }
  }

  // Extract all URLs from lines — handles www., http://, bare domains
  const URL_RE = /(?:https?:\/\/[^\s,;]+|www\.[^\s,;]+|[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?\.(?:com|io|co|net|org|app|me|dev|biz|info)[^\s,;]*)/gi;
  const allWebsites: string[] = [];
  const websiteLineSet = new Set<string>();
  for (const l of lines) {
    if (l.includes('@')) continue;
    const matches = l.match(URL_RE);
    if (matches) {
      websiteLineSet.add(l);
      for (const m of matches) {
        const clean = m.replace(/[.,;:!?)"'\]}>]+$/, '');
        if (clean && !allWebsites.includes(clean)) allWebsites.push(clean);
      }
    }
  }

  const used = new Set([emailMatch, phoneLine, ...websiteLineSet, ...faxSet].filter(Boolean) as string[]);
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
  if (companyLine) used.add(companyLine);

  // Address: look for lines with street numbers, suite/floor keywords, city/state/zip patterns,
  // or multi-line sequences that together form an address. Collect consecutive address lines.
  const addrKw = /\b(St\.?|Street|Ave\.?|Avenue|Blvd\.?|Boulevard|Rd\.?|Road|Dr\.?|Drive|Ln\.?|Lane|Ct\.?|Court|Pl\.?|Place|Pkwy|Hwy|Suite|Ste\.?|Floor|Fl\.?|Unit|Apt\.?|Building|Bldg\.?)\b/i;
  const zipPattern = /\b\d{5}(-\d{4})?\b/;
  const streetNumPattern = /^\d+\s+\w/;

  const addressLines: string[] = [];
  for (const l of lines) {
    if (used.has(l)) continue;
    if (addrKw.test(l) || zipPattern.test(l) || streetNumPattern.test(l)) {
      addressLines.push(l);
      used.add(l);
    }
  }
  const address = addressLines.length > 0 ? addressLines.join(', ') : null;

  return {
    firstName,
    lastName,
    email,
    phone: phone ?? null,
    company: companyLine ?? null,
    jobTitle: jobTitleLine ?? null,
    website: allWebsites[0] ?? null,
    websites: allWebsites,
    address,
  };
}

function hasEnoughInfo(r: Partial<ScanResult>): boolean {
  return !!((r.firstName || r.lastName) && (r.email || r.phone || r.website || r.company));
}

const BRACKET = 28;
const BRACKET_THICKNESS = 3;

export default function ScansScreen() {
  const api = useApi();
  const router = useRouter();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const detectingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const consecutiveHitsRef = useRef(0);

  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [detected, setDetected] = useState(false);
  const [scanResult, setScanResult] = useState<Partial<ScanResult> | null>(null);
  const [showReview, setShowReview] = useState(false);

  // Pulsing bracket animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Live scan loop
  useEffect(() => {
    if (!hasPermission || !device || showReview) {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(async () => {
      if (detectingRef.current || !cameraRef.current) return;
      detectingRef.current = true;
      try {
        const snapshot = await cameraRef.current.takeSnapshot({ quality: 50 });
        const uri = snapshot.path.startsWith('file://') ? snapshot.path : `file://${snapshot.path}`;
        const result = await TextRecognition.recognize(uri);
        const parsed = parseBusinessCard(result.text);
        if (hasEnoughInfo(parsed)) {
          consecutiveHitsRef.current += 1;
          if (consecutiveHitsRef.current === 2) setDetected(true);
          if (consecutiveHitsRef.current >= 3) {
            clearInterval(intervalRef.current);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setTimeout(() => {
              setScanResult(parsed);
              setShowReview(true);
              setDetected(false);
              consecutiveHitsRef.current = 0;
            }, 400);
          }
        } else {
          consecutiveHitsRef.current = 0;
          setDetected(false);
        }
      } catch {}
      detectingRef.current = false;
    }, 1200);

    return () => clearInterval(intervalRef.current);
  }, [hasPermission, device, showReview]);

  const pickFromLibrary = async () => {
    clearInterval(intervalRef.current);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const ocr = await TextRecognition.recognize(result.assets[0].uri);
        setScanResult(parseBusinessCard(ocr.text));
        setShowReview(true);
      } catch {}
    }
  };

  const handleCloseReview = () => {
    setShowReview(false);
    setScanResult(null);
  };

  const handleSaveContact = async (fields: Partial<ScanResult>) => {
    await api.addContact(fields);
    setScanResult(null);
    router.push('/(tabs)/contacts');
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]} edges={['top']}>
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

  if (!device) return <View style={styles.safe} />;

  const bracketColor = detected ? '#22C55E' : COLORS.accent;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.cameraWrap}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!showReview}
          torch={flash}
          video
        />

        {/* Viewfinder */}
        <View style={styles.viewfinderWrap} pointerEvents="none">
          <Animated.View style={[styles.viewfinder, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.corner, styles.cornerTL, { borderColor: bracketColor }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: bracketColor }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: bracketColor }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: bracketColor }]} />
            <Text style={[styles.hint, { color: detected ? '#22C55E' : 'rgba(255,255,255,0.65)' }]}>
              {detected ? 'Card detected!' : 'Hold card steady in frame'}
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable style={styles.secondaryBtn} onPress={pickFromLibrary}>
          <Ionicons name="images-outline" size={22} color="#fff" />
        </Pressable>

        <View style={styles.scanningIndicator}>
          <View style={styles.scanDot} />
          <Text style={styles.scanningText}>Scanning…</Text>
        </View>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
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
        onClose={handleCloseReview}
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
    gap: 12, paddingHorizontal: 40,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: { width: 280, height: 180, position: 'relative' },
  corner: { position: 'absolute', width: BRACKET, height: BRACKET },
  cornerTL: { top: 0, left: 0, borderTopWidth: BRACKET_THICKNESS, borderLeftWidth: BRACKET_THICKNESS },
  cornerTR: { top: 0, right: 0, borderTopWidth: BRACKET_THICKNESS, borderRightWidth: BRACKET_THICKNESS },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: BRACKET_THICKNESS, borderLeftWidth: BRACKET_THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: BRACKET_THICKNESS, borderRightWidth: BRACKET_THICKNESS },
  hint: {
    position: 'absolute',
    bottom: -36,
    alignSelf: 'center',
    fontSize: 12, fontFamily: FONTS.medium,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    paddingVertical: 20,
    backgroundColor: '#000',
  },
  secondaryBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanningIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  scanDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  scanningText: { fontSize: 13, fontFamily: FONTS.medium, color: 'rgba(255,255,255,0.6)' },
});
