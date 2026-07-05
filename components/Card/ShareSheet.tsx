import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Dimensions,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import WalletManager from 'react-native-wallet-manager';
import { Card, User } from '../../lib/api';
import { triggerLiveActivityOnShare } from '../../lib/liveActivity';
import { buildVcard, contactFromCard } from '../../lib/vcard';
import { COLORS, FONTS } from '../../constants/colors';
import { PASS_TYPE_ID, SHARE_BASE, publicCardUrl } from '../../constants/config';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.64;

interface Props {
  visible: boolean;
  username: string;
  user?: User | null;
  card?: Card | null;
  onClose: () => void;
}

export function ShareSheet({ visible, username, user, card, onClose }: Props) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const [qrMode, setQrMode] = useState<'online' | 'offline'>('online');
  const [inWallet, setInWallet] = useState(false);
  // Passes already in Wallet when the sheet opened: their button is hidden
  // outright. A pass added DURING this open keeps the button visible in its
  // green "Added" state until the next open.
  const [addedAtOpen, setAddedAtOpen] = useState({ online: false, offline: false });

  useEffect(() => {
    if (!visible || !card) {
      setAddedAtOpen({ online: false, offline: false });
      return;
    }
    let alive = true;
    (async () => {
      const [online, offline] = await Promise.all([
        WalletManager.hasPass(PASS_TYPE_ID, card.id).catch(() => false),
        WalletManager.hasPass(PASS_TYPE_ID, `${card.id}-offline`).catch(() => false),
      ]);
      if (alive) setAddedAtOpen({ online: !!online, offline: !!offline });
    })();
    return () => { alive = false; };
  }, [visible, card?.id]);

  // Reflect whether the active mode's pass is already in Wallet. Re-checked
  // when the sheet opens, the mode flips, or the app returns to foreground
  // (in case the user removed the pass in the Wallet app).
  const passSerial = card ? (qrMode === 'offline' ? `${card.id}-offline` : card.id) : null;
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (!passSerial) { setInWallet(false); return; }
      try {
        const has = await WalletManager.hasPass(PASS_TYPE_ID, passSerial);
        if (alive) setInWallet(!!has);
      } catch {
        if (alive) setInWallet(false);
      }
    };
    if (visible) check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && visible) check();
    });
    return () => { alive = false; sub.remove(); };
  }, [visible, passSerial]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }).start();
      setQrMode('online');
    }
  }, [visible]);

  const slug = card?.slug;
  const url = publicCardUrl(username, slug);

  // Offline QR encodes the vCard itself — scanning pops a native, pre-filled
  // "Add to Contacts" card with zero internet on either phone (HiHello-style)
  const offlineQrValue = card ? buildVcard(card, user ?? null, url, { compact: true }) : url;
  const qrValue = qrMode === 'offline' ? offlineQrValue : url;

  const handleShare = async () => {
    await Share.share({ message: url });
    if (card) await triggerLiveActivityOnShare(card, username);
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
      await triggerLiveActivityOnShare(card, username);
    } catch (err: any) {
      Alert.alert('Share failed', err.message);
    }
  };

  const handleAddToWallet = async () => {
    if (!card || inWallet) return;
    // The pass follows the active QR mode: online = link QR, offline = vCard QR
    const passUrl = `https://${SHARE_BASE}/pass/${card.id}${qrMode === 'offline' ? '?mode=offline' : ''}`;
    try {
      // Native in-app add sheet (needs the Wallet entitlement)
      await WalletManager.addPassFromUrl(passUrl);
      if (passSerial) {
        setInWallet(!!(await WalletManager.hasPass(PASS_TYPE_ID, passSerial).catch(() => false)));
      }
    } catch {
      // Fallback: real Safari handles .pkpass (in-app browser does not)
      try {
        await Linking.openURL(passUrl);
      } catch (err: any) {
        Alert.alert('Could not open pass', err.message ?? 'Try again.');
      }
    }
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
              />
            </View>
            <Text style={styles.qrCaption}>
              {qrMode === 'offline'
                ? 'Scan to add contact — works without internet'
                : 'Scan to open digital card'}
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

          {/* Share follows the mode: online shares the link, offline shares
              the contact card itself (AirDrop works with no internet) */}
          <Pressable
            style={[styles.btnPrimary, qrMode === 'offline' && !card && { opacity: 0.4 }]}
            onPress={qrMode === 'online' ? handleShare : handleShareContact}
            disabled={qrMode === 'offline' && !card}
          >
            <Text style={styles.btnPrimaryText}>Share</Text>
          </Pressable>

          {/* Apple Wallet — hidden when this mode's pass was already added
              before the sheet opened */}
          {!addedAtOpen[qrMode] && (
            <Pressable
              style={[styles.walletBtn, !card && { opacity: 0.4 }, inWallet && styles.walletBtnAdded]}
              onPress={handleAddToWallet}
              disabled={!card || inWallet}
            >
              <Ionicons
                name={inWallet ? 'checkmark-circle' : 'wallet-outline'}
                size={16}
                color={inWallet ? '#22C55E' : '#fff'}
              />
              <Text style={[styles.walletBtnText, inWallet && styles.walletBtnTextAdded]}>
                {inWallet ? 'Added to Wallet' : 'Add to Apple Wallet'}
              </Text>
            </Pressable>
          )}
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
  btnPrimary: { width: '100%', height: 46, borderRadius: 13, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
  walletBtn: {
    width: '100%', height: 46, borderRadius: 13, flexDirection: 'row', gap: 8,
    backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  walletBtnText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#fff' },
  walletBtnAdded: { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' },
  walletBtnTextAdded: { color: '#22C55E' },
});
