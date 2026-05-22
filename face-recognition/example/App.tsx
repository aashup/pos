import React, { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import {
  FaceAuth,
  FaceAuthView,
  type AuthMode,
  type AuthResult,
  type FaceAuthModels,
  type SyncStatus,
} from 'react-native-offline-face-auth';

/**
 * Reference host. Full offline loop against the local mock server:
 *   enroll (capture template → POST /enroll) → provision → identify → sync.
 *
 * Wire the device to the mock server first:
 *   node server/index.js
 *   adb reverse tcp:8080 tcp:8080
 *
 * Models are the bundled open-source .tflite (BlazeFace, Face Mesh, FaceNet-512,
 * two Silent-Face spoof scales) loaded via fast-tflite on the CPU.
 */

const AWS_URL = 'http://localhost:8080';
const DEVICE_TOKEN = 'demo-device-token';
const PERSON_ID = 'emp-1';

export default function App() {
  const [ready, setReady] = useState(false);
  const [last, setLast] = useState<AuthResult | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [session, setSession] = useState<AuthMode | null>(null);

  const blazeface = useTensorflowModel(require('./assets/models/blazeface.tflite'));
  const faceMesh = useTensorflowModel(require('./assets/models/face_mesh.tflite'));
  const facenet = useTensorflowModel(require('./assets/models/facenet_512.tflite'));
  const spoof27 = useTensorflowModel(require('./assets/models/spoof_2_7.tflite'));
  const spoof40 = useTensorflowModel(require('./assets/models/spoof_4_0.tflite'));

  const loaded = [blazeface, faceMesh, facenet, spoof27, spoof40].every((m) => m.state === 'loaded');

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        await FaceAuth.init({ awsSyncUrl: AWS_URL, deviceToken: DEVICE_TOKEN, deviceId: 'demo-device-01' });
        unsub = FaceAuth.onSyncStatus(setSync);
        setReady(true);
      } catch (e: any) {
        console.error('FaceAuth.init failed:', e?.message ?? String(e), e?.stack);
      }
    })();
    return () => {
      unsub();
      void FaceAuth.dispose();
    };
  }, []);

  const models: FaceAuthModels | null = useMemo(
    () =>
      loaded
        ? {
            blazeface: blazeface.model as any,
            faceMesh: faceMesh.model as any,
            embedding: facenet.model as any,
            liveness: { branches: [spoof27.model as any, spoof40.model as any] },
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded],
  );

  if (!ready || !models) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.text}>Loading models…</Text>
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <FaceAuthView
        mode={session}
        personnelId={session === 'verify' ? PERSON_ID : undefined}
        models={models}
        onClose={() => setSession(null)}
        onResult={async (r) => {
          setSession(null);
          if (session === 'enroll' && r.ok && r.embeddingB64) {
            try {
              await fetch(`${AWS_URL}/enroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personnelId: PERSON_ID, embedding: r.embeddingB64 }),
              });
              Alert.alert('Enrolled', `Template for ${PERSON_ID} sent to server`);
            } catch (e: any) {
              Alert.alert('Enroll upload failed', e?.message ?? 'network error');
            }
          }
          setLast(r);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Offline Face Auth — Demo</Text>

      <TouchableOpacity style={styles.btn} onPress={() => setSession('enroll')}>
        <Text style={styles.btnText}>1. Enroll my face → server</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={async () => {
          const r = await FaceAuth.provision();
          setLast(null);
          Alert.alert(r.ok ? `Provisioned ${r.count} templates` : `Provision failed`, r.error ?? '');
        }}>
        <Text style={styles.btnText}>2. Provision templates (online)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={() => setSession('identify')}>
        <Text style={styles.btnText}>3. Authenticate (offline)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={() => FaceAuth.syncNow()}>
        <Text style={styles.btnText}>4. Sync attendance to server</Text>
      </TouchableOpacity>

      <View style={styles.panel}>
        <Text style={styles.text}>Templates: {FaceAuth.getTemplateCount()}</Text>
        <Text style={styles.text}>Pending events: {sync?.pendingCount ?? 0}</Text>
        <Text style={styles.text}>Sync: {sync?.state ?? 'idle'}</Text>
        {last && (
          <Text style={styles.text}>
            Last: {last.ok ? `OK ${last.personnelId ?? 'enrolled'}` : `FAIL ${last.failureReason}`} · match{' '}
            {last.matchScore.toFixed(2)} · live {last.livenessScore.toFixed(2)}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  btn: { backgroundColor: '#0ea5e9', padding: 16, borderRadius: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  panel: { marginTop: 24, gap: 6 },
  text: { color: '#e2e8f0', fontSize: 15 },
});
