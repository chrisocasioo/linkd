import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaywallSheet } from '../../components/Card/PaywallSheet';
import { ContactDetailSheet } from '../../components/Contacts/ContactDetailSheet';
import { ContactReviewSheet } from '../../components/Contacts/ContactReviewSheet';
import { useApi, Contact } from '../../lib/api';
import { loadContactsCache, saveContactsCache } from '../../lib/cache';
import {
  markSyncedToPhone,
  requestContactsPermission,
  saveContactToPhone,
  syncNewContactsToPhone,
} from '../../lib/nativeContacts';
import { useRevenueCat } from '../../lib/RevenueCatContext';
import { COLORS, FONTS } from '../../constants/colors';

function getInitials(c: Contact): string {
  const f = c.firstName?.[0] ?? '';
  const l = c.lastName?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
}

function getDisplayName(c: Contact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown';
}

type FilterKey = 'all' | 'email' | 'phone' | 'missing';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'email', label: 'Has Email' },
  { key: 'phone', label: 'Has Phone' },
  { key: 'missing', label: 'Missing Info' },
];

export default function ContactsScreen() {
  const api = useApi();
  const { isPro } = useRevenueCat();
  const [showPaywall, setShowPaywall] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const hydratedRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sortAz, setSortAz] = useState(false);

  const visibleContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = contacts.filter((c) => {
      if (filter === 'email' && !c.email) return false;
      if (filter === 'phone' && !c.phone) return false;
      if (filter === 'missing' && (c.email || c.phone)) return false;
      if (!q) return true;
      const haystack = [c.firstName, c.lastName, c.company, c.jobTitle, c.email, c.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    if (!sortAz) return filtered;
    return [...filtered].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
  }, [contacts, searchQuery, filter, sortAz]);

  const fetchFresh = useCallback(async () => {
    try {
      const data = await api.getMyContacts();
      setContacts(data);
      saveContactsCache(data);
      // Mirrors contacts created server-side (public-card exchange form)
      syncNewContactsToPhone(data);
    } catch {} // offline — cached data (if any) stays on screen
  }, [api]);

  const load = useCallback(async () => {
    // Hydrate from disk once per mount so contacts are viewable offline
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      // iOS only ever shows the system prompt once, so this is the
      // "first time the contacts page is opened" ask
      requestContactsPermission();
      const cached = await loadContactsCache();
      if (cached) {
        setContacts(cached);
        setLoading(false);
      }
    }
    await fetchFresh();
    setLoading(false);
  }, [fetchFresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFresh();
    setRefreshing(false);
  }, [fetchFresh]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = async (id: string) => {
    await api.deleteContact(id);
    setContacts((cs) => cs.filter((c) => c.id !== id));
  };

  const handleAddContact = async (fields: Partial<Contact>) => {
    const created = await api.addContact(fields);
    setContacts((cs) => [created, ...cs]);
    saveContactToPhone(created).then((written) => {
      if (written) markSyncedToPhone(created.id);
    });
  };

  const handleUpdateContact = async (fields: Partial<Contact>) => {
    if (!editingContact) return;
    // The form omits cleared fields entirely, so send explicit nulls —
    // otherwise the server keeps the old value. Notes aren't on the form
    // (exchange contacts carry one), so leave them untouched.
    const updated = await api.updateContact(editingContact.id, {
      firstName: fields.firstName ?? null,
      lastName: fields.lastName ?? null,
      email: fields.email ?? null,
      phone: fields.phone ?? null,
      fax: fields.fax ?? null,
      company: fields.company ?? null,
      jobTitle: fields.jobTitle ?? null,
      website: fields.website ?? null,
      address: fields.address ?? null,
    });
    setContacts((cs) => {
      const next = cs.map((c) => (c.id === updated.id ? updated : c));
      saveContactsCache(next);
      return next;
    });
  };

  const handleExport = async () => {
    if (!isPro) { setShowPaywall(true); return; }
    if (contacts.length === 0) {
      Alert.alert('Nothing to export', 'Add or scan some contacts first.');
      return;
    }
    try {
      const cell = (v: string | null | undefined) => (v ? `"${v.replace(/"/g, '""')}"` : '');
      const header = 'First Name,Last Name,Email,Phone,Company,Job Title,Website,Address,Notes,Added';
      const rows = contacts.map((c) =>
        [c.firstName, c.lastName, c.email, c.phone, c.company, c.jobTitle, c.website, c.address, c.notes, c.createdAt?.slice(0, 10)]
          .map(cell)
          .join(',')
      );
      const path = `${FileSystem.cacheDirectory}linkd-contacts.csv`;
      await FileSystem.writeAsStringAsync(path, [header, ...rows].join('\n'));
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: 'Export contacts',
      });
    } catch (err: any) {
      Alert.alert('Export failed', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Contacts</Text>
        <View style={styles.topRight}>
          <Pressable style={styles.addBtn} onPress={handleExport}>
            <Ionicons name="download-outline" size={19} color={COLORS.text} />
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Ionicons name="add" size={22} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={visibleContacts}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.list, visibleContacts.length === 0 && styles.listEmpty]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
          ListHeaderComponent={
            contacts.length === 0 ? null : (
              <View style={styles.toolbar}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={16} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search contacts"
                    placeholderTextColor={COLORS.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                  />
                </View>
                <View style={styles.filterRow}>
                  <View style={styles.filterChips}>
                    {FILTERS.map((f) => (
                      <Pressable
                        key={f.key}
                        style={[styles.chip, filter === f.key && styles.chipActive]}
                        onPress={() => setFilter(f.key)}
                      >
                        <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable style={styles.sortBtn} onPress={() => setSortAz((s) => !s)}>
                    <Ionicons name="swap-vertical" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.sortBtnText}>{sortAz ? 'A–Z' : 'Recent'}</Text>
                  </Pressable>
                </View>
              </View>
            )
          }
          ListEmptyComponent={
            contacts.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color={COLORS.border} />
                <Text style={styles.emptyTitle}>No contacts yet</Text>
                <Text style={styles.emptySub}>Scan a business card to add your first contact</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="search" size={40} color={COLORS.border} />
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptySub}>Try a different search or filter</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => { setSelectedContact(item); setShowDetail(true); }}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(item)}</Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowName}>{getDisplayName(item)}</Text>
                {(item.company || item.jobTitle) && (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {[item.jobTitle, item.company].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </Pressable>
          )}
        />
      )}

      <ContactDetailSheet
        visible={showDetail}
        contact={selectedContact}
        onClose={() => { setShowDetail(false); setSelectedContact(null); }}
        onDelete={handleDelete}
        onEdit={(c) => { setShowDetail(false); setSelectedContact(null); setEditingContact(c); }}
      />

      <ContactReviewSheet
        visible={showAdd}
        initial={null}
        onClose={() => setShowAdd(false)}
        onSave={handleAddContact}
        title="Add Contact"
      />

      <ContactReviewSheet
        visible={!!editingContact}
        initial={editingContact}
        onClose={() => setEditingContact(null)}
        onSave={handleUpdateContact}
        title="Edit Contact"
      />

      <PaywallSheet visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
  },
  heading: { fontSize: 22, fontFamily: FONTS.semiBold, color: COLORS.text },
  topRight: { flexDirection: 'row', gap: 8 },
  addBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text },
  emptySub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  listEmpty: { flex: 1 },
  toolbar: { gap: 10, marginBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.text, padding: 0 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  filterChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
  chipText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.accent, fontFamily: FONTS.semiBold },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  sortBtnText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 70 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  rowPressed: { opacity: 0.7 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.accent },
  rowContent: { flex: 1 },
  rowName: { fontSize: 15, fontFamily: FONTS.semiBold, color: COLORS.text },
  rowSub: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },
});
