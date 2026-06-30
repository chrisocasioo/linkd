import * as Contacts from 'expo-contacts';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { ShareSheet } from '../components/Card/ShareSheet';
import { PaywallSheet } from '../components/Card/PaywallSheet';
import { EditProfileSheet } from '../components/Profile/EditProfileSheet';
import { SettingsSheet } from '../components/Profile/SettingsSheet';
import { useApi, User, Link } from '../lib/api';
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

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState('');

  const nameInputRef = useRef<TextInput>(null);
  const bioInputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    try {
      const [u, ls] = await Promise.all([api.getMe(), api.getMyLinks()]);
      setUser(u);
      setLinks(ls);
      setNameValue(u.displayName ?? '');
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

  const handleAddToContacts = async () => {
    if (!user) return;
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission denied');
    const contact = {
      firstName: user.displayName?.split(' ')[0] ?? '',
      lastName: user.displayName?.split(' ').slice(1).join(' ') ?? '',
      emails: [{ email: user.email, label: 'work', id: '' }],
      note: user.bio ?? '',
      imageAvailable: false,
      urls: user.username ? [{ url: `https://linkd.tattoo/${user.username}`, label: 'Linkd', id: '' }] : [],
    };
    await Contacts.addContactAsync(contact as any);
    Alert.alert('Saved', 'Contact added to your address book.');
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
          <Text style={styles.iconBtnText}>⬆</Text>
        </Pressable>
        {isReordering ? (
          <Pressable style={styles.doneBtn} onPress={finishReorder}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        ) : (
          <View style={styles.topRight}>
            <Pressable style={styles.iconBtn} onPress={() => router.push('/theme')}>
              <Text style={styles.iconBtnText}>✎</Text>
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => setShowSettings(true)}>
              <Text style={styles.iconBtnText}>⚙</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={styles.hero}>
          <Pressable onPress={pickPhoto} disabled={photoUploading} style={styles.avatarWrapper}>
            {user?.profilePhoto ? (
              <Image source={{ uri: user.profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>+</Text>
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
              autoFocus
              textAlign="center"
            />
          ) : (
            <Pressable onPress={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 50); }}>
              <Text style={styles.name}>{nameValue || 'Your Name'}</Text>
            </Pressable>
          )}

          {user?.username && (
            <Text style={styles.username}>@{user.username}</Text>
          )}

          {editingBio ? (
            <TextInput
              ref={bioInputRef}
              style={styles.bioInput}
              value={bioValue}
              onChangeText={setBioValue}
              onBlur={() => { setEditingBio(false); saveNameBio(nameValue, bioValue); }}
              autoFocus
              multiline
              textAlign="center"
              placeholder="Add a bio…"
              placeholderTextColor={COLORS.textTertiary}
            />
          ) : (
            <Pressable onPress={() => { setEditingBio(true); setTimeout(() => bioInputRef.current?.focus(), 50); }}>
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
            />
          ))}

          {!isReordering && (
            <>
              <Pressable style={styles.contactsRow} onPress={handleAddToContacts}>
                <Text style={styles.contactsText}>+ Add to Contacts</Text>
              </Pressable>

              <Pressable style={styles.addLinkBtn} onPress={() => openLinkEdit(null)}>
                <Text style={styles.addLinkText}>+ Add Link</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <ShareSheet visible={showShare} username={user?.username ?? ''} onClose={() => setShowShare(false)} />
      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onEditProfile={() => setShowEditProfile(true)}
        onReorderLinks={enterReorder}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  iconBtnText: { fontSize: 16, color: COLORS.text },
  topRight: { flexDirection: 'row', gap: 8 },
  doneBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.accent, borderRadius: 12 },
  doneBtnText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#fff' },
  content: { padding: 20, paddingTop: 4, gap: 24, paddingBottom: 60 },
  hero: { alignItems: 'center', gap: 8 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: COLORS.accent },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.surface, borderWidth: 3, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderText: { fontSize: 32, color: COLORS.textSecondary },
  avatarOverlay: { position: 'absolute', inset: 0, borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  nameInput: { fontSize: 24, fontFamily: FONTS.semiBold, color: COLORS.text, textAlign: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.accent, minWidth: 160 },
  name: { fontSize: 24, fontFamily: FONTS.semiBold, color: COLORS.text },
  username: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  bioInput: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 280, borderBottomWidth: 1, borderBottomColor: COLORS.border, minWidth: 160 },
  bio: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 280 },
  bioPlaceholder: { color: COLORS.textTertiary },
  links: { gap: 10 },
  contactsRow: { height: 52, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  contactsText: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text },
  addLinkBtn: { height: 52, borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addLinkText: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.textSecondary },
});
