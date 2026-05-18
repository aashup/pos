import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useTheme, useThemeStore} from '@/src/store/themeStore';

type HeaderProps = {
  title: string;
  subtitle?: string;
  /** Extra content rendered to the right of the title (e.g. action buttons). */
  right?: React.ReactNode;
  /** Show the light/dark toggle button. Defaults to true. */
  showToggle?: boolean;
};

export default function Header({
  title,
  subtitle,
  right,
  showToggle = true,
}: HeaderProps) {
  const theme = useTheme();
  const isDark = useThemeStore(s => s.isDark);
  const toggle = useThemeStore(s => s.toggle);
  const {top} = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
          paddingTop: top + 12,
        },
      ]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, {color: theme.textPrimary}]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, {color: theme.textSecondary}]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightBlock}>
        {right}
        {showToggle && (
          <TouchableOpacity
            onPress={toggle}
            style={styles.toggleBtn}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Text style={[styles.toggleIcon, {color: theme.textSecondary}]}>
              {isDark ? '☀' : '☾'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  titleBlock: {flex: 1},
  title: {fontSize: 20, fontWeight: '700'},
  subtitle: {fontSize: 11, marginTop: 1, textTransform: 'capitalize'},
  rightBlock: {flexDirection: 'row', alignItems: 'center', gap: 8},
  toggleBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIcon: {fontSize: 20},
});
