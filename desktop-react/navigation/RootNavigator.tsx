import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '@/src/store/authStore';
import type { RootStackParamList, MainStackParamList, AuthStackParamList } from './types';

// Auth screens
import LoginScreen from '@/screens/auth/LoginScreen';

// Tab screens
import TabsNavigator from '@/screens/tabs/TabNavigator';

// Stack screens
import OrderDetailScreen from '@/screens/order/OrderDetailScreen';
import SalesScreen from '@/screens/reports/SalesScreen';
import DayCloseScreen from '@/screens/reports/DayCloseScreen';
import ItemWiseScreen from '@/screens/reports/ItemWiseScreen';
import GstScreen from '@/screens/reports/GstScreen';
import InventoryMenuScreen from '@/screens/inventory/InventoryMenuScreen';
import ItemsScreen from '@/screens/inventory/ItemsScreen';
import ItemFormScreen from '@/screens/inventory/ItemFormScreen';
import ModifiersScreen from '@/screens/inventory/ModifiersScreen';
import CombosScreen from '@/screens/inventory/CombosScreen';

const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const MainStack = createStackNavigator<MainStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Tabs" component={TabsNavigator} />
      <MainStack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <MainStack.Screen name="ReportsSales" component={SalesScreen} />
      <MainStack.Screen name="ReportsDayClose" component={DayCloseScreen} />
      <MainStack.Screen name="ReportsItemWise" component={ItemWiseScreen} />
      <MainStack.Screen name="ReportsGst" component={GstScreen} />
      <MainStack.Screen name="InventoryMenu" component={InventoryMenuScreen} />
      <MainStack.Screen name="InventoryItems" component={ItemsScreen} />
      <MainStack.Screen name="InventoryItemForm" component={ItemFormScreen} />
      <MainStack.Screen name="InventoryModifiers" component={ModifiersScreen} />
      <MainStack.Screen name="InventoryCombos" component={CombosScreen} />
    </MainStack.Navigator>
  );
}

export default function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <RootStack.Screen name="Main" component={MainNavigator} />
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}
