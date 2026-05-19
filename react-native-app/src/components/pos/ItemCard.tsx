import React from 'react';
import {Text, TouchableOpacity, StyleSheet, View} from 'react-native';
import Item from '@/src/db/models/Item';
import {formatCurrency} from '@/src/lib/utils';
import {useTheme} from '@/src/store/themeStore';

type Props = {
  item: Item;
  onPress: (item: Item) => void;
};

export default function ItemCard({item, onPress}: Props) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(item)}
      style={[
        styles.card,
        {backgroundColor: theme.surface, borderColor: theme.border},
      ]}>
      <Text numberOfLines={2} style={[styles.name, {color: theme.textPrimary}]}>
        {item.name}
      </Text>
      <View style={styles.row}>
        <Text style={styles.price}>{formatCurrency(item.price)}</Text>
        {item.unit ? (
          <Text style={[styles.unit, {color: theme.textSecondary}]}>{item.unit}</Text>
        ) : null}
      </View>
      <View style={styles.badges}>
        {item.hasVariants && (
          <View style={[styles.badge, styles.badgeVariant]}>
            <Text style={styles.badgeText}>VAR</Text>
          </View>
        )}
        {item.hasModifiers && (
          <View style={[styles.badge, styles.badgeMod]}>
            <Text style={styles.badgeText}>+ADD</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  name: {fontSize: 14, fontWeight: '600'},
  row: {flexDirection: 'row', alignItems: 'baseline', gap: 6},
  price: {fontSize: 16, fontWeight: '800', color: '#16a34a'},
  unit: {fontSize: 11, textTransform: 'uppercase'},
  badges: {flexDirection: 'row', gap: 6},
  badge: {paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4},
  badgeVariant: {backgroundColor: '#7c3aed'},
  badgeMod: {backgroundColor: '#0ea5e9'},
  badgeText: {color: '#fff', fontSize: 10, fontWeight: '700'},
});
