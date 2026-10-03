import { COLORS } from './colors';

// Linkd-branded QR defaults: black code on gold with the Linkd mark in the
// middle. Dark-on-light on purpose — light-on-dark ("inverted") QR codes read
// on iPhone but fail on many Android scanners. Used whenever a card / saved QR
// has no custom value of its own.
export const QR_DEFAULT_COLOR: string = '#000000';
export const QR_DEFAULT_BG_COLOR: string = COLORS.accent;
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const QR_DEFAULT_LOGO = require('../assets/qr-logo.png');
