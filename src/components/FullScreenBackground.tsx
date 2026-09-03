import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { smokyPageBackground } from '../theme';

interface FullScreenBackgroundProps {
  children: React.ReactNode;
  center?: boolean;
}

export const FullScreenBackground: React.FC<FullScreenBackgroundProps> = ({ children, center = false }) => {
  return (
    <View style={[styles.container, center && styles.center]}>
      <View style={styles.safeArea}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? ('100dvh' as any) : undefined,
    ...smokyPageBackground,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
  },
});
