import React from 'react';
import {Text} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import type {TabParamList} from './types';
import {useTheme} from '@/src/store/themeStore';
import TablesScreen from '@/src/screens/tabs/TablesScreen';
import BillingScreen from '@/src/screens/tabs/BillingScreen';
import OrdersScreen from '@/src/screens/tabs/OrdersScreen';
import KitchenScreen from '@/src/screens/tabs/KitchenScreen';
import SettingsScreen from '@/src/screens/tabs/SettingsScreen';

const Tab = createBottomTabNavigator<TabParamList>();

function tabIcon(label: string) {
  return ({color}: {color: string}) => (
    <Text style={{color, fontSize: 11, fontWeight: '700'}}>{label}</Text>
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
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          elevation: 0,
        },
      }}>
      <Tab.Screen name="Tables" component={TablesScreen} options={{tabBarIcon: tabIcon('TBL')}} />
      <Tab.Screen name="Billing" component={BillingScreen} options={{tabBarIcon: tabIcon('BIL')}} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{tabBarIcon: tabIcon('ORD')}} />
      <Tab.Screen name="Kitchen" component={KitchenScreen} options={{tabBarIcon: tabIcon('KIT')}} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{tabBarIcon: tabIcon('SET')}} />
    </Tab.Navigator>
  );
}
