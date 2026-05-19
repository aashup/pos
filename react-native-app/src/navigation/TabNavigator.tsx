import React from 'react';
import {Image, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import type {TabParamList} from './types';
import {useTheme} from '@/src/store/themeStore';
import TablesScreen from '@/src/screens/tabs/TablesScreen';
import BillingScreen from '@/src/screens/tabs/BillingScreen';
import OrdersScreen from '@/src/screens/tabs/OrdersScreen';
import KitchenScreen from '@/src/screens/tabs/KitchenScreen';
import SettingsScreen from '@/src/screens/tabs/SettingsScreen';

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS = {
  Tables:   require('@/src/assets/icons/tab_tables.png'),
  Billing:  require('@/src/assets/icons/tab_billing.png'),
  Orders:   require('@/src/assets/icons/tab_orders.png'),
  Kitchen:  require('@/src/assets/icons/tab_kitchen.png'),
  Settings: require('@/src/assets/icons/tab_settings.png'),
};

function tabIcon(name: keyof typeof ICONS) {
  return ({focused}: {focused: boolean}) => (
    <Image
      source={ICONS[name]}
      style={[styles.icon, {opacity: focused ? 1 : 0.45}]}
      resizeMode="contain"
    />
  );
}

export default function TabNavigator() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          elevation: 5,
          height: 62,
          paddingBottom: 4,
          paddingTop: 4,
        },
      }}>
      <Tab.Screen name="Tables"   component={TablesScreen}   options={{tabBarIcon: tabIcon('Tables')}} />
      <Tab.Screen name="Billing"  component={BillingScreen}  options={{tabBarIcon: tabIcon('Billing')}} />
      <Tab.Screen name="Orders"   component={OrdersScreen}   options={{tabBarIcon: tabIcon('Orders')}} />
      <Tab.Screen name="Kitchen"  component={KitchenScreen}  options={{tabBarIcon: tabIcon('Kitchen')}} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{tabBarIcon: tabIcon('Settings')}} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  icon: {width: 30, height: 30},
});
