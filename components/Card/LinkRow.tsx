import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

interface Props {
  link: Link;
  isReordering: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function LinkRow({ link, isReordering, isFirst, isLast, onEdit, onDelete, onMoveUp, onMoveDown }: Props) {
  const isScheduled = link.goLiveAt && new Date(link.goLiveAt) > new Date();

  const handlePress = () => {
    if (isReordering) return;
    Linking.openURL(link.url).catch(() => {});
  };

  const handleLongPress = () => {
    if (isReordering) return;
    Alert.alert(link.title, undefined, [
      { text: 'Edit', onPress: onEdit },
      { text: 'Delete', style: 'destructive', onPress: () => {
        Alert.alert('Delete Link', `Delete "${link.title}"?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ]);
      }},
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && !isReordering && styles.rowPressed]}
      onPress={handlePress}
      onLongPress={handleLongPress}
    >
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{link.title}</Text>
        <Text style={styles.url} numberOfLines={1}>{link.url}</Text>
      </View>

      {isScheduled && !isReordering && (
        <Text style={styles.scheduledBadge}>Scheduled</Text>
      )}

      {!isReordering && <Text style={styles.chevron}>›</Text>}

      {isReordering && (
        <View style={styles.arrows}>
          <Pressable
            style={[styles.arrowBtn, isFirst && styles.arrowDisabled]}
            onPress={isFirst ? undefined : onMoveUp}
          >
            <Text style={[styles.arrowText, isFirst && styles.arrowTextDisabled]}>↑</Text>
          </Pressable>
          <Pressable
            style={[styles.arrowBtn, isLast && styles.arrowDisabled]}
            onPress={isLast ? undefined : onMoveDown}
          >
            <Text style={[styles.arrowText, isLast && styles.arrowTextDisabled]}>↓</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  rowPressed: { opacity: 0.7 },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text },
  url: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  scheduledBadge: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chevron: { fontSize: 20, color: COLORS.textSecondary, fontWeight: '300' },
  arrows: { flexDirection: 'row', gap: 4 },
  arrowBtn: {
    width: 32,
    height: 32,
    backgroundColor: COLORS.surface2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { fontSize: 16, color: COLORS.text },
  arrowTextDisabled: { color: COLORS.textSecondary },
});
