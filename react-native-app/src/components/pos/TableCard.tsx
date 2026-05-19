import React, {useEffect, useRef} from 'react';
import {
  Text,
  StyleSheet,
  View,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import DiningTable from '@/src/db/models/DiningTable';
import {useThemeStore} from '@/src/store/themeStore';

type Props = {
  table: DiningTable;
  onPress: (table: DiningTable) => void;
  index?: number;
};

type StatusTokens = {bg: string; accent: string; nameColor: string};

function statusTokens(status: string, isDark: boolean): StatusTokens {
  if (isDark) {
    switch (status) {
      case 'occupied':  return {bg: '#78350f', accent: '#fbbf24', nameColor: '#fef3c7'};
      case 'reserved':  return {bg: '#1e3a8a', accent: '#93c5fd', nameColor: '#dbeafe'};
      case 'cleaning':  return {bg: '#7f1d1d', accent: '#fca5a5', nameColor: '#fee2e2'};
      default:          return {bg: '#14532d', accent: '#4ade80', nameColor: '#dcfce7'};
    }
  }
  switch (status) {
    case 'occupied':  return {bg: '#fef3c7', accent: '#b45309', nameColor: '#0f172a'};
    case 'reserved':  return {bg: '#dbeafe', accent: '#1d4ed8', nameColor: '#0f172a'};
    case 'cleaning':  return {bg: '#fee2e2', accent: '#b91c1c', nameColor: '#0f172a'};
    default:          return {bg: '#dcfce7', accent: '#15803d', nameColor: '#0f172a'};
  }
}

export default function TableCard({table, onPress, index = 0}: Props) {
  const isDark = useThemeStore(s => s.isDark);
  const s = statusTokens(table.status, isDark);

  const translateY = useRef(new Animated.Value(24)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(1)).current;
  const liftY      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        delay: index * 45,
        tension: 70,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        delay: index * 45,
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePressIn() {
    Animated.parallel([
      Animated.spring(scale, {toValue: 1.05, tension: 220, friction: 7, useNativeDriver: true}),
      Animated.spring(liftY,  {toValue: -6,  tension: 220, friction: 7, useNativeDriver: true}),
    ]).start();
  }

  function handlePressOut() {
    Animated.parallel([
      Animated.spring(scale, {toValue: 1, tension: 220, friction: 7, useNativeDriver: true}),
      Animated.spring(liftY,  {toValue: 0, tension: 220, friction: 7, useNativeDriver: true}),
    ]).start();
  }

  const animStyle = {
    opacity,
    transform: [
      {translateY: Animated.add(translateY, liftY)},
      {scale},
    ],
  };

  return (
    <TouchableWithoutFeedback
      onPress={() => onPress(table)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}>
      <Animated.View style={[styles.card, {backgroundColor: s.bg}, animStyle]}>
        <View style={[styles.accentBar, {backgroundColor: s.accent}]} />
        <Text style={[styles.name, {color: s.nameColor}]}>{table.name}</Text>
        <View style={[styles.pill, {backgroundColor: s.accent + '33', borderColor: s.accent}]}>
          <Text style={[styles.pillText, {color: s.accent}]}>
            {table.status.toUpperCase()}
          </Text>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    borderRadius: 14,
    minHeight: 104,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.13,
    shadowRadius: 8,
    elevation: 5,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  pill: {
    alignSelf: 'flex-start',
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {fontSize: 10, fontWeight: '700'},
});
