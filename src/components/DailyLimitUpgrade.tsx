import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { PLANS } from '../constants';
import {
  NAVY,
  DARK_NAVY,
  GOLD,
  IVORY,
  CREAM,
  CREAM_DIM,
  gold,
  fonts,
  radius,
  spacing,
  buttons,
  TOUCH_TARGET,
  MAX_CONTENT_WIDTH,
} from '../theme';

type Props = {
  /** Starts Plus checkout. Wire to the caller's existing checkout handler. */
  onUpgradePlus: () => void;
  /** Starts Pro checkout. Wire to the caller's existing checkout handler. */
  onUpgradePro: () => void;
  /** Dismisses the screen. */
  onDismiss: () => void;
  /** Optional: disables the buttons while a checkout request is in flight. */
  busy?: boolean;
  /** Identifies which free daily allowance was reached. */
  feature?: 'conversations' | 'reflections';
};

/**
 * Shown when a free account reaches its daily conversation or reflection
 * limit. Presentational only — it triggers no billing itself, it just calls
 * the handlers it is given.
 *
 * Plan names, prices and features are read from PLANS so this screen can
 * never drift from what is actually sold.
 */
export default function DailyLimitUpgrade({
  onUpgradePlus,
  onUpgradePro,
  onDismiss,
  busy = false,
  feature = 'conversations',
}: Props) {
  const plans = [
    { data: PLANS.FREE, current: true, featured: false },
    { data: PLANS.PLUS, current: false, featured: false },
    { data: PLANS.PRO, current: false, featured: true },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.shell}>
        <Text style={styles.title}>Continue your journey</Text>

        <Text style={styles.message}>
          We hope today’s scripture and encouragement brought you peace. You’ve reached
          today’s three free {feature}, but your journey doesn’t have to end here.
        </Text>

        <Text style={styles.messageQuiet}>
          Choose the plan that’s right for you to keep receiving faithful guidance
          whenever you need it.
        </Text>

        <View style={styles.plans}>
          {plans.map(({ data, current, featured }) => (
            <View
              key={data.id}
              style={[
                styles.planCard,
                current && styles.planCardCurrent,
                featured && styles.planCardFeatured,
              ]}
            >
              {featured && <Text style={styles.featuredNote}>Most complete</Text>}

              <View style={styles.planHead}>
                <Text style={styles.planName}>{data.name}</Text>
                <View style={styles.planPriceRow}>
                  <Text style={styles.planPrice}>{data.price}</Text>
                  {data.price !== '$0' && (
                    <Text style={styles.planInterval}> / month</Text>
                  )}
                </View>
              </View>

              {current && <Text style={styles.currentTag}>Your current plan</Text>}

              <View style={styles.features}>
                {data.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Text style={styles.featureMark}>·</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, busy && buttons.disabled]}
          onPress={onUpgradePlus}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Upgrade to ${PLANS.PLUS.name}, ${PLANS.PLUS.price} per month`}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            Upgrade to {PLANS.PLUS.name} — {PLANS.PLUS.price}/month
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, busy && buttons.disabled]}
          onPress={onUpgradePro}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Upgrade to ${PLANS.PRO.name}, ${PLANS.PRO.price} per month`}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>
            Upgrade to {PLANS.PRO.name} — {PLANS.PRO.price}/month
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Maybe later"
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>Maybe later</Text>
        </TouchableOpacity>

        <View style={styles.verseFooter}>
          <Text style={styles.verseText}>
            “Thy word is a lamp unto my feet, and a light unto my path.”
          </Text>
          <Text style={styles.verseRef}>Psalm 119:105</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NAVY },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 56,
    paddingBottom: 56,
  },
  shell: { width: '100%', maxWidth: MAX_CONTENT_WIDTH },

  /* Smaller, sentence case, unhurried */
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 36,
    color: IVORY,
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: spacing.xl,
  },

  message: {
    fontFamily: fonts.display,
    fontSize: 15,
    lineHeight: 28,
    color: CREAM,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  messageQuiet: {
    fontFamily: fonts.display,
    fontSize: 14,
    lineHeight: 26,
    color: CREAM_DIM,
    textAlign: 'center',
    marginBottom: 44,
  },

  plans: { marginBottom: spacing.xl },

  /* Soft surfaces — hairline borders, gentle depth, generous padding */
  planCard: {
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 228, 0.09)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(5, 16, 32, 0.34)',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.18)',
    elevation: 2,
  },

  planCardCurrent: {
    backgroundColor: 'rgba(5, 16, 32, 0.2)',
    borderColor: 'rgba(244, 239, 228, 0.06)',
  },

  /* Featured: a warmer hairline and a whisper of gold. No badge, no fill. */
  planCardFeatured: {
    borderColor: 'rgba(212, 175, 55, 0.28)',
    backgroundColor: 'rgba(5, 16, 32, 0.44)',
    boxShadow: '0 0 22px rgba(212, 175, 55, 0.12)',
  },

  featuredNote: {
    fontFamily: fonts.display,
    fontSize: 12,
    fontStyle: 'italic',
    color: gold.a60,
    marginBottom: spacing.md,
  },

  planHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  planName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: IVORY,
    flexShrink: 1,
  },

  planPriceRow: { flexDirection: 'row', alignItems: 'baseline' },
  planPrice: { fontFamily: fonts.display, fontSize: 20, color: gold.full },
  planInterval: { fontFamily: fonts.display, fontSize: 13, color: CREAM_DIM },

  currentTag: {
    fontFamily: fonts.display,
    fontSize: 13,
    fontStyle: 'italic',
    color: CREAM_DIM,
    marginTop: spacing.sm,
  },

  features: { marginTop: spacing.lg },

  featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  featureMark: {
    color: gold.a50,
    fontSize: 15,
    lineHeight: 24,
    marginRight: spacing.md,
  },
  featureText: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 14.5,
    lineHeight: 24,
    color: CREAM,
  },

  /* Buttons — sentence case, calm weight */
  primaryButton: {
    backgroundColor: GOLD,
    borderRadius: radius.md,
    minHeight: TOUCH_TARGET + 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    fontFamily: fonts.display,
    fontSize: 15.5,
    color: DARK_NAVY,
    letterSpacing: 0.2,
  },

  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.34)',
    borderRadius: radius.md,
    minHeight: TOUCH_TARGET + 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  secondaryButtonText: {
    fontFamily: fonts.display,
    fontSize: 15.5,
    color: gold.a70,
    letterSpacing: 0.2,
  },

  dismissButton: {
    minHeight: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  dismissText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: CREAM_DIM,
    letterSpacing: 0.2,
  },

  verseFooter: {
    marginTop: 52,
    paddingTop: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(244, 239, 228, 0.08)',
    alignItems: 'center',
  },
  verseText: {
    fontFamily: fonts.display,
    fontSize: 14.5,
    lineHeight: 26,
    fontStyle: 'italic',
    color: CREAM_DIM,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  verseRef: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: gold.a50,
    letterSpacing: 0.3,
  },
});