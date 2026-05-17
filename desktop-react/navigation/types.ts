import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Tables: undefined;
  Billing: undefined;
  Orders: undefined;
  Kitchen: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  OrderDetail: { id: string };
  ReportsSales: undefined;
  ReportsDayClose: undefined;
  ReportsItemWise: undefined;
  ReportsGst: undefined;
  InventoryMenu: undefined;
  InventoryItems: undefined;
  InventoryItemForm: { id: string };
  InventoryModifiers: undefined;
  InventoryCombos: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
};
