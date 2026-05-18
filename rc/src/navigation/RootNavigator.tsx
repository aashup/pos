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
import {useAuthStore} from '@/src/store/authStore';

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
