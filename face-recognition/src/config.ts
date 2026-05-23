import type { ModelManifest, ModelReader } from './secure/modelIntegrity';
import type { Challenge } from './types';

/** Tunable decision thresholds. Defaults are conservative starting points and
 *  should be calibrated against a validation set (see PLAN.md Phase 4). */
export interface Thresholds {
  /** Minimum detector confidence to accept a face. */
  detectScore: number;
  /** Minimum fraction of frame area the face box must cover. */
  minFaceArea: number;
  /** Max |yaw|/|pitch|/|roll| in degrees for the quality gate. */
  maxYaw: number;
  maxPitch: number;
  maxRoll: number;
  /** Mean luma bounds (0..255). */
  minBrightness: number;
  maxBrightness: number;
  /** Variance-of-Laplacian sharpness floor (higher = sharper). */
  minSharpness: number;
  /**
   * Passive liveness: reject if spoof probability >= this.
   * Real faces typically score spoof ≈ 0.05–0.15 (i.e. live ≈ 0.85–0.95).
   * Printed photos / screen replays typically score spoof ≈ 0.85–0.99.
   * Default 0.5 = reject when model is ≥50% confident it is a spoof.
   * Never set below 0.3 in production — will reject legitimate live faces.
   */
  spoofReject: number;
  /** Cosine similarity required to declare a match. */
  matchCosine: number;
  /**
   * Number of good frames to sample liveness across before making a decision.
   * Scores are averaged — all N frames must be collected before pass/fail.
   * Default 4. Set to 1 to restore single-frame behaviour.
   */
  livenessFrames: number;
  /**
   * Normalised margin from each frame edge within which the face centre must
   * fall to pass the centering check. Default 0.10 → face centre accepted
   * anywhere in the middle 80 % of the frame (0.10 → 0.90 on both axes).
   * Increase toward 0.20 for a tighter center zone; decrease toward 0.05 to
   * accept faces that are slightly off-center.
   */
  centerMargin: number;
}

export interface FaceAuthConfig {
  /**
   * AWS endpoint that receives attendance batches and serves provisioned
   * templates. **Optional** — omit (or leave undefined) for a fully offline
   * deployment where `FaceAuth.enrollLocal()` is used for enrollment.
   * When absent, `provision()` and `syncNow()` are no-ops and the background
   * net-watcher is not started.
   */
  awsSyncUrl?: string;
  /**
   * Per-device bearer token issued during provisioning.
   * Required only when `awsSyncUrl` is provided.
   */
  deviceToken?: string;
  /**
   * Enable SDK debug logging to the native console (Metro / logcat / Xcode).
   * Set to `true` during development; leave `false` (default) in production
   * to keep the console clean.
   */
  debug?: boolean;
  /** Override any subset of thresholds. */
  thresholds?: Partial<Thresholds>;
  /** Which active challenges are allowed; one is picked at random per auth. */
  challenges?: Challenge[];
  /** Background sync cadence in ms (also fires on network reconnect). */
  syncIntervalMs?: number;
  /** Delete local attendance rows once the server acks them. */
  purgeAfterSync?: boolean;
  /** Max active-challenge duration before timeout (ms). */
  challengeTimeoutMs?: number;
  /** Secret driving the cancelable template transform (rotate to revoke).
   *  Defaults to the device hardware key if omitted. */
  cancelableKey?: string;
  /** Output dimensionality of the cancelable transform. Default 512. */
  cancelableDims?: number;
  /** Stable device identifier stamped onto attendance events. */
  deviceId?: string;
  /** Returns a fresh platform attestation token (Play Integrity / App Attest). */
  getAttestationToken?: () => Promise<string | null>;
  /** Bundled model manifest (e.g. require('../models/manifest.json')) verified
   *  at boot when `readModelBytes` is also supplied. */
  modelManifest?: ModelManifest;
  /** Host-supplied reader for a bundled model's bytes (platform file access).
   *  When provided alongside `modelManifest`, `init()` verifies every model's
   *  SHA-256 and throws if any has been tampered with. */
  readModelBytes?: ModelReader;
  /** Force re-provisioning when the last successful provision is older than
   *  this many ms. `FaceAuth.needsReprovision()` reflects it. Default: 7 days. */
  templateTtlMs?: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  detectScore: 0.8,
  minFaceArea: 0.4,
  maxYaw: 30,
  maxPitch: 50,
  maxRoll: 50,
  minBrightness: 50,
  maxBrightness: 230,
  minSharpness: 80,
  spoofReject: 0.5,
  matchCosine: 0.65,
  livenessFrames: 4,
  centerMargin: 0.10,
};

export const DEFAULT_CONFIG: {
  challenges: Challenge[];
  syncIntervalMs: number;
  purgeAfterSync: boolean;
  challengeTimeoutMs: number;
  templateTtlMs: number;
} = {
  challenges: ['blink', 'smile', 'turn_head'],
  syncIntervalMs: 5 * 60 * 1000,
  purgeAfterSync: true,
  challengeTimeoutMs: 10 * 60 * 1000,
  templateTtlMs: 7 * 24 * 60 * 60 * 1000,
};

export function resolveThresholds(overrides?: Partial<Thresholds>): Thresholds {
  return { ...DEFAULT_THRESHOLDS, ...(overrides ?? {}) };
}
