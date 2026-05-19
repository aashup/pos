import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '@/src/store/themeStore';
import type {RootStackParamList} from '@/src/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MENU = [
  {
    label: 'Sales Summary',
    subtitle: 'Revenue, orders & payment modes',
    screen: 'ReportsSales' as const,
  },
  {
    label: 'Day Close',
    subtitle: 'Daily cash reconciliation & top items',
    screen: 'ReportsDayClose' as const,
  },
  {
    label: 'Item-Wise Sales',
    subtitle: 'Quantity & revenue per menu item',
    screen: 'ReportsItemWise' as const,
  },
  {
    label: 'GST Summary',
    subtitle: 'Rate-slab CGST / SGST breakdown',
    screen: 'ReportsGst' as const,
  },
];

export default function ReportsMenuScreen() {
  const nav = useNavigation<Nav>();
  const theme = useTheme();

  return (
    <View style={[styles.screen, {backgroundColor: theme.bg}]}>
      <ScrollView contentContainerStyle={styles.content}>
        {MENU.map(item => (
          <TouchableOpacity
            key={item.screen}
            style={[
              styles.row,
              {backgroundColor: theme.surface, borderColor: theme.border},
            ]}
            onPress={() => nav.navigate(item.screen)}
            activeOpacity={0.7}>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, {color: theme.textPrimary}]}>
                {item.label}
              </Text>
              <Text style={[styles.rowSub, {color: theme.textSecondary}]}>
                {item.subtitle}
              </Text>
            </View>
            <Text style={[styles.arrow, {color: theme.textMuted}]}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {padding: 16, gap: 10},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 64,
  },
  rowText: {flex: 1},
  rowLabel: {fontSize: 15, fontWeight: '600'},
  rowSub: {fontSize: 12, marginTop: 2},
  arrow: {fontSize: 20, marginLeft: 8},
});
