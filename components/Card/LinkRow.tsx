import React, { useRef } from 'react';
import {
  Animated,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from '../../lib/api';
import { COLORS, FONTS } from '../../constants/colors';

const ACTION_WIDTH = 140;

interface Props {
  link: Link;
  isReordering: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onLongPress: () => void;
}

export function LinkRow({ link, isReordering, isFirst, isLast, onEdit, onDelete, onMoveUp, onMoveDown, onLongPress }: Props) {
  const isContactCard = link.type === 'contact_card';
  const isScheduled = !isContactCard && link.goLiveAt && new Date(link.goLiveAt) > new Date();
  const swipeX = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);       // committed position (0 or -ACTION_WIDTH)
  const startOffsetRef = useRef(0);  // position at gesture start
  const isReorderingRef = useRef(isReordering);

  // Keep ref fresh so the PanResponder closure always sees the current value
  React.useEffect(() => { isReorderingRef.current = isReordering; }, [isReordering]);

  const snapClose = () => {
    Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
    offsetRef.current = 0;
  };

  const snapOpen = () => {
    Animated.spring(swipeX, { toValue: -ACTION_WIDTH, useNativeDriver: true, tension: 120, friction: 10 }).start();
    offsetRef.current = -ACTION_WIDTH;
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      !isReorderingRef.current &&
      Math.abs(g.dx) > Math.abs(g.dy) * 1.5 &&
      Math.abs(g.dx) > 8,
    onPanResponderGrant: () => {
      startOffsetRef.current = offsetRef.current;
    },
    onPanResponderMove: (_, g) => {
      const next = Math.min(0, Math.max(-ACTION_WIDTH, startOffsetRef.current + g.dx));
      swipeX.setValue(next);
    },
    onPanResponderRelease: (_, g) => {
      const endVal = startOffsetRef.current + g.dx;
      if (endVal < -(ACTION_WIDTH / 2)) {
        snapOpen();
      } else {
        snapClose();
      }
    },
    onPanResponderTerminate: () => {
      // ScrollView or another responder stole the gesture — snap back cleanly
      snapClose();
    },
    onShouldBlockNativeResponder: () => true,
  })).current;

  const handlePress = () => {
    if (isReordering) return;
    if (offsetRef.current !== 0) { snapClose(); return; }
    if (isContactCard) return;
    Linking.openURL(link.url).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable style={styles.editAction} onPress={() => { snapClose(); onEdit(); }}>
          <Text style={styles.editActionText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.deleteAction} onPress={() => { snapClose(); onDelete(); }}>
          <Text style={styles.deleteActionText}>Delete</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.row, { transform: [{ translateX: swipeX }] }]}
        {...(isReordering ? {} : panResponder.panHandlers)}
      >
        <Pressable
          style={({ pressed }) => [styles.inner, pressed && !isReordering && styles.rowPressed]}
          onPress={handlePress}
          onLongPress={isReordering ? undefined : onLongPress}
          delayLongPress={400}
        >
          {isContactCard ? (
            <View style={styles.contactCardContent}>
              <Text style={styles.contactCardIcon}>📇</Text>
              <View style={styles.content}>
                <Text style={styles.title} numberOfLines={1}>Contact Card</Text>
                {link.metadata ? (() => {
                  try {
                    const m = JSON.parse(link.metadata);
                    const name = [m.firstName, m.lastName].filter(Boolean).join(' ');
                    const sub = [m.jobTitle, m.company].filter(Boolean).join(' · ');
                    return (name || sub) ? <Text style={styles.url} numberOfLines={1}>{[name, sub].filter(Boolean).join(' — ')}</Text> : null;
                  } catch { return null; }
                })() : null}
              </View>
              {!isReordering && <Text style={[styles.contactCardBadge]}>📲 Save</Text>}
            </View>
          ) : (
            <>
              <View style={styles.content}>
                <Text style={styles.title} numberOfLines={1}>{link.title}</Text>
                <Text style={styles.url} numberOfLines={1}>{link.url}</Text>
              </View>
              {isScheduled && !isReordering && (
                <Text style={styles.scheduledBadge}>Scheduled</Text>
              )}
              {!isReordering && <Text style={styles.chevron}>›</Text>}
            </>
          )}

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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    flexDirection: 'row',
  },
  editAction: {
    flex: 1,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActionText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#000' },
  deleteAction: {
    flex: 1,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionText: { fontSize: 14, fontFamily: FONTS.semiBold, color: '#fff' },
  row: { backgroundColor: COLORS.surface },
  rowPressed: { opacity: 0.7 },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text },
  url: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  contactCardContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactCardIcon: { fontSize: 22 },
  contactCardBadge: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.accent },
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
