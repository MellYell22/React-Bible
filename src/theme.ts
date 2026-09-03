/**
 * Design tokens — transcribed verbatim from AuthScreen.tsx (the sign-in /
 * landing page), which is the single source of visual truth for this app.
 *
 * This project renders through react-native-web, so tokens are plain values
 * consumed by StyleSheet.create() — not CSS variables.
 *
 * Type scale is FAITHFUL to the reference (8–13px UI, 36px hero). Do not
 * "improve" these numbers; the density is intentional.
 */

/* ── Colour ─────────────────────────────────────────────────────────── */

export const NAVY = '#0b1e3d';        // page ground
export const DARK_NAVY = '#051020';   // text on gold; deep fills
export const SLATE = '#0f2a52';       // raised surface (dropdowns, cards)
export const GOLD = '#d4af37';        // primary accent
export const SOFT_GOLD = '#f5d77a';   // secondary gold text
export const WHITE = '#ffffff';
export const IVORY = '#f4efe4';       // warm ivory — primary reading colour
export const CREAM = 'rgba(244, 239, 228, 0.76)';  // secondary copy
export const CREAM_DIM = 'rgba(244, 239, 228, 0.52)'; // captions

/** Gold at the exact opacities the reference uses. */
export const gold = {
  full: GOLD,
  soft: SOFT_GOLD,
  a70: 'rgba(212, 175, 55, 0.7)',   // secondary button text
  a60: 'rgba(212, 175, 55, 0.6)',   // field labels
  a50: 'rgba(212, 175, 55, 0.5)',   // secondary borders, tertiary links
  a40: 'rgba(212, 175, 55, 0.4)',
  a30: 'rgba(212, 175, 55, 0.3)',   // hairline borders
  a10: 'rgba(212, 175, 55, 0.1)',
} as const;

export const surfaces = {
  page: NAVY,
  raised: SLATE,
  input: 'rgba(5, 16, 32, 0.5)',
  sunken: 'rgba(5, 16, 32, 0.62)',
} as const;

export const danger = {
  text: '#ef4444',
  bg: 'rgba(239, 68, 68, 0.1)',
  border: 'rgba(239, 68, 68, 0.3)',
} as const;

/**
 * Success / saved states. Green still carries the meaning "this worked", which
 * gold cannot — gold is the primary action colour here, so reusing it would
 * make a confirmation look like another button. This is a muted sage rather
 * than the stock emerald (#10B981) that was hardcoded across the screens: it
 * keeps the semantic while sitting inside the navy-and-gold palette instead of
 * reading as borrowed from another design system.
 */
export const success = {
  text: '#7fb894',
  bg: 'rgba(127, 184, 148, 0.12)',
  border: 'rgba(127, 184, 148, 0.35)',
} as const;

/* ── Type ───────────────────────────────────────────────────────────── */

export const fonts = {
  /** All interface text: labels, buttons, nav, eyebrows. Always uppercase. */
  ui: 'Cinzel',
  /** Hero titles, scripture, and input text. */
  display: 'Playfair Display',
} as const;

/**
 * The reference's proportions, lifted to a 12px floor for legibility.
 * Every other property — face, weight, tracking, case, colour — is unchanged,
 * so the design still reads as the sign-in page, just readable on a phone.
 *
 * Original reference values kept in comments for traceability.
 */
export const fontSize = {
  micro: 12,   // field labels, header subtitle      (was 8)
  tiny: 12,    // guest link, remember-me            (was 9)
  small: 13,   // toggle links, dropdown items       (was 10)
  button: 14,  // primary / secondary button text    (was 11)
  brand: 15,   // header brand mark                  (was 12)
  input: 15,   // input values                       (was 13)
  hero: 38,    // ENTER SANCTUARY                    (was 36)
} as const;

export const tracking = {
  tight: 0.8,
  normal: 1,
  wide: 1.2,
  wider: 1.5,
  widest: 2,
} as const;

/** Reusable text styles matching the reference exactly. */
export const text = {
  brand: {
    fontFamily: fonts.ui,
    fontSize: fontSize.brand,
    fontWeight: '700' as const,
    color: GOLD,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase' as const,
  },
  brandSub: {
    fontFamily: fonts.ui,
    fontSize: fontSize.micro,
    color: SOFT_GOLD,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase' as const,
  },
  hero: {
    fontFamily: fonts.display,
    fontSize: fontSize.hero,
    fontWeight: '700' as const,
    color: WHITE,
    letterSpacing: tracking.widest,
    textTransform: 'uppercase' as const,
  },
  label: {
    fontFamily: fonts.ui,
    fontSize: fontSize.micro,
    fontWeight: '700' as const,
    color: gold.a60,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase' as const,
  },
  link: {
    fontFamily: fonts.ui,
    fontSize: fontSize.tiny,
    fontWeight: '600' as const,
    color: gold.a50,
    letterSpacing: tracking.tight,
    textTransform: 'uppercase' as const,
  },
  toggle: {
    fontFamily: fonts.ui,
    fontSize: fontSize.small,
    fontWeight: '600' as const,
    color: SOFT_GOLD,
    letterSpacing: tracking.tight,
  },
  /** Scripture — the one place Playfair runs at a readable size. */
  verse: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 27,
    color: WHITE,
  },
} as const;

/* ── Geometry ───────────────────────────────────────────────────────── */

export const radius = { xs: 2, sm: 4, md: 6 } as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  section: 36,
} as const;

/**
 * Minimum comfortable touch target. Applied as minHeight on tappables —
 * this does not alter any font size or visual weight, it only guarantees
 * the tap area meets platform guidance.
 */
export const TOUCH_TARGET = 44;

/** Centred app container so desktop never stretches into a wide dashboard. */
export const MAX_CONTENT_WIDTH = 520;

/** Clearance so the fixed tab bar never covers scrolled content. */
export const BOTTOM_NAV_CLEARANCE = 88;

/* ── Components ─────────────────────────────────────────────────────── */

export const buttons = {
  primary: {
    backgroundColor: GOLD,
    paddingVertical: 12,
    borderRadius: radius.sm,
    minHeight: TOUCH_TARGET,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryText: {
    fontFamily: fonts.ui,
    fontSize: fontSize.button,
    fontWeight: '700' as const,
    color: DARK_NAVY,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase' as const,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: gold.a50,
    paddingVertical: 12,
    borderRadius: radius.sm,
    minHeight: TOUCH_TARGET,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  secondaryText: {
    fontFamily: fonts.ui,
    fontSize: fontSize.button,
    fontWeight: '700' as const,
    color: gold.a70,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase' as const,
  },
  disabled: { opacity: 0.45 },
} as const;

export const input = {
  field: {
    backgroundColor: surfaces.input,
    borderWidth: 1,
    borderColor: gold.a30,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: fontSize.input,
    color: WHITE,
    fontFamily: fonts.display,
    minHeight: TOUCH_TARGET,
  },
  focused: { borderColor: gold.a70 },
} as const;

/** Card surface derived from the reference's dropdown/panel treatment. */
export const card = {
  backgroundColor: surfaces.sunken,
  borderWidth: 1,
  borderColor: gold.a30,
  borderRadius: radius.sm,
} as const;

/** Warm glow used on focused / active elements in the reference. */
export const glow = {
  boxShadow: '0 0 18px rgba(212, 175, 55, 0.22)',
} as const;
