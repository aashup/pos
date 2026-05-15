import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import type { CodeType } from 'react-native-vision-camera';

interface Props {
  onScan: (value: string) => void;
  onClose: () => void;
  codeTypes?: CodeType[];
}

export function BarcodeScanner({ onScan, onClose, codeTypes = ['qr', 'ean-13', 'ean-8', 'code-128'] }: Props) {
  const device = useCameraDevice('back');
  const enabled = useRef(true);

  const codeScanner = useCodeScanner({
    codeTypes,
    onCodeScanned: (codes) => {
      if (!enabled.current || codes.length === 0) return;
      const value = codes[0].value;
      if (!value) return;
      enabled.current = false; // debounce — prevent double scan
      onScan(value);
    },
  });

  if (!device) {
    return (
      <View style={styles.overlay}>
        <Text style={styles.errorText}>No camera device found</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        codeScanner={codeScanner}
      />
      {/* Viewfinder overlay */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.finder} />
        <Text style={styles.hint}>Point at QR code or barcode</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  finder: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 12,
  },
  closeBtn: {
    marginTop: 24,
    backgroundColor: '#d97706',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});
