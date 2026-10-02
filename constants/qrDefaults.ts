import { COLORS } from './colors';

// Linkd-branded QR defaults: gold code on black with the Linkd mark in the
// middle. Used whenever a card / saved QR has no custom value of its own.
export const QR_DEFAULT_COLOR: string = COLORS.accent;
export const QR_DEFAULT_BG_COLOR: string = '#000000';
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const QR_DEFAULT_LOGO = require('../assets/qr-logo.png');
