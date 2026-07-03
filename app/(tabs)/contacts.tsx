import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContactDetailSheet } from '../../components/Contacts/ContactDetailSheet';
import { ContactReviewSheet } from '../../components/Contacts/ContactReviewSheet';
import { useApi, Contact } from '../../lib/api';
import { loadContactsCache, saveContactsCache } from '../../lib/cache';
import { COLORS, FONTS } from '../../constants/colors';

function getInitials(c: Contact): string {
  const f = c.firstName?.[0] ?? '';
  const l = c.lastName?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
}

function getDisplayName(c: Contact): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown';
}

export default function ContactsScreen() {
  const api = useApi();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const hydratedRef = useRef(false);

  const fetchFresh = useCallback(async () => {
    try {
      const data = await api.getMyContacts();
      setContacts(data);
      saveContactsCache(data);
    } catch {} // offline — cached data (if any) stays on screen
  }, [api]);

  const load = useCallback(async () => {
    // Hydrate from disk once per mount so contacts are viewable offline
    if (!hydratedRef.current) {
      hydratedRef.current = true;
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
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Contacts</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={22} color={COLORS.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.list, contacts.length === 0 && styles.listEmpty]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No contacts yet</Text>
              <Text style={styles.emptySub}>Scan a business card to add your first contact</Text>
            </View>
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
      />

      <ContactReviewSheet
        visible={showAdd}
        initial={null}
        onClose={() => setShowAdd(false)}
        onSave={handleAddContact}
        title="Add Contact"
      />
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
  addBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.text },
  emptySub: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  listEmpty: { flex: 1 },
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
