import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
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
import { useApi } from '../../lib/api';
import { useRevenueCat } from '../../lib/RevenueCatContext';
import { COLORS, FONTS } from '../../constants/colors';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.62;
const BASE = 'linkd.tattoo';

interface Props {
  visible: boolean;
  username: string;
  customDomain?: string | null;
  onClose: () => void;
  onUsernameChange?: (username: string) => void;
  onCustomDomainChange?: (domain: string | null) => void;
}

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/i;

export function ShareSheet({ visible, username, customDomain, onClose, onUsernameChange, onCustomDomainChange }: Props) {
  const api = useApi();
  const { isPro, refresh: refreshPro } = useRevenueCat();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  // Username editing
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameValue, setUsernameValue] = useState(username);
  const [availability, setAvailability] = useState<boolean | null>(null);
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameRef = useRef<TextInput>(null);

  // Custom domain editing
  const [editingDomain, setEditingDomain] = useState(false);
  const [domainValue, setDomainValue] = useState(customDomain ?? '');
  const [domainError, setDomainError] = useState(false);
  const domainRef = useRef<TextInput>(null);

  useEffect(() => { setUsernameValue(username); }, [username]);
  useEffect(() => { setDomainValue(customDomain ?? ''); }, [customDomain]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }).start();
      setEditingUsername(false);
      setEditingDomain(false);
      setAvailability(null);
      setDomainError(false);
    }
  }, [visible]);

  // Username handlers
  const handleUsernameChange = (v: string) => {
    const cleaned = v.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setUsernameValue(cleaned);
    setAvailability(null);
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    if (!cleaned || cleaned === username) return;
    if (!/^[a-z0-9_-]{3,30}$/.test(cleaned)) { setAvailability(false); return; }
    usernameCheckTimer.current = setTimeout(async () => {
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

  // Custom domain handlers
  const handleDomainBlur = async () => {
    setEditingDomain(false);
    const trimmed = domainValue.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!trimmed) {
      // Clear custom domain
      setDomainValue('');
      try {
        await api.updateMe({ customDomain: null as any });
        onCustomDomainChange?.(null);
      } catch {}
      return;
    }
    if (!DOMAIN_RE.test(trimmed)) {
      setDomainError(true);
      setDomainValue(customDomain ?? '');
      return;
    }
    setDomainError(false);
    setDomainValue(trimmed);
    try {
      await api.updateMe({ customDomain: trimmed });
      onCustomDomainChange?.(trimmed);
    } catch {
      setDomainValue(customDomain ?? '');
    }
  };

  const clearDomain = async () => {
    setDomainValue('');
    setDomainError(false);
    try {
      await api.updateMe({ customDomain: null as any });
      onCustomDomainChange?.(null);
    } catch {}
  };

  const activeDomain = domainValue.trim() || null;
  const activeUrl = activeDomain ? `https://${activeDomain}` : `https://${BASE}/${usernameValue || username}`;

  const handleShare = async () => {
    await Share.share({ message: activeUrl });
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        <View style={styles.content}>
          {/* QR — updates when custom domain is set */}
          <View style={styles.qrOuter}>
            <View style={styles.qrInner}>
              <QRCode value={activeUrl} size={140} backgroundColor="#fff" color="#000" />
            </View>
          </View>

          {/* linkd.tattoo / username row */}
          <View style={styles.urlRow}>
            <Text style={styles.urlBase}>{BASE}/</Text>
            {editingUsername ? (
              <>
                <TextInput
                  ref={usernameRef}
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
                onPress={() => { setEditingUsername(true); setTimeout(() => usernameRef.current?.focus(), 80); }}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Text style={styles.urlUsername}>{usernameValue || username}</Text>
              </Pressable>
            )}
          </View>

          {/* Custom domain row */}
          {isPro ? (
            <View style={[styles.urlRow, domainError && styles.urlRowError]}>
              <Ionicons name="globe-outline" size={13} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
              {editingDomain ? (
                <TextInput
                  ref={domainRef}
                  style={styles.domainInput}
                  value={domainValue}
                  onChangeText={(v) => { setDomainValue(v); setDomainError(false); }}
                  onBlur={handleDomainBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="yourdomain.com"
                  placeholderTextColor={COLORS.textTertiary}
                />
              ) : (
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => { setEditingDomain(true); setTimeout(() => domainRef.current?.focus(), 80); }}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                >
                  <Text style={domainValue ? styles.domainSet : styles.domainPlaceholder} numberOfLines={1}>
                    {domainValue || 'Add custom domain'}
                  </Text>
                </Pressable>
              )}
              {domainValue && !editingDomain && (
                <Pressable onPress={clearDomain} hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}>
                  <Ionicons name="close-circle" size={15} color={COLORS.textTertiary} />
                </Pressable>
              )}
              {domainError && (
                <Text style={styles.domainErrText}>Invalid</Text>
              )}
            </View>
          ) : (
            <Pressable style={styles.urlRowLocked} onPress={() => {}}>
              <Ionicons name="globe-outline" size={13} color={COLORS.textTertiary} style={{ marginRight: 6 }} />
              <Text style={styles.domainLockedText}>Custom domain</Text>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>Pro</Text>
              </View>
            </Pressable>
          )}

          {/* Share */}
          <Pressable style={styles.btnPrimary} onPress={handleShare}>
            <Text style={styles.btnPrimaryText}>Share</Text>
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
  content: { padding: 18, paddingBottom: 36, gap: 10, alignItems: 'center' },
  qrOuter: {
    width: '100%', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 16, alignItems: 'center', justifyContent: 'center',
  },
  qrInner: { padding: 10, backgroundColor: '#fff', borderRadius: 10 },
  urlRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, height: 42, width: '100%',
  },
  urlRowError: { borderColor: '#ef4444' },
  urlRowLocked: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 14, height: 42, width: '100%',
    opacity: 0.6,
  },
  urlBase: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  urlUsername: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.accent },
  urlInput: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.accent, flex: 1, paddingVertical: 0 },
  check: { fontSize: 13, color: '#22c55e', marginLeft: 6 },
  ex: { fontSize: 13, color: '#ef4444', marginLeft: 6 },
  checking: { fontSize: 13, color: COLORS.textTertiary, marginLeft: 6 },
  domainInput: { flex: 1, fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.accent, paddingVertical: 0 },
  domainSet: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.accent },
  domainPlaceholder: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  domainLockedText: { flex: 1, fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  domainErrText: { fontSize: 11, color: '#ef4444', marginLeft: 6 },
  proBadge: { backgroundColor: COLORS.surface2, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  proBadgeText: { fontSize: 9, fontFamily: FONTS.medium, color: COLORS.textTertiary },
  btnPrimary: { width: '100%', height: 46, borderRadius: 13, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 13, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
});
