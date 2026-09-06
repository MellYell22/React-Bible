import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Globe2, Menu, Search, Settings, User as UserIcon } from 'lucide-react';
import { APP_COLORS, APP_FONTS } from '../designSystem';
import { useUser } from '../UserContext';

const NAV_ITEMS = ['Home', 'Mood', 'Chat', 'Voice', 'Bible', 'Profile'] as const;
const BRAND_ROUTES = new Set(['Home', 'Mood', 'Pricing', 'Reflection']);

type Props = {
  current: string;
  navigation: { navigate: (name: any, params?: any) => void };
  onLogout?: () => void;
};

export default function AppNav({ current, navigation }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 680;
  const veryCompact = width < 500;
  const { profile } = useUser();
  const brandMode = BRAND_ROUTES.has(current);
  const translation = profile?.preferred_translation || 'NIV';

  return (
    <View style={[styles.shell, compact && styles.shellCompact]}>
      <View style={[styles.utilityLeft, compact && styles.utilityLeftCompact]}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('Mood')}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Menu size={compact ? 15 : 17} color={APP_COLORS.gold} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('Bible')}
          accessibilityRole="button"
          accessibilityLabel="Search scripture"
        >
          <Search size={compact ? 15 : 17} color={APP_COLORS.gold} />
        </TouchableOpacity>
        {!veryCompact && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <UserIcon size={compact ? 15 : 17} color={APP_COLORS.gold} />
          </TouchableOpacity>
        )}
      </View>

      {brandMode ? (
        <View style={styles.brandWrap}>
          <Text style={[styles.brandTitle, compact && styles.brandTitleCompact]} numberOfLines={1}>
            BIBLE MOOD SEARCH
          </Text>
          {!veryCompact && (
            <Text style={[styles.brandTagline, compact && styles.brandTaglineCompact]} numberOfLines={1}>
              DISCOVER SCRIPTURE FOR EVERY FEELING.
            </Text>
          )}
        </View>
      ) : (
        <View style={[styles.navItems, compact && styles.navItemsCompact]}>
          {NAV_ITEMS.map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => navigation.navigate(item)}
              style={[styles.navButton, compact && styles.navButtonCompact]}
              accessibilityRole="button"
              accessibilityLabel={item}
            >
              <Text style={[styles.navText, compact && styles.navTextCompact, current === item && styles.navTextActive]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[styles.utilityRight, compact && styles.utilityRightCompact]}>
        {brandMode ? (
          <>
            <TouchableOpacity
              style={[styles.translationBadge, compact && styles.translationBadgeCompact]}
              onPress={() => navigation.navigate('Profile')}
              accessibilityRole="button"
              accessibilityLabel={`Translation ${translation}`}
            >
              <Text style={styles.translationText}>{translation}</Text>
              <Globe2 size={compact ? 11 : 12} color={APP_COLORS.gold} />
            </TouchableOpacity>
            {!veryCompact && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate('Profile')}
                accessibilityRole="button"
                accessibilityLabel="Settings"
              >
                <Settings size={compact ? 15 : 17} color={APP_COLORS.gold} />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.balanceSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    backgroundColor: APP_COLORS.navyDeep,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.borderSoft,
  },
  shellCompact: {
    minHeight: 52,
    paddingHorizontal: 10,
  },
  utilityLeft: {
    width: 118,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  utilityLeftCompact: {
    width: 86,
    gap: 5,
  },
  utilityRight: {
    width: 118,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 9,
  },
  utilityRightCompact: {
    width: 86,
    gap: 4,
  },
  iconButton: {
    minWidth: 28,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  brandTitle: {
    color: APP_COLORS.gold,
    fontFamily: APP_FONTS.serif,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.35,
    textAlign: 'center',
  },
  brandTitleCompact: {
    fontSize: 10,
    letterSpacing: 0.9,
  },
  brandTagline: {
    color: APP_COLORS.goldSoft,
    fontFamily: APP_FONTS.serif,
    fontSize: 6.5,
    fontWeight: '600',
    letterSpacing: 1.25,
    marginTop: 3,
    textAlign: 'center',
  },
  brandTaglineCompact: {
    fontSize: 5.5,
    letterSpacing: 0.8,
  },
  translationBadge: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: APP_COLORS.borderSoft,
  },
  translationBadgeCompact: {
    minHeight: 28,
    paddingHorizontal: 6,
  },
  translationText: {
    color: APP_COLORS.gold,
    fontFamily: APP_FONTS.serif,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  navItems: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemsCompact: {
    justifyContent: 'space-around',
  },
  navButton: {
    paddingHorizontal: 10,
    paddingVertical: 18,
  },
  navButtonCompact: {
    paddingHorizontal: 5,
    paddingVertical: 16,
  },
  navText: {
    color: 'rgba(241, 212, 119, 0.76)',
    fontFamily: APP_FONTS.sans,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  navTextCompact: {
    fontSize: 8.5,
  },
  navTextActive: {
    color: APP_COLORS.gold,
    borderBottomWidth: 2,
    borderBottomColor: APP_COLORS.gold,
    paddingBottom: 7,
  },
  balanceSpacer: {
    width: '100%',
    height: 1,
  },
});
