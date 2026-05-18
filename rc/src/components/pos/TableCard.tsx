import React from 'react';
import {Text, TouchableOpacity, StyleSheet, View} from 'react-native';
import DiningTable from '@/src/db/models/DiningTable';
import {useTheme} from '@/src/store/themeStore';

type Props = {
  table: DiningTable;
  onPress: (table: DiningTable) => void;
};

function statusStyle(status: string) {
  switch (status) {
    case 'occupied':  return {bg: '#fef3c7', accent: '#b45309'};
    case 'reserved':  return {bg: '#dbeafe', accent: '#1d4ed8'};
    case 'cleaning':  return {bg: '#fee2e2', accent: '#b91c1c'};
    default:          return {bg: '#dcfce7', accent: '#15803d'};
  }
}

export default function TableCard({table, onPress}: Props) {
  const s = statusStyle(table.status);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(table)}
      style={[styles.card, {backgroundColor: s.bg}]}>
      {/* Card bg is always a light pastel — name must always be dark regardless of app theme */}
      <Text style={styles.name}>{table.name}</Text>
      <View style={[styles.pill, {borderColor: s.accent}]}>
        <Text style={[styles.pillText, {color: s.accent}]}>
          {table.status.toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    padding: 14,
    borderRadius: 10,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  name: {fontSize: 18, fontWeight: '800'},
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {fontSize: 10, fontWeight: '700'},
});
