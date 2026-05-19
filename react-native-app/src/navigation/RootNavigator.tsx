import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import type {RootStackParamList} from './types';
import {useTheme} from '@/src/store/themeStore';
import TabNavigator from './TabNavigator';
import ItemsScreen from '@/src/screens/ItemsScreen';
import LoginScreen from '@/src/screens/auth/LoginScreen';
import OrderDetailScreen from '@/src/screens/order/OrderDetailScreen';
import PrinterScreen from '@/src/screens/settings/PrinterScreen';
import TableManagerScreen from '@/src/screens/settings/TableManagerScreen';
import {useAuthStore} from '@/src/store/authStore';

// Inventory screens
import InventoryMenuScreen from '@/src/screens/inventory/InventoryMenuScreen';
import InventoryItemsScreen from '@/src/screens/inventory/InventoryItemsScreen';
import InventoryItemFormScreen from '@/src/screens/inventory/InventoryItemFormScreen';
import InventoryModifiersScreen from '@/src/screens/inventory/InventoryModifiersScreen';
import InventoryCombosScreen from '@/src/screens/inventory/InventoryCombosScreen';

// Report screens
import ReportsMenuScreen from '@/src/screens/reports/ReportsMenuScreen';
import SalesScreen from '@/src/screens/reports/SalesScreen';
import DayCloseScreen from '@/src/screens/reports/DayCloseScreen';
import ItemWiseScreen from '@/src/screens/reports/ItemWiseScreen';
import GstScreen from '@/src/screens/reports/GstScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const token = useAuthStore(s => s.token);
  const theme = useTheme();

  const sharedHeaderOptions = {
    headerStyle: {backgroundColor: theme.surface},
    headerTintColor: theme.textPrimary,
    headerShadowVisible: false,
    headerTitleStyle: {color: theme.textPrimary, fontWeight: '700' as const},
    statusBarTranslucent: true,
    statusBarColor: 'transparent',
    statusBarStyle: theme.statusBarStyle,
  };

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {token ? (
          <>
            <Stack.Screen
              name="Tabs"
              component={TabNavigator}
              options={{headerShown: false}}
            />
            <Stack.Screen
              name="Items"
              component={ItemsScreen}
              options={{title: 'Manage Items', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{title: 'Order Detail', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="PrinterSettings"
              component={PrinterScreen}
              options={{title: 'Printer Settings', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="TableManager"
              component={TableManagerScreen}
              options={{title: 'Table Manager', ...sharedHeaderOptions}}
            />
            {/* Inventory */}
            <Stack.Screen
              name="InventoryMenu"
              component={InventoryMenuScreen}
              options={{title: 'Inventory', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="InventoryItems"
              component={InventoryItemsScreen}
              options={{title: 'Items', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="InventoryItemForm"
              component={InventoryItemFormScreen}
              options={{title: 'Item', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="InventoryModifiers"
              component={InventoryModifiersScreen}
              options={{title: 'Modifier Groups', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="InventoryCombos"
              component={InventoryCombosScreen}
              options={{title: 'Combos', ...sharedHeaderOptions}}
            />
            {/* Reports */}
            <Stack.Screen
              name="ReportsMenu"
              component={ReportsMenuScreen}
              options={{title: 'Reports', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="ReportsSales"
              component={SalesScreen}
              options={{title: 'Sales Summary', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="ReportsDayClose"
              component={DayCloseScreen}
              options={{title: 'Day Close', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="ReportsItemWise"
              component={ItemWiseScreen}
              options={{title: 'Item-Wise Sales', ...sharedHeaderOptions}}
            />
            <Stack.Screen
              name="ReportsGst"
              component={GstScreen}
              options={{title: 'GST Summary', ...sharedHeaderOptions}}
            />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{headerShown: false}}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
