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
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { ContactReviewSheet } from '../../components/Contacts/ContactReviewSheet';
import { QrGeneratorSheet } from '../../components/Scan/QrGeneratorSheet';
import { QrScanResultSheet } from '../../components/Scan/QrScanResultSheet';
import { ScanHistorySheet } from '../../components/Scan/ScanHistorySheet';
import { useApi, ScanResult } from '../../lib/api';
import { markSyncedToPhone, saveContactToPhone } from '../../lib/nativeContacts';
import { inferQrFormat, parseWifiQr } from '../../lib/qrFormat';
import { COLORS, FONTS } from '../../constants/colors';

function extractLargeTextLines(result: any): Set<string> {
  const lineSizes: Array<{ text: string; height: number }> = [];
  for (const block of result.blocks ?? []) {
    for (const line of block.lines ?? []) {
      const h = line.frame?.height ?? 0;
      const t = (line.text ?? '').trim();
      if (h > 0 && t) lineSizes.push({ text: t, height: h });
    }
  }
  if (lineSizes.length === 0) return new Set();
  const sorted = [...lineSizes].sort((a, b) => a.height - b.height);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1].height + sorted[mid].height) / 2
    : sorted[mid].height;
  return new Set(lineSizes.filter((s) => s.height >= median * 1.5).map((s) => s.text));
}

function parseBusinessCard(rawText: string, largeTextLines: Set<string> = new Set()): Partial<ScanResult> {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  const emailMatch = lines.find((l) =>
    /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(l.replace(/\s/g, ''))
  );
  const email = emailMatch ? emailMatch.replace(/\s/g, '') : null;

  // Mark fax lines (and P&F lines) so they don't bleed into other parsing
  const faxSet = new Set<string>();
  const pfSet = new Set<string>(); // P&F = phone AND fax — still yields a phone number
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/\bp[&\/]f\b/i.test(l)) {
      faxSet.add(l);
      pfSet.add(l);
    } else if (/\bfax\b/i.test(l)) {
      faxSet.add(l);
      // "Fax:" label on its own line — skip the following number line too
      if (/^fax:?\s*$/i.test(l.trim()) && i + 1 < lines.length) {
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
    if (faxSet.has(l) && !pfSet.has(l)) continue; // skip pure-fax lines; P&F still yields a phone
    const stripped = stripPhoneLabel(l);
    if (/^[\+]?[\d\s\.\-\(\)x]{7,}$/.test(stripped) && (stripped.match(/\d/g) ?? []).length >= 7) {
      phoneLine = l;
      phone = stripped;
      break;
    }
  }

  // Extract all fax numbers from faxSet lines
  const FAX_LABEL = /^(?:fax(?:simile)?|f|p[&\/]f)\s*[:\.\-]?\s*/i;
  const allFaxes: string[] = [];
  for (const l of [...faxSet]) {
    const stripped = l.replace(FAX_LABEL, '').replace(PHONE_SUFFIX, '').trim();
    if (/^[\+]?[\d\s\.\-\(\)x]{7,}$/.test(stripped) && (stripped.match(/\d/g) ?? []).length >= 7) {
      if (!allFaxes.includes(stripped)) allFaxes.push(stripped);
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
  // Large/prominent text (logo text) is most likely the company name — use it first
  const companyLine =
    afterName.find((l) => !used.has(l) && largeTextLines.has(l)) ??
    afterName.find((l) => !used.has(l) && (coKw.test(l) || l === l.toUpperCase() || l.split(/\s+/).length <= 4));
  if (companyLine) used.add(companyLine);

  // Address: look for lines with street numbers, suite/floor keywords, city/state/zip patterns,
  // or multi-line sequences that together form an address. Collect consecutive address lines.
  const addrKw = /\b(St\.?|Street|Ave\.?|Avenue|Blvd\.?|Boulevard|Rd\.?|Road|Dr\.?|Drive|Ln\.?|Lane|Ct\.?|Court|Pl\.?|Place|Pkwy|Hwy|Suite|Ste\.?|Floor|Fl\.?|Unit|Apt\.?|Building|Bldg\.?)\b/i;
  const zipPattern = /\b\d{5}(-\d{4})?\b/;
  const streetNumPattern = /^\d+\s+\w/;

  const allAddresses: string[] = [];
  let currentAddrLines: string[] = [];
  for (const l of lines) {
    if (used.has(l)) {
      if (currentAddrLines.length > 0) { allAddresses.push(currentAddrLines.join(', ')); currentAddrLines = []; }
      continue;
    }
    if (addrKw.test(l) || zipPattern.test(l) || streetNumPattern.test(l)) {
      currentAddrLines.push(l);
      used.add(l);
    } else if (currentAddrLines.length > 0) {
      allAddresses.push(currentAddrLines.join(', '));
      currentAddrLines = [];
    }
  }
  if (currentAddrLines.length > 0) allAddresses.push(currentAddrLines.join(', '));
  const address = allAddresses[0] ?? null;

  return {
    firstName,
    lastName,
    email,
    phone: phone ?? null,
    fax: allFaxes[0] ?? null,
    faxes: allFaxes,
    company: companyLine ?? null,
    jobTitle: jobTitleLine ?? null,
    website: allWebsites[0] ?? null,
    websites: allWebsites,
    address,
    addresses: allAddresses,
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const consecutiveHitsRef = useRef(0);

  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturing, setCapturing] = useState(false);
  const [detected, setDetected] = useState(false);
  const [scanResult, setScanResult] = useState<Partial<ScanResult> | null>(null);
  const [showReview, setShowReview] = useState(false);

  const [showQrGenerator, setShowQrGenerator] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [scannedQrValue, setScannedQrValue] = useState<string | null>(null);
  const [showQrResult, setShowQrResult] = useState(false);
  const qrCooldownRef = useRef(false);

  const handleQrScanned = (value: string) => {
    if (qrCooldownRef.current) return;
    qrCooldownRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScannedQrValue(value);
    setShowQrResult(true);
    const format = inferQrFormat(value);
    const wifi = format === 'wifi' ? parseWifiQr(value) : null;
    const label = wifi ? `Wi-Fi: ${wifi.ssid}` : value.slice(0, 80);
    api.addScanHistory({ type: 'qr', label, qrData: value, qrFormat: format }).catch(() => {});
  };

  const handleCloseQrResult = () => {
    setShowQrResult(false);
    setScannedQrValue(null);
    qrCooldownRef.current = false;
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (showReview || showQrResult || showQrGenerator || showHistory) return;
      const value = codes[0]?.value;
      if (value) handleQrScanned(value);
    },
  });

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
    if (!hasPermission || !device || showReview || showQrResult || showQrGenerator || showHistory) {
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
        const parsed = parseBusinessCard(result.text, extractLargeTextLines(result));
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
  }, [hasPermission, device, showReview, showQrResult, showQrGenerator, showHistory]);

  // Manual capture — for cards the auto-detect loop can't read. Always opens
  // the review sheet with whatever OCR found (even nothing) so the user can
  // finish the contact by hand.
  const captureManually = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    detectingRef.current = true; // pause the live-scan loop while we capture
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const snapshot = await cameraRef.current.takeSnapshot({ quality: 90 });
      const uri = snapshot.path.startsWith('file://') ? snapshot.path : `file://${snapshot.path}`;
      const result = await TextRecognition.recognize(uri);
      setScanResult(parseBusinessCard(result.text, extractLargeTextLines(result)));
      setShowReview(true);
      setDetected(false);
      consecutiveHitsRef.current = 0;
    } catch {}
    detectingRef.current = false;
    setCapturing(false);
  };

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
        setScanResult(parseBusinessCard(ocr.text, extractLargeTextLines(ocr)));
        setShowReview(true);
      } catch {}
    }
  };

  const handleCloseReview = () => {
    setShowReview(false);
    setScanResult(null);
  };

  const handleSaveContact = async (fields: Partial<ScanResult>) => {
    const created = await api.addContact({ ...fields, source: 'scan' });
    saveContactToPhone(created).then((written) => {
      if (written) markSyncedToPhone(created.id);
    });
    const label = [created.firstName, created.lastName].filter(Boolean).join(' ') || 'Unknown';
    api.addScanHistory({ type: 'contact', contactId: created.id, label }).catch(() => {});
    setScanResult(null);
    router.push('/(tabs)/contacts');
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]} edges={['top']}>
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={48} color={COLORS.accent} />
          <Text style={styles.permTitle}>Camera Access</Text>
          <Text style={styles.permSub}>Allow camera access to scan business cards and QR codes</Text>
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
          isActive={!showReview && !showQrResult && !showQrGenerator && !showHistory}
          torch={flash}
          video
          codeScanner={codeScanner}
        />

        {/* Top controls — QR generator/browser (left), scan history (right) */}
        <View style={styles.topControls}>
          <Pressable style={styles.secondaryBtn} onPress={() => setShowQrGenerator(true)}>
            <Ionicons name="qr-code-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => setShowHistory(true)}>
            <Ionicons name="time-outline" size={20} color="#fff" />
          </Pressable>
        </View>

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

        {/* Scanning indicator — above the floating controls */}
        <View style={styles.scanningPill} pointerEvents="none">
          <View style={styles.scanDot} />
          <Text style={styles.scanningText}>Scanning…</Text>
        </View>

        {/* Controls — float over the camera preview */}
        <View style={styles.controls}>
          <Pressable style={styles.secondaryBtn} onPress={pickFromLibrary}>
            <Ionicons name="images-outline" size={22} color="#fff" />
          </Pressable>

          {/* Manual capture — in case a card isn't being auto-detected */}
          <Pressable style={styles.shutterBtn} onPress={captureManually} disabled={capturing}>
            <View style={[styles.shutterInner, capturing && { opacity: 0.4 }]} />
          </Pressable>

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
      </View>

      <ContactReviewSheet
        visible={showReview}
        initial={scanResult}
        onClose={handleCloseReview}
        onSave={handleSaveContact}
        title="Review Contact"
      />

      <QrScanResultSheet visible={showQrResult} value={scannedQrValue} onClose={handleCloseQrResult} />
      <QrGeneratorSheet visible={showQrGenerator} onClose={() => setShowQrGenerator(false)} />
      <ScanHistorySheet visible={showHistory} onClose={() => setShowHistory(false)} />
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
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    paddingVertical: 20,
  },
  topControls: {
    position: 'absolute',
    left: 0, right: 0, top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
    paddingVertical: 16,
  },
  secondaryBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanningPill: {
    position: 'absolute', bottom: 122, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  shutterBtn: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 4, borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff',
  },
  scanDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  scanningText: { fontSize: 13, fontFamily: FONTS.medium, color: 'rgba(255,255,255,0.6)' },
});
