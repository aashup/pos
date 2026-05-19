import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {CompositeScreenProps} from '@react-navigation/native';

export type TabParamList = {
  Tables: undefined;
  Billing: undefined;
  Orders: undefined;
  Kitchen: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
  OrderDetail: {orderId: string};
  Items: undefined;
  PrinterSettings: undefined;
  TableManager: undefined;
  // Inventory
  InventoryMenu: undefined;
  InventoryItems: undefined;
  InventoryItemForm: {id: string};
  InventoryModifiers: undefined;
  InventoryCombos: undefined;
  // Reports
  ReportsMenu: undefined;
  ReportsSales: undefined;
  ReportsDayClose: undefined;
  ReportsItemWise: undefined;
  ReportsGst: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
