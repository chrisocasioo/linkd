import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, CardField, User } from '../../lib/api';
import { FONTS } from '../../constants/colors';

const FIELD_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  email:     'mail',
  phone:     'call',
  website:   'globe-outline',
  instagram: 'logo-instagram',
  twitter:   'logo-twitter',
  linkedin:  'logo-linkedin',
  tiktok:    'logo-tiktok',
  youtube:   'logo-youtube',
  title:      'briefcase-outline',
  company:    'business-outline',
  facebook:   'logo-facebook',
  whatsapp:   'logo-whatsapp',
  spotify:    'musical-notes-outline',
  department: 'people-outline',
  headline:   'document-text-outline',
  custom:     'ellipsis-horizontal',
};

function fieldUrl(field: CardField): string {
  const v = field.value.trim();
  switch (field.type) {
    case 'email':     return `mailto:${v}`;
    case 'phone':     return `tel:${v}`;
    case 'instagram': return `https://instagram.com/${v.replace('@', '')}`;
    case 'twitter':   return `https://twitter.com/${v.replace('@', '')}`;
    case 'linkedin':  return `https://linkedin.com/in/${v.replace('@', '')}`;
    case 'tiktok':    return `https://tiktok.com/@${v.replace('@', '')}`;
    case 'youtube':   return `https://youtube.com/@${v.replace('@', '')}`;
    case 'facebook':   return `https://facebook.com/${v.replace('@', '')}`;
    case 'whatsapp':   return `https://wa.me/${v.replace(/\D/g, '')}`;
    case 'spotify':    return `https://open.spotify.com/user/${v.replace('@', '')}`;
    case 'title':
    case 'company':
    case 'department':
    case 'headline':   return '';
    default:           return v.startsWith('http') ? v : `https://${v}`;
  }
}

function fieldDisplayValue(field: CardField): string {
  return field.label ?? field.value;
}

interface Props {
  card: Card;
  user: User;
  onEditField: (field: CardField) => void;
  onAddField: () => void;
}

export function CardPreview({ card, user, onEditField, onAddField }: Props) {
  const accent = card.accentColor;
  const initial = (user.displayName ?? user.username ?? '?')[0].toUpperCase();

  return (
    <View style={styles.card}>
      {/* Banner */}
      <View style={styles.banner}>
        {user.profilePhoto ? (
          <Image source={{ uri: user.profilePhoto }} style={styles.bannerImg} />
        ) : (
          <View style={[styles.bannerPlaceholder, { backgroundColor: accent + '22' }]}>
            <Text style={[styles.bannerInitial, { color: accent }]}>{initial}</Text>
          </View>
        )}
        <View style={styles.labelPill}>
          <Text style={styles.labelText}>{card.name.toUpperCase()}</Text>
        </View>
      </View>

      {/* Identity */}
      <View style={styles.identity}>
        <Text style={styles.name}>{user.displayName ?? user.username ?? ''}</Text>
        {(() => {
          const title = card.fields.find(f => f.type === 'title')?.value;
          const company = card.fields.find(f => f.type === 'company')?.value;
          return (
            <>
              {title ? <Text style={styles.jobTitle}>{title}</Text> : null}
              {company ? <Text style={styles.company}>{company}</Text> : null}
            </>
          );
        })()}
      </View>

      {/* Fields */}
      <View style={styles.fields}>
        {card.fields.filter(f => !['title', 'company', 'department', 'headline'].includes(f.type)).map((field) => (
          <Pressable
            key={field.id}
            style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed]}
            onPress={() => { const url = fieldUrl(field); if (url) Linking.openURL(url).catch(() => {}); }}
            onLongPress={() => onEditField(field)}
            delayLongPress={400}
          >
            <View style={[styles.fieldIcon, { backgroundColor: accent }]}>
              <Ionicons
                name={FIELD_ICONS[field.type] ?? FIELD_ICONS.custom}
                size={16}
                color="#fff"
              />
            </View>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {fieldDisplayValue(field)}
            </Text>
          </Pressable>
        ))}

        {/* Add field row */}
        <Pressable
          style={({ pressed }) => [styles.fieldRow, styles.addFieldRow, pressed && styles.fieldRowPressed]}
          onPress={onAddField}
        >
          <View style={[styles.fieldIcon, { backgroundColor: accent + '33', borderWidth: 1.5, borderColor: accent, borderStyle: 'dashed' }]}>
            <Ionicons name="add" size={16} color={accent} />
          </View>
          <Text style={[styles.fieldValue, { color: accent, opacity: 0.8 }]}>Add field</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161616',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  banner: {
    width: '100%',
    height: 190,
    position: 'relative',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerInitial: {
    fontSize: 64,
    fontFamily: FONTS.semiBold,
  },
  labelPill: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  labelText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    letterSpacing: 1.2,
  },
  identity: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  name: {
    fontSize: 20,
    fontFamily: FONTS.semiBold,
    color: '#fff',
    letterSpacing: -0.3,
  },
  jobTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 3,
  },
  company: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
  fields: {
    paddingBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  fieldRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  addFieldRow: {
    opacity: 0.7,
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: '#fff',
  },
});
