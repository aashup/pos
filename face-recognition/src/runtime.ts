import {
  DEFAULT_CONFIG,
  resolveThresholds,
  type FaceAuthConfig,
  type Thresholds,
} from './config';
import type { Challenge } from './types';

/** Fully-resolved runtime configuration, available after `init()`. */
export interface ResolvedConfig {
  awsSyncUrl: string;
  deviceToken: string;
  thresholds: Thresholds;
  challenges: Challenge[];
  syncIntervalMs: number;
  purgeAfterSync: boolean;
  challengeTimeoutMs: number;
  templateTtlMs: number;
}

let current: ResolvedConfig | null = null;

export function setConfig(config: FaceAuthConfig): ResolvedConfig {
  current = {
    awsSyncUrl: config.awsSyncUrl,
    deviceToken: config.deviceToken,
    thresholds: resolveThresholds(config.thresholds),
    challenges: config.challenges ?? DEFAULT_CONFIG.challenges,
    syncIntervalMs: config.syncIntervalMs ?? DEFAULT_CONFIG.syncIntervalMs,
    purgeAfterSync: config.purgeAfterSync ?? DEFAULT_CONFIG.purgeAfterSync,
    challengeTimeoutMs: config.challengeTimeoutMs ?? DEFAULT_CONFIG.challengeTimeoutMs,
    templateTtlMs: config.templateTtlMs ?? DEFAULT_CONFIG.templateTtlMs,
  };
  return current;
}

/** Merge server-provisioned threshold overrides into the live config. */
export function updateThresholds(partial: Partial<Thresholds>): void {
  if (!current) {
    throw new Error('[offline-face-auth] not initialized — cannot update thresholds.');
  }
  current.thresholds = { ...current.thresholds, ...partial };
}

/** Throws if `FaceAuth.init()` has not been called yet. */
export function getConfig(): ResolvedConfig {
  if (!current) {
    throw new Error(
      '[offline-face-auth] not initialized — call FaceAuth.init(config) before use.',
    );
  }
  return current;
}

export function isInitialized(): boolean {
  return current !== null;
}

export function clearConfig(): void {
  current = null;
}
