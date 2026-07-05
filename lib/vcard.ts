import { Card, CardField, User } from './api';

// Client-side vCard 3.0 builder — powers the offline QR (vCard embedded in the
// QR itself, so scanning pops a native "Add to Contacts" card with no internet)
// and the AirDrop .vcf share.

function esc(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function profileUrl(type: string, value: string): string {
  const v = value.trim();
  if (v.startsWith('http')) return v;
  const handle = v.replace(/^@/, '');
  switch (type) {
    case 'instagram': return `https://instagram.com/${handle}`;
    case 'twitter':   return `https://x.com/${handle}`;
    case 'linkedin':  return `https://linkedin.com/in/${handle}`;
    case 'tiktok':    return `https://tiktok.com/@${handle}`;
    case 'youtube':   return `https://youtube.com/@${handle}`;
    case 'facebook':  return `https://facebook.com/${handle}`;
    case 'spotify':   return `https://open.spotify.com/user/${handle}`;
    case 'venmo':      return `https://venmo.com/${handle}`;
    case 'telegram':   return `https://t.me/${handle}`;
    case 'discord':    return v;
    case 'soundcloud': return `https://soundcloud.com/${handle}`;
    case 'vimeo':      return `https://vimeo.com/${handle}`;
    case 'twitch':     return `https://twitch.tv/${handle}`;
    case 'behance':    return `https://behance.net/${handle}`;
    case 'dribbble':   return `https://dribbble.com/${handle}`;
    case 'github':     return `https://github.com/${handle}`;
    case 'snapchat':   return `https://snapchat.com/add/${handle}`;
    case 'pinterest':  return `https://pinterest.com/${handle}`;
    case 'threads':    return `https://threads.net/@${handle}`;
    case 'calendly':   return v.includes('calendly.com') ? v : `https://calendly.com/${handle}`;
    case 'cal':        return v.includes('cal.com') ? v : `https://cal.com/${handle}`;
    case 'acuity':     return (v.includes('acuityscheduling.com') || v.includes('as.me')) ? v : `https://${handle}.as.me`;
    case 'booksy':     return v.includes('booksy.com') ? v : `https://booksy.com/en-us/${handle}`;
    case 'patreon':    return v.includes('patreon.com') ? v : `https://patreon.com/${handle}`;
    default:          return v;
  }
}

const SOCIAL_TYPES = new Set([
  'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube', 'facebook', 'spotify',
  'venmo', 'telegram', 'discord', 'soundcloud', 'vimeo', 'twitch', 'behance',
  'dribbble', 'github', 'snapchat', 'pinterest', 'threads', 'calendly', 'cal', 'acuity', 'booksy', 'patreon',
]);
const MAX_QR_SOCIALS = 3; // QR readability degrades past ~1-1.5KB of payload

export interface VcardOptions {
  /** Compact payload for embedding in a QR: skips PHOTO/NOTE, caps socials */
  compact?: boolean;
}

export function buildVcard(card: Card, user: User | null, publicUrl: string, opts: VcardOptions = {}): string {
  const { compact = false } = opts;
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  const fullName = user?.displayName ?? user?.username ?? card.name;
  const nameParts = fullName.trim().split(/\s+/);
  const first = nameParts[0] ?? '';
  const last = nameParts.slice(1).join(' ');
  lines.push(`FN:${esc(fullName)}`);
  lines.push(`N:${esc(last)};${esc(first)};;;`);

  let company = '';
  let department = '';
  const notes: string[] = [];
  let socialCount = 0;

  for (const field of card.fields as CardField[]) {
    const value = field.value.trim();
    if (!value) continue;
    switch (field.type) {
      case 'email':
        lines.push(`EMAIL;TYPE=INTERNET;TYPE=WORK:${esc(value)}`);
        break;
      case 'phone':
        lines.push(`TEL;TYPE=CELL:${esc(value)}`);
        break;
      case 'whatsapp':
        lines.push(`TEL;TYPE=CELL:${esc(value)}`);
        lines.push(`X-SOCIALPROFILE;TYPE=whatsapp:https://wa.me/${value.replace(/\D/g, '')}`);
        break;
      case 'website':
        lines.push(`URL:${esc(value)}`);
        break;
      case 'title':
        lines.push(`TITLE:${esc(value)}`);
        break;
      case 'company':
        company = value;
        break;
      case 'department':
        department = value;
        break;
      case 'headline':
        notes.push(value);
        break;
      case 'custom':
        notes.push(`${field.label ?? 'Info'}: ${value}`);
        break;
      case 'address':
        lines.push(`ADR;TYPE=WORK:;;${esc(value)};;;;`);
        break;
      default:
        if (SOCIAL_TYPES.has(field.type)) {
          if (compact && socialCount >= MAX_QR_SOCIALS) break;
          socialCount += 1;
          lines.push(`X-SOCIALPROFILE;TYPE=${field.type}:${profileUrl(field.type, value)}`);
        }
        break;
    }
  }

  if (company || department) {
    lines.push(`ORG:${esc(company)}${department ? `;${esc(department)}` : ''}`);
  }
  if (!compact && notes.length > 0) {
    lines.push(`NOTE:${esc(notes.join('\n'))}`);
  }
  if (!compact && user?.profilePhoto) {
    lines.push(`PHOTO;VALUE=URI:${user.profilePhoto}`);
  }
  lines.push(`URL;TYPE=Linkd:${publicUrl}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/** Maps a card to an expo-contacts Contact shape for the native contact-form preview. */
export function contactFromCard(card: Card, user: User | null, publicUrl: string): any {
  const fullName = user?.displayName ?? user?.username ?? card.name;
  const nameParts = fullName.trim().split(/\s+/);

  const emails: any[] = [];
  const phones: any[] = [];
  const urls: any[] = [{ label: 'Linkd', url: publicUrl }];
  const addresses: any[] = [];
  let company = '';
  let department = '';
  let jobTitle = '';

  for (const field of card.fields as CardField[]) {
    const value = field.value.trim();
    if (!value) continue;
    switch (field.type) {
      case 'email':    emails.push({ label: 'work', email: value }); break;
      case 'phone':
      case 'whatsapp': phones.push({ label: 'mobile', number: value }); break;
      case 'website':  urls.push({ label: 'website', url: value }); break;
      case 'title':    jobTitle = value; break;
      case 'company':  company = value; break;
      case 'department': department = value; break;
      case 'address':  addresses.push({ label: 'work', street: value }); break;
      default:
        if (SOCIAL_TYPES.has(field.type)) {
          urls.push({ label: field.type, url: profileUrl(field.type, value) });
        }
        break;
    }
  }

  return {
    contactType: 'person',
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' '),
    company,
    department,
    jobTitle,
    emails,
    phoneNumbers: phones,
    urlAddresses: urls,
    addresses,
  };
}
