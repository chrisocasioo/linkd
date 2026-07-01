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
import { COLORS, FONTS } from '../../constants/colors';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.52;
const BASE = 'linkd-production-fdce.up.railway.app';

interface Props {
  visible: boolean;
  username: string;
  onClose: () => void;
  onUsernameChange?: (username: string) => void;
}

export function ShareSheet({ visible, username, onClose, onUsernameChange }: Props) {
  const api = useApi();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameValue, setUsernameValue] = useState(username);
  const [availability, setAvailability] = useState<boolean | null>(null);
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

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

  const url = `https://${BASE}/${usernameValue || username}`;

  const handleShare = async () => {
    await Share.share({ message: url });
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        <View style={styles.content}>
          {/* QR */}
          <View style={styles.qrOuter}>
            <View style={styles.qrInner}>
              <QRCode value={url} size={148} backgroundColor="#fff" color="#000" />
            </View>
          </View>

          {/* URL row */}
          <View style={styles.urlRow}>
            <Text style={styles.urlBase}>{BASE}/</Text>
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
          </View>

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
  content: { padding: 18, paddingBottom: 36, gap: 14, alignItems: 'center' },
  qrOuter: {
    width: '100%', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 20, alignItems: 'center', justifyContent: 'center',
  },
  qrInner: { padding: 10, backgroundColor: '#fff', borderRadius: 10 },
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
});
