import type { FaceAuthConfig } from './config';
import { getOrCreateKey } from './secure/keystore';
import { transform, type CancelableParams } from './secure/cancelable';
import {
  append,
  openAuditLog,
  pendingCount,
  type AttendanceEvent,
} from './secure/auditLog';
import { verifyModels } from './secure/modelIntegrity';
import { count as templateCount, openTemplateStore, upsertPersonnel } from './secure/templateStore';
import { base64ToFloat32 } from './sync/http';
import { syncAttendance } from './sync/attendanceSync';
import {
  getCachedManifest,
  getLastProvisionedAt,
  provision as provisionRoster,
  type ProvisioningResult,
} from './sync/provisioning';
import { startNetWatcher, type NetWatcher } from './sync/netStatus';
import {
  clearConfig,
  getConfig,
  isInitialized,
  setConfig,
  type ResolvedConfig,
} from './runtime';
import type { AuthResult, SyncStatus } from './types';

/**
 * Top-level SDK runtime. Owns store lifecycles, the network watcher, attendance
 * recording, and the AWS sync/purge loop. This is the object the host app talks
 * to; `FaceAuthView` / `useFaceAuth` use the same singletons under the hood.
 */

let watcher: NetWatcher | null = null;
let cancelable: CancelableParams | null = null;
let deviceId = 'unknown-device';
let getAttestationToken: (() => Promise<string | null>) | undefined;

let syncStatus: SyncStatus = { state: 'idle', pendingCount: 0 };
const statusSubs = new Set<(s: SyncStatus) => void>();

function emitStatus(patch: Partial<SyncStatus>): void {
  syncStatus = { ...syncStatus, ...patch, pendingCount: pendingCount() };
  for (const cb of statusSubs) cb(syncStatus);
}

async function init(config: FaceAuthConfig): Promise<void> {
  const resolved = setConfig(config);
  deviceId = config.deviceId ?? 'unknown-device';
  getAttestationToken = config.getAttestationToken;

  // Hardware-backed key seeds both encrypted stores + the default cancelable key.
  const dek = await getOrCreateKey();
  cancelable = {
    key: config.cancelableKey ?? dek,
    outputDims: config.cancelableDims ?? 512,
  };

  await openTemplateStore();
  await openAuditLog();

  // Boot-time model integrity gate (high-assurance): if the host can read the
  // bundled model bytes, verify every .tflite SHA-256 against the manifest and
  // refuse to run on tamper. Prefer the server-signed manifest cached during a
  // prior provision, falling back to the bundled one.
  if (config.readModelBytes && (config.modelManifest || getCachedManifest())) {
    const manifest = getCachedManifest() ?? config.modelManifest!;
    const result = await verifyModels(manifest, config.readModelBytes);
    if (!result.ok) {
      throw new Error(
        `[offline-face-auth] model integrity check failed: ${result.failures.join(', ')}`,
      );
    }
  }

  // Only start the net watcher when a sync URL is configured. In fully-offline
  // (local-enrollment) mode there is nothing to sync to, so skip it entirely.
  if (resolved.awsSyncUrl) {
    watcher = startNetWatcher({
      intervalMs: resolved.syncIntervalMs,
      onReconnect: () => {
        void syncNow();
      },
    });
  }

  emitStatus({ state: 'idle' });
}

/**
 * Pull the template roster from the server (online only). Incremental by
 * default; pass `{ full: true }` to ignore the stored cursor.
 *
 * Returns `{ ok: false, count: 0, error: 'no server configured' }` immediately
 * when `awsSyncUrl` was not set in `FaceAuth.init()` (offline-only mode).
 */
async function provision(opts: { full?: boolean } = {}): Promise<ProvisioningResult> {
  const cfg = requireReady();
  if (!cfg.awsSyncUrl || !cfg.deviceToken) {
    return { ok: false, count: 0, error: 'no server configured — set awsSyncUrl + deviceToken in FaceAuth.init()' };
  }
  return provisionRoster({
    awsSyncUrl:          cfg.awsSyncUrl,
    deviceToken:         cfg.deviceToken,
    cancelable:          cancelable!,
    getAttestationToken,
    forceFull:           opts.full,
  });
}

/** True when templates were never provisioned or are older than the TTL. */
function needsReprovision(): boolean {
  const cfg = requireReady();
  const last = getLastProvisionedAt();
  return last === 0 || Date.now() - last > cfg.templateTtlMs;
}

/**
 * Enroll one or more face embeddings locally — **no server required**.
 *
 * Pass the base64 embedding(s) returned in `AuthResult.embeddingB64` from
 * `FaceAuthView` in `enroll` mode. The cancelable transform is applied before
 * storage so the raw biometric never persists to disk.
 *
 * Calling this multiple times for the same `personnelId` **replaces** all
 * previous templates for that person (pass all embeddings at once to store
 * a multi-shot roster). The matcher automatically scores every template and
 * returns the best match, so more templates = more robust identification.
 *
 * @example
 * // After collecting 3 captures in the example app:
 * await FaceAuth.enrollLocal('Alice', [emb1, emb2, emb3]);
 */
async function enrollLocal(personnelId: string, embeddingB64s: string[]): Promise<void> {
  if (!cancelable) throw new Error('[offline-face-auth] not initialized — call FaceAuth.init() first');
  if (!personnelId.trim()) throw new Error('[offline-face-auth] personnelId must be non-empty');
  if (embeddingB64s.length === 0) throw new Error('[offline-face-auth] at least one embedding required');

  const embeddings = embeddingB64s.map((b64) => transform(base64ToFloat32(b64), cancelable!));
  upsertPersonnel(personnelId, embeddings);
}

/** The cancelable transform bound to this device — apply to a probe before matching. */
function probeTransform(embedding: Float32Array): Float32Array {
  if (!cancelable) throw new Error('[offline-face-auth] not initialized');
  return transform(embedding, cancelable);
}

/** Persist one auth attempt as a signed, chained attendance event. */
function recordAttendance(result: AuthResult): void {
  requireReady();
  const event: AttendanceEvent = {
    id: `${deviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    personnelId: result.personnelId,
    ok: result.ok,
    matchScore: result.matchScore,
    livenessScore: result.livenessScore,
    challengePassed: result.challengePassed,
    failureReason: result.failureReason,
    deviceId,
  };
  append(event);
  emitStatus({});
}

/**
 * Flush queued attendance events to AWS, purging acked rows.
 * Silent no-op when `awsSyncUrl` was not configured (offline-only mode).
 */
async function syncNow(): Promise<void> {
  const cfg = requireReady();
  if (!cfg.awsSyncUrl || !cfg.deviceToken) return; // offline-only mode — nothing to sync
  emitStatus({ state: 'syncing' });
  const outcome = await syncAttendance({
    awsSyncUrl:     cfg.awsSyncUrl,
    deviceToken:    cfg.deviceToken,
    purgeAfterSync: cfg.purgeAfterSync,
  });
  emitStatus(
    outcome.ok
      ? { state: 'idle', lastSyncAt: Date.now(), lastError: undefined }
      : { state: 'error', lastError: outcome.error },
  );
}

function getPendingCount(): number {
  return pendingCount();
}

function getTemplateCount(): number {
  return templateCount();
}

function onSyncStatus(cb: (s: SyncStatus) => void): () => void {
  statusSubs.add(cb);
  cb(syncStatus);
  return () => statusSubs.delete(cb);
}

async function dispose(): Promise<void> {
  watcher?.stop();
  watcher = null;
  cancelable = null;
  statusSubs.clear();
  clearConfig();
}

function requireReady(): ResolvedConfig {
  const cfg = getConfig();
  if (!cancelable) throw new Error('[offline-face-auth] not initialized');
  return cfg;
}

export const FaceAuth = {
  init,
  isInitialized,
  /** Store face template(s) directly on-device — no server needed. */
  enrollLocal,
  provision,
  needsReprovision,
  recordAttendance,
  probeTransform,
  syncNow,
  getPendingCount,
  getTemplateCount,
  onSyncStatus,
  dispose,
};
