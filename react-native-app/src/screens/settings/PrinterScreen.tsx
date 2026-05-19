import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  IBLEPrinter,
  IUSBPrinter,
  NetPrinter,
} from 'react-native-thermal-receipt-printer-image-qr';

import {
  usePrinterStore,
  PrinterConnectionType,
  PaperWidth,
} from '@/src/store/printerStore';
import {useTheme} from '@/src/store/themeStore';
import {
  getBluetoothDevices,
  getUsbDevices,
  testPrint,
} from '@/src/lib/printer';

const CONN_TYPES: {key: PrinterConnectionType; label: string; emoji: string}[] = [
  {key: 'bluetooth', label: 'Bluetooth', emoji: '📶'},
  {key: 'network',   label: 'Network',   emoji: '🌐'},
  {key: 'usb',       label: 'USB',       emoji: '🔌'},
  {key: 'system',    label: 'System',    emoji: '📄'},
];

const PAPER_WIDTHS: {w: PaperWidth; label: string}[] = [
  {w: 58, label: '58 mm'},
  {w: 80, label: '80 mm'},
];

export default function PrinterScreen() {
  const theme = useTheme();
  const store = usePrinterStore();

  const [btDevices, setBtDevices] = useState<IBLEPrinter[]>([]);
  const [usbDevices, setUsbDevices] = useState<IUSBPrinter[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'bt' | 'usb' | 'net' | null>(null);
  const [testing, setTesting] = useState(false);
  const [netIpInput, setNetIpInput] = useState(store.netIp);
  const [netPortInput, setNetPortInput] = useState(String(store.netPort));
  const [netSubnet, setNetSubnet] = useState('192.168.1');
  const [netScanProgress, setNetScanProgress] = useState(0);
  const [netDiscovered, setNetDiscovered] = useState<string[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setNetIpInput(store.netIp);
    setNetPortInput(String(store.netPort));
  }, [store.netIp, store.netPort]);

  useEffect(() => {
    if (store.netIp) {
      const parts = store.netIp.split('.');
      if (parts.length === 4) setNetSubnet(parts.slice(0, 3).join('.'));
    }
  }, [store.netIp]);

  useEffect(() => () => { cancelledRef.current = true; }, []);

  function stopScan() {
    cancelledRef.current = true;
    setScanning(false);
    setScanMode(null);
  }

  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Scan timed out after ${ms / 1000}s`)), ms),
      ),
    ]);
  }

  async function scanBluetooth() {
    cancelledRef.current = false;
    setScanning(true);
    setScanMode('bt');
    setBtDevices([]);
    try {
      const devices = await withTimeout(getBluetoothDevices(), 6000);
      if (!cancelledRef.current) setBtDevices(devices);
    } catch (err: any) {
      if (!cancelledRef.current) {
        Alert.alert(
          'Bluetooth error',
          (err?.message ?? String(err)) +
            '\n\nMake sure Bluetooth is ON and the printer is paired in Android Bluetooth settings.',
        );
      }
    } finally {
      if (!cancelledRef.current) { setScanning(false); setScanMode(null); }
    }
  }

  async function scanUsb() {
    cancelledRef.current = false;
    setScanning(true);
    setScanMode('usb');
    setUsbDevices([]);
    try {
      const devices = await withTimeout(getUsbDevices(), 6000);
      if (!cancelledRef.current) setUsbDevices(devices);
    } catch (err: any) {
      if (!cancelledRef.current) Alert.alert('USB error', err?.message ?? String(err));
    } finally {
      if (!cancelledRef.current) { setScanning(false); setScanMode(null); }
    }
  }

  function probeNetIp(ip: string, timeoutMs: number): Promise<string | null> {
    return new Promise(resolve => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; resolve(null); }
      }, timeoutMs);
      NetPrinter.connectPrinter(ip, 9100)
        .then(() => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            NetPrinter.closeConn().catch(() => {});
            resolve(ip);
          }
        })
        .catch(() => {
          clearTimeout(timer);
          if (!settled) { settled = true; resolve(null); }
        });
    });
  }

  async function scanNetwork() {
    const subnet = netSubnet.trim();
    const parts = subnet.split('.');
    if (parts.length !== 3 || parts.some(p => isNaN(Number(p)))) {
      Alert.alert('Invalid subnet', 'Enter a prefix like 192.168.1');
      return;
    }
    cancelledRef.current = false;
    setScanning(true);
    setScanMode('net');
    setNetDiscovered([]);
    setNetScanProgress(0);

    try { await NetPrinter.init(); } catch { /* already initialised */ }

    const BATCH = 16;
    const PROBE_TIMEOUT = 1200;
    let probed = 0;

    for (let batchStart = 1; batchStart <= 254; batchStart += BATCH) {
      if (cancelledRef.current) break;
      const end = Math.min(batchStart + BATCH - 1, 254);
      const batch = [];
      for (let i = batchStart; i <= end; i++) {
        const ip = `${subnet}.${i}`;
        batch.push(
          probeNetIp(ip, PROBE_TIMEOUT).then(found => {
            probed++;
            if (!cancelledRef.current) {
              setNetScanProgress(probed);
              if (found) setNetDiscovered(prev => [...prev, found]);
            }
          }),
        );
      }
      await Promise.all(batch);
    }

    if (!cancelledRef.current) { setScanning(false); setScanMode(null); }
  }

  async function saveNetworkSettings() {
    const ip = netIpInput.trim();
    const port = parseInt(netPortInput, 10) || 9100;
    if (!ip) { Alert.alert('Error', 'Please enter the printer IP address.'); return; }
    await store.update({netIp: ip, netPort: port});
    Alert.alert('Saved', `Network printer set to ${ip}:${port}`);
  }

  async function handleTestPrint() {
    setTesting(true);
    try {
      await testPrint();
      Alert.alert('Success', 'Test print sent!');
    } catch (err: any) {
      Alert.alert('Print failed', err?.message ?? String(err));
    } finally {
      setTesting(false);
    }
  }

  const isConfigured = (() => {
    switch (store.connectionType) {
      case 'bluetooth': return !!store.btMac;
      case 'network':   return !!store.netIp;
      case 'usb':       return !!store.usbVendorId;
      case 'system':    return true;
    }
  })();

  const sectionStyle = [styles.section, {backgroundColor: theme.surface, borderColor: theme.border}];
  const inputStyle = [styles.input, {backgroundColor: theme.bg, borderColor: theme.border, color: theme.textPrimary}];

  return (
    <KeyboardAvoidingView style={[styles.screen, {backgroundColor: theme.bg}]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView
      style={{flex: 1}}
      contentContainerStyle={styles.content}>

      {/* Connection type */}
      <View style={sectionStyle}>
        <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Connection type</Text>
        <View style={styles.tabRow}>
          {CONN_TYPES.map(ct => {
            const active = store.connectionType === ct.key;
            return (
              <TouchableOpacity
                key={ct.key}
                style={[
                  styles.tab,
                  {borderColor: theme.border, backgroundColor: theme.surface},
                  active && styles.tabActive,
                ]}
                onPress={() => store.update({connectionType: ct.key})}>
                <Text style={styles.tabEmoji}>{ct.emoji}</Text>
                <Text style={[styles.tabLabel, {color: theme.textSecondary}, active && styles.tabLabelActive]}>
                  {ct.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Bluetooth */}
      {store.connectionType === 'bluetooth' && (
        <View style={sectionStyle}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>
              Paired Bluetooth printers
            </Text>
            {scanning ? (
              <View style={styles.scanningRow}>
                <ActivityIndicator size="small" color="#0ea5e9" style={{marginRight: 6}} />
                <TouchableOpacity onPress={stopScan} style={styles.stopBtn}>
                  <Text style={styles.stopBtnText}>⏹ Stop</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={scanBluetooth}>
                <Text style={styles.refreshBtn}>↻ Scan</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.hint, {color: theme.textSecondary}]}>
            Printer must be paired in Android Bluetooth settings first.
          </Text>
          {btDevices.length === 0 && !scanning && (
            <Text style={[styles.emptyText, {color: theme.textMuted}]}>
              No paired printers found.
            </Text>
          )}
          {btDevices.map(d => {
            const selected = store.btMac === d.inner_mac_address;
            return (
              <TouchableOpacity
                key={d.inner_mac_address}
                style={[
                  styles.deviceRow,
                  {borderColor: theme.border, backgroundColor: theme.bg},
                  selected && styles.deviceRowSelected,
                ]}
                onPress={() => store.setBluetoothDevice(d.inner_mac_address, d.device_name)}>
                <View style={{flex: 1}}>
                  <Text style={[styles.deviceName, {color: theme.textPrimary}, selected && styles.deviceNameSelected]}>
                    🖨 {d.device_name}
                  </Text>
                  <Text style={[styles.deviceMac, {color: theme.textSecondary}]}>
                    {d.inner_mac_address}
                  </Text>
                </View>
                {selected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
          {store.btName && (
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedInfoText}>
                Selected: {store.btName} ({store.btMac})
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Network */}
      {store.connectionType === 'network' && (
        <>
          <View style={sectionStyle}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Scan network</Text>
              {scanMode === 'net' ? (
                <View style={styles.scanningRow}>
                  <ActivityIndicator size="small" color="#0ea5e9" style={{marginRight: 6}} />
                  <TouchableOpacity onPress={stopScan} style={styles.stopBtn}>
                    <Text style={styles.stopBtnText}>⏹ Stop</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={scanNetwork} disabled={scanning}>
                  <Text style={[styles.refreshBtn, scanning && {opacity: 0.4}]}>🔍 Scan</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.hint, {color: theme.textSecondary}]}>
              Probes port 9100 across your subnet.
            </Text>
            <View style={styles.subnetRow}>
              <TextInput
                style={[inputStyle, styles.subnetInput]}
                value={netSubnet}
                onChangeText={setNetSubnet}
                placeholder="192.168.1"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!scanning}
              />
              <Text style={[styles.subnetSuffix, {color: theme.textSecondary}]}>
                .1 – .254  :9100
              </Text>
            </View>
            {scanMode === 'net' && (
              <View style={[styles.progressWrap, {backgroundColor: theme.border}]}>
                <View style={[styles.progressBar, {width: `${Math.round((netScanProgress / 254) * 100)}%`}]} />
                <Text style={[styles.progressText, {color: theme.textPrimary}]}>
                  {netSubnet}.{netScanProgress} — {netScanProgress}/254
                </Text>
              </View>
            )}
            {netDiscovered.length === 0 && scanMode !== 'net' && (
              <Text style={[styles.emptyText, {color: theme.textMuted}]}>
                {netScanProgress > 0 ? 'No printers found on this subnet.' : 'Tap 🔍 Scan to search.'}
              </Text>
            )}
            {netDiscovered.map(ip => {
              const selected = store.netIp === ip;
              return (
                <TouchableOpacity
                  key={ip}
                  style={[
                    styles.deviceRow,
                    {borderColor: theme.border, backgroundColor: theme.bg},
                    selected && styles.deviceRowSelected,
                  ]}
                  onPress={async () => {
                    await store.update({netIp: ip, netPort: 9100});
                    setNetIpInput(ip);
                    setNetPortInput('9100');
                  }}>
                  <View style={{flex: 1}}>
                    <Text style={[styles.deviceName, {color: theme.textPrimary}, selected && styles.deviceNameSelected]}>
                      🖨 {ip}
                    </Text>
                    <Text style={[styles.deviceMac, {color: theme.textSecondary}]}>Port 9100</Text>
                  </View>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={sectionStyle}>
            <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Manual entry</Text>
            <Text style={[styles.hint, {color: theme.textSecondary}]}>
              Enter the printer IP directly if you know it.
            </Text>
            <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>IP Address</Text>
            <TextInput
              style={inputStyle}
              value={netIpInput}
              onChangeText={setNetIpInput}
              placeholder="192.168.1.100"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.fieldLabel, {color: theme.textSecondary}]}>Port</Text>
            <TextInput
              style={inputStyle}
              value={netPortInput}
              onChangeText={setNetPortInput}
              placeholder="9100"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveNetworkSettings}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
            {store.netIp && (
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedInfoText}>
                  Configured: {store.netIp}:{store.netPort}
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* USB */}
      {store.connectionType === 'usb' && (
        <View style={sectionStyle}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>USB printers</Text>
            {scanning ? (
              <View style={styles.scanningRow}>
                <ActivityIndicator size="small" color="#0ea5e9" style={{marginRight: 6}} />
                <TouchableOpacity onPress={stopScan} style={styles.stopBtn}>
                  <Text style={styles.stopBtnText}>⏹ Stop</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={scanUsb}>
                <Text style={styles.refreshBtn}>↻ Scan</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.hint, {color: theme.textSecondary}]}>
            Connect the printer via USB OTG cable.
          </Text>
          {usbDevices.length === 0 && !scanning && (
            <Text style={[styles.emptyText, {color: theme.textMuted}]}>
              No USB printers detected.
            </Text>
          )}
          {usbDevices.map(d => {
            const selected = store.usbVendorId === d.vendor_id && store.usbProductId === d.product_id;
            return (
              <TouchableOpacity
                key={`${d.vendor_id}-${d.product_id}`}
                style={[
                  styles.deviceRow,
                  {borderColor: theme.border, backgroundColor: theme.bg},
                  selected && styles.deviceRowSelected,
                ]}
                onPress={() => store.setUsbDevice(d.vendor_id, d.product_id, d.device_name)}>
                <View style={{flex: 1}}>
                  <Text style={[styles.deviceName, {color: theme.textPrimary}, selected && styles.deviceNameSelected]}>
                    🖨 {d.device_name}
                  </Text>
                  <Text style={[styles.deviceMac, {color: theme.textSecondary}]}>
                    VID:{d.vendor_id} PID:{d.product_id}
                  </Text>
                </View>
                {selected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* System print */}
      {store.connectionType === 'system' && (
        <View style={sectionStyle}>
          <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>System print</Text>
          <View style={styles.systemIconWrap}>
            <Text style={styles.systemIcon}>📄</Text>
          </View>
          <Text style={[styles.systemDesc, {color: theme.textSecondary}]}>
            Uses Android's built-in print system. Tap{' '}
            <Text style={[styles.systemDescBold, {color: theme.textPrimary}]}>🖨 Test print</Text>{' '}
            below to open the print dialog.
          </Text>
          <View style={styles.systemFeatureList}>
            {[
              '✓  Works with any Mopria / Wi-Fi printer',
              '✓  Save as PDF (Google Drive, local storage)',
              '✓  No IP or pairing configuration needed',
              '✓  Prints KOTs and receipts as formatted HTML',
            ].map(f => (
              <Text key={f} style={styles.systemFeature}>{f}</Text>
            ))}
          </View>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedInfoText}>
              ✓ System print is always ready — no setup required.
            </Text>
          </View>
        </View>
      )}

      {/* Paper width */}
      <View style={sectionStyle}>
        <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Paper width</Text>
        <View style={styles.tabRow}>
          {PAPER_WIDTHS.map(({w, label}) => {
            const active = store.paperWidth === w;
            return (
              <TouchableOpacity
                key={w}
                style={[
                  styles.tab,
                  {borderColor: theme.border, backgroundColor: theme.surface},
                  active && styles.tabActive,
                ]}
                onPress={() => store.update({paperWidth: w})}>
                <Text style={[styles.tabLabel, {color: theme.textSecondary}, active && styles.tabLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Auto-print */}
      <View style={sectionStyle}>
        <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>Auto-print</Text>
        <View style={styles.switchRow}>
          <View style={{flex: 1}}>
            <Text style={[styles.switchLabel, {color: theme.textPrimary}]}>
              Print KOT automatically
            </Text>
            <Text style={[styles.switchHint, {color: theme.textSecondary}]}>
              Prints after every "Send KOT" tap
            </Text>
          </View>
          <Switch
            value={store.autoPrintKot}
            onValueChange={v => store.update({autoPrintKot: v})}
            trackColor={{true: '#0ea5e9'}}
          />
        </View>
        <View style={[styles.switchRow, {marginTop: 10}]}>
          <View style={{flex: 1}}>
            <Text style={[styles.switchLabel, {color: theme.textPrimary}]}>
              Print receipt automatically
            </Text>
            <Text style={[styles.switchHint, {color: theme.textSecondary}]}>
              Prints after payment is confirmed
            </Text>
          </View>
          <Switch
            value={store.autoPrintReceipt}
            onValueChange={v => store.update({autoPrintReceipt: v})}
            trackColor={{true: '#0ea5e9'}}
          />
        </View>
      </View>

      {/* Test print */}
      <TouchableOpacity
        style={[styles.testBtn, (!isConfigured || testing) && styles.testBtnDisabled]}
        disabled={!isConfigured || testing}
        onPress={handleTestPrint}>
        {testing
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.testBtnText}>🖨 Test print</Text>}
      </TouchableOpacity>

      {!isConfigured && (
        <Text style={[styles.notConfiguredHint, {color: theme.textMuted}]}>
          Configure and select a printer above to enable test print.
        </Text>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  content: {padding: 12, gap: 12, paddingBottom: 32},

  section: {borderRadius: 10, padding: 14, borderWidth: 1},
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  refreshBtn: {fontSize: 13, color: '#0ea5e9', fontWeight: '700'},
  scanningRow: {flexDirection: 'row', alignItems: 'center'},
  stopBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  stopBtnText: {fontSize: 12, color: '#dc2626', fontWeight: '700'},
  hint: {fontSize: 12, marginBottom: 10},
  emptyText: {fontSize: 13, textAlign: 'center', padding: 12},

  tabRow: {flexDirection: 'row', gap: 8},
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabActive: {backgroundColor: '#e0f2fe', borderColor: '#0ea5e9'},
  tabEmoji: {fontSize: 16, marginBottom: 2},
  tabLabel: {fontSize: 12, fontWeight: '600'},
  tabLabelActive: {color: '#075985'},

  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  deviceRowSelected: {borderColor: '#0ea5e9', backgroundColor: '#e0f2fe'},
  deviceName: {fontSize: 14, fontWeight: '600'},
  deviceNameSelected: {color: '#075985'},
  deviceMac: {fontSize: 11, marginTop: 2},
  checkmark: {fontSize: 18, color: '#0ea5e9', fontWeight: '700'},

  selectedInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  selectedInfoText: {fontSize: 12, color: '#15803d'},

  fieldLabel: {fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 4},
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#0ea5e9',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: {color: '#fff', fontWeight: '700'},

  switchRow: {flexDirection: 'row', alignItems: 'center'},
  switchLabel: {fontSize: 14, fontWeight: '600'},
  switchHint: {fontSize: 12, marginTop: 2},

  testBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  testBtnDisabled: {opacity: 0.4},
  testBtnText: {color: '#fff', fontWeight: '800', fontSize: 15},

  notConfiguredHint: {fontSize: 12, textAlign: 'center', marginTop: -4},

  systemIconWrap: {alignItems: 'center', paddingVertical: 8},
  systemIcon: {fontSize: 48},
  systemDesc: {fontSize: 13, lineHeight: 20, marginBottom: 12},
  systemDescBold: {fontWeight: '700'},
  systemFeatureList: {gap: 6, marginBottom: 12},
  systemFeature: {fontSize: 13, color: '#15803d'},

  subnetRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8},
  subnetInput: {flex: 1, marginBottom: 0},
  subnetSuffix: {fontSize: 12},

  progressWrap: {
    marginVertical: 8,
    borderRadius: 6,
    overflow: 'hidden',
    height: 20,
    justifyContent: 'center',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#0ea5e9',
    borderRadius: 6,
  },
  progressText: {fontSize: 11, textAlign: 'center', fontWeight: '600', zIndex: 1},
});
