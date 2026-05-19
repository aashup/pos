import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PrinterConnectionType = 'bluetooth' | 'network' | 'usb' | 'system';
export type PaperWidth = 58 | 80;

const STORAGE_KEY = 'printerSettings';

export type PrinterSettings = {
  connectionType: PrinterConnectionType;
  // Bluetooth
  btMac: string | null;
  btName: string | null;
  // Network
  netIp: string;
  netPort: number;
  // USB
  usbVendorId: string | null;
  usbProductId: string | null;
  usbDeviceName: string | null;
  // Common
  paperWidth: PaperWidth;
  autoPrintKot: boolean;
  autoPrintReceipt: boolean;
};

type PrinterState = PrinterSettings & {
  // Actions
  update: (patch: Partial<PrinterSettings>) => Promise<void>;
  setBluetoothDevice: (mac: string, name: string) => Promise<void>;
  setUsbDevice: (vendorId: string, productId: string, name: string) => Promise<void>;
};

const DEFAULTS: PrinterSettings = {
  connectionType: 'system',
  btMac: null,
  btName: null,
  netIp: '',
  netPort: 9100,
  usbVendorId: null,
  usbProductId: null,
  usbDeviceName: null,
  paperWidth: 80,
  autoPrintKot: false,
  autoPrintReceipt: false,
};

async function persist(patch: Partial<PrinterSettings>) {
  const current = usePrinterStore.getState();
  const next: PrinterSettings = {
    connectionType: current.connectionType,
    btMac: current.btMac,
    btName: current.btName,
    netIp: current.netIp,
    netPort: current.netPort,
    usbVendorId: current.usbVendorId,
    usbProductId: current.usbProductId,
    usbDeviceName: current.usbDeviceName,
    paperWidth: current.paperWidth,
    autoPrintKot: current.autoPrintKot,
    autoPrintReceipt: current.autoPrintReceipt,
    ...patch,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export const usePrinterStore = create<PrinterState>(set => ({
  ...DEFAULTS,

  update: async patch => {
    const next = await persist(patch);
    set(next);
  },

  setBluetoothDevice: async (mac, name) => {
    const next = await persist({btMac: mac, btName: name});
    set(next);
  },

  setUsbDevice: async (vendorId, productId, name) => {
    const next = await persist({
      usbVendorId: vendorId,
      usbProductId: productId,
      usbDeviceName: name,
    });
    set(next);
  },
}));

export async function initPrinterStore(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved: Partial<PrinterSettings> = JSON.parse(raw);
      usePrinterStore.setState({...DEFAULTS, ...saved});
    }
  } catch {
    // use defaults
  }
}
