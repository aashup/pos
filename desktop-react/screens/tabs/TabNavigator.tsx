import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '@/navigation/types';
import TablesScreen from './TablesScreen';
import BillingScreen from './BillingScreen';
import OrdersScreen from './OrdersScreen';
import KitchenScreen from './KitchenScreen';
import SettingsScreen from './SettingsScreen';

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#d97706',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e5e7eb' },
      }}
    >
      <Tab.Screen name="Tables" component={TablesScreen} />
      <Tab.Screen name="Billing" component={BillingScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Kitchen" component={KitchenScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
