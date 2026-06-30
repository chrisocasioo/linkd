import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinkRow } from '../components/Card/LinkRow';
import { LinkEditSheet } from '../components/Card/LinkEditSheet';
import { ContactCardSheet } from '../components/Card/ContactCardSheet';
import { ShareSheet } from '../components/Card/ShareSheet';
import { PaywallSheet } from '../components/Card/PaywallSheet';
import { EditProfileSheet } from '../components/Profile/EditProfileSheet';
import { SettingsSheet } from '../components/Profile/SettingsSheet';
import { useApi, User, Link, ContactMeta } from '../lib/api';
import { usePhotoUpload } from '../lib/usePhotoUpload';
import { COLORS, FONTS } from '../constants/colors';

export default function CardScreen() {
  const router = useRouter();
  const api = useApi();

  const [user, setUser] = useState<User | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);

  const [isReordering, setIsReordering] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<Link[]>([]);

  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showLinkEdit, setShowLinkEdit] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showContactCard, setShowContactCard] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameValue, setUsernameValue] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState('');

  const nameInputRef = useRef<TextInput>(null);
  const usernameInputRef = useRef<TextInput>(null);
  const bioInputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    try {
      const [u, ls] = await Promise.all([api.getMe(), api.getMyLinks()]);
      setUser(u);
      setLinks(ls);
      setNameValue(u.displayName ?? '');
      setUsernameValue(u.username ?? '');
      setBioValue(u.bio ?? '');
    } catch {}
    setLoading(false);
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePhotoSuccess = useCallback((photoUrl: string) => {
    setUser((u) => u ? { ...u, profilePhoto: photoUrl } : u);
  }, []);
  const { pick: pickPhoto, uploading: photoUploading } = usePhotoUpload(handlePhotoSuccess);

  const saveNameBio = async (name: string, bio: string) => {
    if (!user) return;
    try {
      const updated = await api.updateMe({ displayName: name, bio });
      setUser(updated);
    } catch {}
  };

  const handleUsernameChange = (v: string) => {
    const cleaned = v.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setUsernameValue(cleaned);
    setUsernameAvailable(null);
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    if (!cleaned || cleaned === user?.username) return;
    if (!/^[a-z0-9_-]{3,30}$/.test(cleaned)) { setUsernameAvailable(false); return; }
    usernameCheckTimer.current = setTimeout(async () => {
      try {
        const { available } = await api.checkUsername(cleaned);
        setUsernameAvailable(available);
      } catch {}
    }, 500);
  };

  const saveUsername = async (value: string) => {
    const cleaned = value.toLowerCase().trim();
    if (!cleaned || cleaned === user?.username) return;
    if (!/^[a-z0-9_-]{3,30}$/.test(cleaned)) {
      setUsernameValue(user?.username ?? '');
      return;
    }
    try {
      const updated = await api.updateMe({ username: cleaned });
      setUser(updated);
      setUsernameValue(updated.username ?? cleaned);
    } catch {
      setUsernameValue(user?.username ?? '');
    }
  };

  const openLinkEdit = (link: Link | null) => {
    setEditingLink(link);
    setShowLinkEdit(true);
  };

  const handleSaveLink = async (data: { title: string; url: string; goLiveAt: string | null; expiresAt: string | null }) => {
    if (editingLink) {
      const updated = await api.updateLink(editingLink.id, data);
      setLinks((ls) => ls.map((l) => l.id === updated.id ? updated : l));
    } else {
      const created = await api.addLink({ title: data.title, url: data.url });
      const withSchedule = data.goLiveAt || data.expiresAt
        ? await api.updateLink(created.id, { goLiveAt: data.goLiveAt, expiresAt: data.expiresAt })
        : created;
      setLinks((ls) => [...ls, withSchedule]);
    }
  };

  const handleDeleteLink = async () => {
    if (!editingLink) return;
    await api.deleteLink(editingLink.id);
    setLinks((ls) => ls.filter((l) => l.id !== editingLink.id));
  };

  const enterReorder = () => {
    setPendingOrder([...links]);
    setIsReordering(true);
  };

  const moveLink = (index: number, direction: 'up' | 'down') => {
    const next = [...pendingOrder];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setPendingOrder(next);
  };

  const finishReorder = async () => {
    const items = pendingOrder.map((l, i) => ({ id: l.id, order: i }));
    const reordered = pendingOrder.map((l, i) => ({ ...l, order: i }));
    setLinks(reordered);
    setIsReordering(false);
    await api.reorderLinks(items).catch(() => {});
  };

  const existingContactCard = links.find((l) => l.type === 'contact_card') ?? null;

  const handlePressAdd = () => {
    if (existingContactCard) {
      openLinkEdit(null);
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Add Link', 'Add Contact Card'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) openLinkEdit(null);
          if (idx === 2) setShowContactCard(true);
        }
      );
    } else {
      Alert.alert('Add to card', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add Link', onPress: () => openLinkEdit(null) },
        { text: 'Add Contact Card', onPress: () => setShowContactCard(true) },
      ]);
    }
  };

  const handleSaveContactCard = async (meta: ContactMeta) => {
    const payload = JSON.stringify(meta);
    if (existingContactCard) {
      const updated = await api.updateLink(existingContactCard.id, { metadata: payload });
      setLinks((ls) => ls.map((l) => l.id === updated.id ? updated : l));
    } else {
      const created = await api.addLink({
        title: 'Contact Card',
        url: 'contact://card',
        type: 'contact_card',
        metadata: payload,
      });
      setLinks((ls) => [...ls, created]);
    }
  };

  const displayList = isReordering ? pendingOrder : links;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => setShowShare(true)}>
          <Ionicons name="share-outline" size={20} color={COLORS.text} />
        </Pressable>
        {isReordering ? (
          <Pressable style={styles.doneBtn} onPress={finishReorder}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        ) : (
          <View style={styles.topRight}>
            <Pressable style={styles.iconBtn} onPress={() => router.push('/theme')}>
              <Ionicons name="create-outline" size={20} color={COLORS.text} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => setShowSettings(true)}>
              <Ionicons name="settings-outline" size={20} color={COLORS.text} />
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Pressable onPress={pickPhoto} disabled={photoUploading} style={styles.avatarWrapper}>
            {user?.profilePhoto ? (
              <Image source={{ uri: user.profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>{user?.displayName?.[0]?.toUpperCase() ?? '+'}</Text>
              </View>
            )}
            {photoUploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </Pressable>

          {editingName ? (
            <TextInput
              ref={nameInputRef}
              style={styles.nameInput}
              value={nameValue}
              onChangeText={setNameValue}
              onBlur={() => { setEditingName(false); saveNameBio(nameValue, bioValue); }}
              textAlign="center"
            />
          ) : (
            <Pressable
              onPress={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 100); }}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              <Text style={styles.name}>{nameValue || 'Your Name'}</Text>
            </Pressable>
          )}

          {editingUsername ? (
            <View style={styles.usernameInputRow}>
              <Text style={styles.usernameAt}>@</Text>
              <TextInput
                ref={usernameInputRef}
                style={styles.usernameInput}
                value={usernameValue}
                onChangeText={handleUsernameChange}
                onBlur={() => { setEditingUsername(false); setUsernameAvailable(null); saveUsername(usernameValue); }}
                autoCapitalize="none"
                autoCorrect={false}
                textAlign="left"
              />
              {usernameValue.length >= 3 && usernameValue !== user?.username && (
                <Text style={usernameAvailable === true ? styles.usernameCheck : usernameAvailable === false ? styles.usernameX : styles.usernameChecking}>
                  {usernameAvailable === true ? '✓' : usernameAvailable === false ? '✗' : '…'}
                </Text>
              )}
            </View>
          ) : (
            <Pressable
              onPress={() => { setEditingUsername(true); setTimeout(() => usernameInputRef.current?.focus(), 100); }}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              <Text style={styles.username}>{usernameValue ? `@${usernameValue}` : 'Tap to set username'}</Text>
            </Pressable>
          )}

          {editingBio ? (
            <TextInput
              ref={bioInputRef}
              style={styles.bioInput}
              value={bioValue}
              onChangeText={setBioValue}
              onBlur={() => { setEditingBio(false); saveNameBio(nameValue, bioValue); }}
              multiline
              textAlign="center"
              placeholder="Add a bio…"
              placeholderTextColor={COLORS.textTertiary}
            />
          ) : (
            <Pressable
              onPress={() => { setEditingBio(true); setTimeout(() => bioInputRef.current?.focus(), 100); }}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              <Text style={[styles.bio, !bioValue && styles.bioPlaceholder]}>
                {bioValue || 'Tap to add a bio'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Links */}
        <View style={styles.links}>
          {displayList.map((link, index) => (
            <LinkRow
              key={link.id}
              link={link}
              isReordering={isReordering}
              isFirst={index === 0}
              isLast={index === displayList.length - 1}
              onEdit={() => openLinkEdit(link)}
              onDelete={async () => {
                await api.deleteLink(link.id);
                setLinks((ls) => ls.filter((l) => l.id !== link.id));
              }}
              onMoveUp={() => moveLink(index, 'up')}
              onMoveDown={() => moveLink(index, 'down')}
              onLongPress={enterReorder}
            />
          ))}

          {!isReordering && (
            <Pressable style={styles.addLinkBtn} onPress={handlePressAdd}>
              <Text style={styles.addLinkText}>+</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <ShareSheet visible={showShare} username={user?.username ?? ''} onClose={() => setShowShare(false)} />
      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onEditProfile={() => setShowEditProfile(true)}
        onShowPaywall={() => setShowPaywall(true)}
      />
      <EditProfileSheet
        visible={showEditProfile}
        user={user}
        onClose={() => setShowEditProfile(false)}
        onSaved={(updated) => { setUser(updated); setNameValue(updated.displayName ?? ''); setBioValue(updated.bio ?? ''); }}
      />
      <LinkEditSheet
        visible={showLinkEdit}
        link={editingLink}
        onClose={() => { setShowLinkEdit(false); setEditingLink(null); }}
        onSave={handleSaveLink}
        onDelete={editingLink ? handleDeleteLink : undefined}
      />
      <PaywallSheet visible={showPaywall} onClose={() => setShowPaywall(false)} />
      <ContactCardSheet
        visible={showContactCard}
        existing={existingContactCard ? (() => { try { return JSON.parse(existingContactCard.metadata ?? '{}'); } catch { return null; } })() : null}
        onClose={() => setShowContactCard(false)}
        onSave={handleSaveContactCard}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22,22,24,0.9)', borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  topRight: { flexDirection: 'row', gap: 8 },
  doneBtn: { height: 32, paddingHorizontal: 14, backgroundColor: COLORS.accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontSize: 12, fontFamily: FONTS.semiBold, color: '#0C0C0E' },
  content: { gap: 16, paddingBottom: 60 },
  hero: { alignItems: 'center', gap: 10, paddingTop: 22, paddingHorizontal: 18, paddingBottom: 18, backgroundColor: '#1A1510' },
  avatarWrapper: { position: 'relative', marginTop: 10 },
  avatar: { width: 80, height: 80, borderRadius: 26, borderWidth: 2, borderColor: COLORS.accent },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 26,
    backgroundColor: 'rgba(201,151,58,0.12)', borderWidth: 2, borderColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 }, shadowRadius: 24, shadowOpacity: 0.12,
  },
  avatarPlaceholderText: { fontSize: 33, fontFamily: FONTS.semiBold, color: COLORS.accent },
  avatarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  nameInput: { fontSize: 20, fontFamily: FONTS.semiBold, color: COLORS.text, textAlign: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.accent, minWidth: 160 },
  name: { fontSize: 20, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: -0.025 * 20 },
  username: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  usernameInputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  usernameAt: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  usernameInput: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, minWidth: 100, paddingVertical: 2 },
  usernameCheck: { fontSize: 13, color: '#22c55e', marginLeft: 6 },
  usernameX: { fontSize: 13, color: '#ef4444', marginLeft: 6 },
  usernameChecking: { fontSize: 13, color: COLORS.textTertiary, marginLeft: 6 },
  bioInput: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 280, minWidth: 160, minHeight: 40, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  bio: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 16 },
  bioPlaceholder: { color: COLORS.textTertiary },
  links: { gap: 8, paddingHorizontal: 18 },
  addLinkBtn: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5, borderColor: 'rgba(201,151,58,0.4)', borderStyle: 'dashed',
    backgroundColor: COLORS.accentDim,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
  },
  addLinkText: { fontSize: 22, fontFamily: FONTS.light, color: COLORS.accent, lineHeight: 26 },
});
