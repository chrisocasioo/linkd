import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useApi, Card, User } from '../../lib/api';
import { buildVcard, contactFromCard } from '../../lib/vcard';
import { COLORS, FONTS } from '../../constants/colors';
import { SHARE_BASE, publicCardUrl } from '../../constants/config';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.74;

interface Props {
  visible: boolean;
  username: string;
  user?: User | null;
  card?: Card | null;
  onClose: () => void;
  onUsernameChange?: (username: string) => void;
}

export function ShareSheet({ visible, username, user, card, onClose, onUsernameChange }: Props) {
  const api = useApi();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameValue, setUsernameValue] = useState(username);
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [qrMode, setQrMode] = useState<'online' | 'offline'>('online');
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const qrRef = useRef<any>(null);

  useEffect(() => {
    setUsernameValue(username);
  }, [username]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }).start();
      setEditingUsername(false);
      setAvailability(null);
      setQrMode('online');
    }
  }, [visible]);

  const handleUsernameChange = (v: string) => {
    const cleaned = v.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setUsernameValue(cleaned);
    setAvailability(null);
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!cleaned || cleaned === username) return;
    if (!/^[a-z0-9_-]{3,30}$/.test(cleaned)) { setAvailability(false); return; }
    checkTimer.current = setTimeout(async () => {
      try {
        const { available } = await api.checkUsername(cleaned);
        setAvailability(available);
      } catch {}
    }, 500);
  };

  const handleUsernameBlur = async () => {
    setEditingUsername(false);
    setAvailability(null);
    const cleaned = usernameValue.toLowerCase().trim();
    if (!cleaned || cleaned === username || !/^[a-z0-9_-]{3,30}$/.test(cleaned)) {
      setUsernameValue(username);
      return;
    }
    try {
      const updated = await api.updateMe({ username: cleaned });
      onUsernameChange?.(updated.username ?? cleaned);
    } catch {
      setUsernameValue(username);
    }
  };

  const slug = card?.slug;
  const url = publicCardUrl(usernameValue || username, slug);

  // Offline QR encodes the vCard itself — scanning pops a native, pre-filled
  // "Add to Contacts" card with zero internet on either phone (HiHello-style)
  const offlineQrValue = card ? buildVcard(card, user ?? null, url, { compact: true }) : url;
  const qrValue = qrMode === 'offline' ? offlineQrValue : url;

  const handleShare = async () => {
    await Share.share({ message: url });
  };

  const handleShareContact = async () => {
    if (!card) return;
    try {
      const vcf = buildVcard(card, user ?? null, url);
      const safe = (user?.displayName ?? username ?? 'card').replace(/[^a-z0-9]/gi, '_') || 'card';
      const path = `${FileSystem.cacheDirectory}${safe}.vcf`;
      await FileSystem.writeAsStringAsync(path, vcf);
      await Sharing.shareAsync(path, {
        mimeType: 'text/vcard',
        UTI: 'public.vcard',
        dialogTitle: 'Share contact',
      });
    } catch (err: any) {
      Alert.alert('Share failed', err.message);
    }
  };

  const handleShareQr = async () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL(async (base64: string) => {
      try {
        const path = `${FileSystem.cacheDirectory}linkd-qr.png`;
        await FileSystem.writeAsStringAsync(path, base64, { encoding: 'base64' as any });
        await Sharing.shareAsync(path, { mimeType: 'image/png', dialogTitle: 'Share QR code' });
      } catch (err: any) {
        Alert.alert('Share failed', err.message);
      }
    });
  };

  const handleAddToWallet = async () => {
    if (!card) return;
    // Safari presents the signed .pkpass with the native "Add to Wallet" sheet
    await WebBrowser.openBrowserAsync(`https://${SHARE_BASE}/pass/${card.id}`);
  };

  const handleContactPreview = async () => {
    if (!card) return;
    try {
      // The native form requires Contacts access even just to present
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow contacts access to preview the offline contact card.');
        return;
      }
      // isNew:false presents the read-style "unknown contact" card — exactly
      // what a scanner of the offline QR sees, without saving anything
      await Contacts.presentFormAsync(null, contactFromCard(card, user ?? null, url), { isNew: false } as any);
    } catch (err: any) {
      Alert.alert('Preview unavailable', err.message ?? 'Could not open the contact preview.');
    }
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        <View style={styles.content}>
          {/* Offline contact preview — what a scanner of the offline QR gets */}
          {qrMode === 'offline' && (
            <Pressable style={styles.previewLink} onPress={handleContactPreview} hitSlop={8}>
              <Text style={styles.previewLinkText}>Offline Contact Preview</Text>
              <Ionicons name="open-outline" size={13} color={COLORS.textSecondary} />
            </Pressable>
          )}

          {/* QR */}
          <View style={styles.qrOuter}>
            <View style={styles.qrInner}>
              <QRCode
                value={qrValue}
                size={qrMode === 'offline' ? 180 : 148}
                backgroundColor="#fff"
                color="#000"
                ecl="M"
                getRef={(c) => { qrRef.current = c; }}
              />
            </View>
            <Text style={styles.qrCaption}>
              {qrMode === 'offline'
                ? 'Scan to add contact — works without internet'
                : 'Scan to open card'}
            </Text>
          </View>

          {/* Online / Offline QR toggle */}
          <View style={styles.qrToggle}>
            {(['online', 'offline'] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.qrToggleItem, qrMode === mode && styles.qrToggleItemActive]}
                onPress={() => setQrMode(mode)}
              >
                <Text style={[styles.qrToggleText, qrMode === mode && styles.qrToggleTextActive]}>
                  {mode === 'online' ? 'Online' : 'Offline'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* URL row */}
          <View style={styles.urlRow}>
            <Text style={styles.urlBase}>{SHARE_BASE}/</Text>
            {editingUsername ? (
              <>
                <TextInput
                  ref={inputRef}
                  style={styles.urlInput}
                  value={usernameValue}
                  onChangeText={handleUsernameChange}
                  onBlur={handleUsernameBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {usernameValue.length >= 3 && usernameValue !== username && (
                  <Text style={availability === true ? styles.check : availability === false ? styles.ex : styles.checking}>
                    {availability === true ? '✓' : availability === false ? '✗' : '…'}
                  </Text>
                )}
              </>
            ) : (
              <Pressable
                onPress={() => { setEditingUsername(true); setTimeout(() => inputRef.current?.focus(), 80); }}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Text style={styles.urlUsername}>{usernameValue || username}</Text>
              </Pressable>
            )}
            {slug ? <Text style={styles.urlBase}>/{slug}</Text> : null}
          </View>

          {/* Share */}
          <Pressable style={styles.btnPrimary} onPress={handleShare}>
            <Text style={styles.btnPrimaryText}>Share Link</Text>
          </Pressable>

          {/* Offline shares — AirDrop works peer-to-peer with no internet */}
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.btnSecondary, !card && { opacity: 0.4 }]}
              onPress={handleShareContact}
              disabled={!card}
            >
              <Ionicons name="person-add-outline" size={15} color={COLORS.text} />
              <Text style={styles.btnSecondaryText}>Share Contact</Text>
            </Pressable>
            <Pressable
              style={[styles.btnSecondary, !card && { opacity: 0.4 }]}
              onPress={handleShareQr}
              disabled={!card}
            >
              <Ionicons name="qr-code-outline" size={15} color={COLORS.text} />
              <Text style={styles.btnSecondaryText}>Share QR</Text>
            </Pressable>
          </View>

          {/* Apple Wallet */}
          <Pressable
            style={[styles.walletBtn, !card && { opacity: 0.4 }]}
            onPress={handleAddToWallet}
            disabled={!card}
          >
            <Ionicons name="wallet-outline" size={16} color="#fff" />
            <Text style={styles.walletBtnText}>Add to Apple Wallet</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#161618',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 16 },
  content: { padding: 18, paddingBottom: 36, gap: 12, alignItems: 'center' },
  previewLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  previewLinkText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  qrOuter: {
    width: '100%', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  qrInner: { padding: 10, backgroundColor: '#fff', borderRadius: 10 },
  qrCaption: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  qrToggle: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  qrToggleItem: { paddingHorizontal: 26, paddingVertical: 8, borderRadius: 11 },
  qrToggleItemActive: { backgroundColor: COLORS.accent },
  qrToggleText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  qrToggleTextActive: { color: '#0C0C0E', fontFamily: FONTS.semiBold },
  urlRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, height: 42, width: '100%',
  },
  urlBase: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  urlUsername: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.accent },
  urlInput: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.accent, flex: 1, paddingVertical: 0 },
  check: { fontSize: 13, color: '#22c55e', marginLeft: 6 },
  ex: { fontSize: 13, color: '#ef4444', marginLeft: 6 },
  checking: { fontSize: 13, color: COLORS.textTertiary, marginLeft: 6 },
  btnPrimary: { width: '100%', height: 46, borderRadius: 13, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
  btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btnSecondary: {
    flex: 1, height: 46, borderRadius: 13, flexDirection: 'row', gap: 7,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.text },
  walletBtn: {
    width: '100%', height: 46, borderRadius: 13, flexDirection: 'row', gap: 8,
    backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  walletBtnText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#fff' },
});
