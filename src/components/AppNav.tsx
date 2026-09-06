import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Menu, Search, User as UserIcon } from 'lucide-react';
import { APP_COLORS, APP_FONTS } from '../designSystem';

const NAV_ITEMS = ['Home', 'Mood', 'Chat', 'Voice', 'Bible', 'Profile'] as const;

type Props = {
  current: string;
  navigation: { navigate: (name: any, params?: any) => void };
  onLogout?: () => void;
};

export default function AppNav({ current, navigation, onLogout }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 760;

  return (
    <View style={styles.shell}>
      <View style={styles.utilityLeft}>
        <Menu size={17} color={APP_COLORS.gold} />
        {!compact && <Search size={17} color={APP_COLORS.gold} />}
        {!compact && <UserIcon size={17} color={APP_COLORS.gold} />}
      </View>

      <View style={[styles.navItems, compact && styles.navItemsCompact]}>
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity key={item} onPress={() => navigation.navigate(item)} style={styles.navButton}>
            <Text style={[styles.navText, current === item && styles.navTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
        {onLogout && !compact && (
          <TouchableOpacity onPress={onLogout} style={styles.navButton}>
            <Text style={styles.navText}>Log out</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.utilityRight} onPress={() => navigation.navigate('Pricing')}>
        <Text style={styles.upgradeText}>PLANS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    backgroundColor: APP_COLORS.navyDeep,
    borderBottomWidth: 1,
    borderBottomColor: APP_COLORS.borderSoft,
  },
  utilityLeft: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  utilityRight: {
    width: 88,
    alignItems: 'flex-end',
    paddingVertical: 11,
  },
  upgradeText: {
    color: APP_COLORS.gold,
    fontFamily: APP_FONTS.serif,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  navItems: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  navItemsCompact: {
    gap: 0,
  },
  navButton: {
    paddingHorizontal: 9,
    paddingVertical: 14,
  },
  navText: {
    color: 'rgba(241, 212, 119, 0.68)',
    fontFamily: APP_FONTS.sans,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  navTextActive: {
    color: APP_COLORS.gold,
    borderBottomWidth: 2,
    borderBottomColor: APP_COLORS.gold,
    paddingBottom: 7,
  },
});
