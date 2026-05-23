import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

export default function App() {
  const [ready, setReady]   = useState(false);
  const [last, setLast]     = useState<AuthResult | null>(null);
  const [sync, setSync]     = useState<SyncStatus | null>(null);
  const [session, setSession] = useState<AuthMode | null>(null);

  // ── Enrollment dialog state ─────────────────────────────────────────────────
  const [enrollDialogVisible, setEnrollDialogVisible] = useState(false);
  const [enrollInput, setEnrollInput]                 = useState('');
  const [pendingEnrollId, setPendingEnrollId]         = useState('');

  const blazeface = useTensorflowModel(require('./assets/models/blazeface.tflite'));
  const faceMesh  = useTensorflowModel(require('./assets/models/face_mesh.tflite'));
  const facenet   = useTensorflowModel(require('./assets/models/facenet_512.tflite'));
  const spoof27   = useTensorflowModel(require('./assets/models/spoof_2_7.tflite'));
  const spoof40   = useTensorflowModel(require('./assets/models/spoof_4_0.tflite'));

  const loaded = [blazeface, faceMesh, facenet, spoof27, spoof40].every((m) => m.state === 'loaded');

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        await FaceAuth.init({ awsSyncUrl: AWS_URL, deviceToken: DEVICE_TOKEN, deviceId: 'demo-device-01', debug: false });
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
            blazeface:  blazeface.model as any,
            faceMesh:   faceMesh.model as any,
            embedding:  facenet.model as any,
            liveness0:  spoof27.model as any,
            liveness1:  spoof40.model as any,
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

  // ── Camera session (enroll / identify / verify) ─────────────────────────────
  if (session) {
    return (
      <FaceAuthView
        mode={session}
        models={models}
        onClose={() => setSession(null)}
        onResult={async (r) => {
          const prevSession = session;
          setSession(null);

          // ── Enroll: upload embedding with the name the user typed ────────────
          if (prevSession === 'enroll' && r.ok && r.embeddingB64) {
            try {
              await fetch(`${AWS_URL}/enroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personnelId: pendingEnrollId, embedding: r.embeddingB64 }),
              });
              Alert.alert('Enrolled ✓', `"${pendingEnrollId}" stored on server`);
            } catch (e: any) {
              Alert.alert('Upload failed', e?.message ?? 'network error');
            }
          }

          // ── Identify / Verify: popup with matched name or failure ─────────────
          if ((prevSession === 'identify' || prevSession === 'verify') && r.ok && r.personnelId) {
            Alert.alert(
              '✅ Match found',
              `Person: ${r.personnelId}\nScore: ${r.matchScore.toFixed(2)}`,
            );
          } else if ((prevSession === 'identify' || prevSession === 'verify') && !r.ok) {
            Alert.alert('❌ No match', `Reason: ${r.failureReason ?? 'unknown'}`);
          }

          setLast(r);
        }}
      />
    );
  }

  // ── Main screen ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* ── Enrollment name dialog ── */}
      <Modal
        visible={enrollDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEnrollDialogVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Enter Person ID / Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John Smith or emp-002"
              placeholderTextColor="#94a3b8"
              value={enrollInput}
              onChangeText={setEnrollInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                const id = enrollInput.trim();
                if (!id) return;
                setEnrollDialogVisible(false);
                setPendingEnrollId(id);
                setSession('enroll');
              }}
            />
            <View style={styles.dialogBtns}>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogBtnCancel]}
                onPress={() => setEnrollDialogVisible(false)}>
                <Text style={styles.dialogBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, styles.dialogBtnOk]}
                onPress={() => {
                  const id = enrollInput.trim();
                  if (!id) return;
                  setEnrollDialogVisible(false);
                  setPendingEnrollId(id);
                  setSession('enroll');
                }}>
                <Text style={styles.dialogBtnText}>Enroll</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Text style={styles.title}>Offline Face Auth — Demo</Text>

      {/* 1. Enroll — shows name dialog first */}
      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          setEnrollInput('');
          setEnrollDialogVisible(true);
        }}>
        <Text style={styles.btnText}>1. Enroll my face → server</Text>
      </TouchableOpacity>

      {/* 2. Provision */}
      <TouchableOpacity
        style={styles.btn}
        onPress={async () => {
          const r = await FaceAuth.provision();
          setLast(null);
          Alert.alert(r.ok ? `Provisioned ${r.count} templates` : `Provision failed`, r.error ?? '');
        }}>
        <Text style={styles.btnText}>2. Provision templates (online)</Text>
      </TouchableOpacity>

      {/* 3. Authenticate */}
      <TouchableOpacity style={styles.btn} onPress={() => setSession('identify')}>
        <Text style={styles.btnText}>3. Authenticate (offline)</Text>
      </TouchableOpacity>

      {/* 4. Sync attendance */}
      <TouchableOpacity style={styles.btn} onPress={() => FaceAuth.syncNow()}>
        <Text style={styles.btnText}>4. Sync attendance to server</Text>
      </TouchableOpacity>

      {/* Status panel */}
      <View style={styles.panel}>
        <Text style={styles.text}>Templates: {FaceAuth.getTemplateCount()}</Text>
        <Text style={styles.text}>Pending events: {sync?.pendingCount ?? 0}</Text>
        <Text style={styles.text}>Sync: {sync?.state ?? 'idle'}</Text>
        {last && (
          <Text style={styles.text}>
            Last:{' '}
            {last.ok
              ? `✅ ${last.personnelId ?? 'enrolled'}`
              : `❌ ${last.failureReason}`}
            {' · '}match {last.matchScore.toFixed(2)} · live {last.livenessScore.toFixed(2)}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, padding: 24, gap: 12, backgroundColor: '#0f172a' },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  title:           { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  btn:             { backgroundColor: '#0ea5e9', padding: 16, borderRadius: 10 },
  btnText:         { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  panel:           { marginTop: 24, gap: 6 },
  text:            { color: '#e2e8f0', fontSize: 15 },
  // ── Enrollment dialog ──────────────────────────────────────────────────────
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 32 },
  dialog:          { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, gap: 16 },
  dialogTitle:     { color: '#fff', fontSize: 18, fontWeight: '700' },
  input:           {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dialogBtns:      { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  dialogBtn:       { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  dialogBtnCancel: { backgroundColor: '#475569' },
  dialogBtnOk:     { backgroundColor: '#0ea5e9' },
  dialogBtnText:   { color: '#fff', fontWeight: '600', fontSize: 15 },
});
