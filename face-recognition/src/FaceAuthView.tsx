import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat
} from 'react-native-vision-camera';

import { detectFace, type DetectorModels, type RgbFrame } from './detector';
import { useFrameSource } from './frameSource';
import { getConfig } from './runtime';
import { useFaceAuth } from './useFaceAuth';
import type { PipelineModels } from './pipeline';
import type { AuthMode, AuthResult, Challenge, Guidance } from './types';

/** Big, glanceable instruction for the current challenge / state. */
const CHALLENGE_PROMPT: Record<Challenge, { icon: string; title: string }> = {
  blink: { icon: '😉', title: 'Blink your eyes' },
  smile: { icon: '😊', title: 'Smile' },
  turn_head: { icon: '↔️', title: 'Turn your head' },
};

/** All TFLite models the view needs: detector + pipeline. */
export type FaceAuthModels = DetectorModels & PipelineModels;

export interface FaceAuthViewProps {
  mode: AuthMode;
  /** Required for `verify` (1:1). */
  personnelId?: string;
  /** TFLite models loaded by the host (e.g. via fast-tflite `useTensorflowModel`). */
  models: FaceAuthModels;
  /** Auth completed (success or failure). Attendance is recorded automatically. */
  onResult?: (result: AuthResult) => void;
  /** Live coaching messages (centering, lighting, challenge prompts). */
  onGuidance?: (g: Guidance) => void;
  /** Back/cancel pressed — host should dismiss the view. */
  onClose?: () => void;
  /** Auto-start the session on mount. Default true. */
  autoStart?: boolean;
  /** Optional style override for the camera container. */
  style?: object;
}

/**
 * Camera surface that runs a full authentication session. Each frame is
 * downsampled to RGB in a worklet (frameSource), handed to the JS thread where
 * BlazeFace + FaceMesh detect the face, and fed into the `useFaceAuth`
 * pipeline. Shows guidance and reports the result. No native code.
 */
export function FaceAuthView({
  mode,
  personnelId,
  models,
  onResult,
  onGuidance,
  onClose,
  autoStart = true,
  style,
}: FaceAuthViewProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  // 1. Ask for a specific resolution and FPS
  const format = useCameraFormat(device, [
    { videoResolution: '1080p' }, // Forces a sharp 1920x1080 resolution
    { fps: 30 }
  ]);
  const [hint, setHint] = useState<string>('Position your face in the frame');
  const [challenge, setChallenge] = useState<Challenge | undefined>();
  const [verifying, setVerifying] = useState(false);

  if (mode === 'verify' && !personnelId) {
    throw new Error('[offline-face-auth] verify mode requires a personnelId prop.');
  }

  const detectorModels: DetectorModels = useMemo(
    () => ({ blazeface: models.blazeface, faceMesh: models.faceMesh }),
    [models.blazeface, models.faceMesh],
  );
  const pipelineModels: PipelineModels = useMemo(
    () => ({ embedding: models.embedding, liveness: models.liveness }),
    [models.embedding, models.liveness],
  );

  // Only re-render when the guidance text actually changes (avoids a setState
  // on every processed frame, which thrashes React on the JS thread).
  const lastHintRef = useRef(hint);
  const lastChallengeRef = useRef<Challenge | undefined>(undefined);
  const handleGuidance = useCallback(
    (g: Guidance) => {
      if (g.message !== lastHintRef.current) {
        lastHintRef.current = g.message;
        setHint(g.message);
        setVerifying(g.message === 'Verifying…');
      }
      if (g.challenge !== lastChallengeRef.current) {
        lastChallengeRef.current = g.challenge;
        setChallenge(g.challenge);
      }
      onGuidance?.(g);
    },
    [onGuidance],
  );

  const { start, cancel, feed, active, stageRef } = useFaceAuth({
    mode,
    personnelId,
    models: pipelineModels,
    onResult,
    onGuidance: handleGuidance,
  });

  // JS-thread: detect on the downsampled frame, then feed the session. Face Mesh
  // (the heavy landmark model) only runs during the challenge/analyzing stages;
  // gating uses the cheap BlazeFace box alone, keeping the tracking loop fast.
  const onRgbFrame = useCallback(
    async (frame: RgbFrame) => {
      if (!active) return;
      const minScore = getConfig().thresholds.detectScore;
      const stage = stageRef.current;
      const withLandmarks = stage === 'challenge' || stage === 'analyzing';
      const face = await detectFace(frame, detectorModels, minScore, withLandmarks);
      await feed(frame, face ? [face] : []);
    },
    [active, feed, detectorModels, stageRef],
  );

  // No artificial throttle: the drop-if-busy guard already caps the rate at the
  // inference speed, and the lightweight tracking loop needs high fps to catch
  // a 100–150 ms blink.
  const { frameProcessor } = useFrameSource({ onRgbFrame, minIntervalMs: 0 });

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Start the session exactly once when the camera becomes available.
  const startedRef = useRef(false);
  useEffect(() => {
    if (autoStart && hasPermission && device && !startedRef.current) {
      startedRef.current = true;
      start();
    }
  }, [autoStart, hasPermission, device, start]);

  const handleBack = useCallback(() => {
    cancel();
    onClose?.();
  }, [cancel, onClose]);

  const BackButton = onClose ? (
    <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={12}>
      <Text style={styles.backText}>‹ Back</Text>
    </TouchableOpacity>
  ) : null;

  if (!hasPermission) {
    return (
      <View style={[styles.center, style]}>
        {BackButton}
        <Text style={styles.hint}>Camera permission required</Text>
      </View>
    );
  }
  if (device == null) {
    return (
      <View style={[styles.center, style]}>
        {BackButton}
        <Text style={styles.hint}>No front camera available</Text>
      </View>
    );
  }

  // Fail fast if init() was not called.
  getConfig();

  return (
    <View style={[styles.container, style]}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        fps={30}
        isActive={true}
        pixelFormat="yuv"
        frameProcessor={frameProcessor}
        // photoHdr={true}
        // videoHdr={true}
      />
      {BackButton}

      {/* Prominent centered prompt: the challenge instruction or "Verifying…" */}
      {(challenge || verifying) && (
        <View style={styles.promptCard} pointerEvents="none">
          {challenge && !verifying ? (
            <>
              <Text style={styles.promptIcon}>{CHALLENGE_PROMPT[challenge].icon}</Text>
              <Text style={styles.promptTitle}>{CHALLENGE_PROMPT[challenge].title}</Text>
              <Text style={styles.promptSub}>Hold still and follow the prompt</Text>
            </>
          ) : (
            <>
              <Text style={styles.promptIcon}>⏳</Text>
              <Text style={styles.promptTitle}>Verifying…</Text>
            </>
          )}
        </View>
      )}

      <View style={styles.hintBar} pointerEvents="none">
        <Text style={styles.hint}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 12,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  promptCard: {
    position: 'absolute',
    top: '18%',
    left: 24,
    right: 24,
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(14,165,233,0.92)',
  },
  promptIcon: { fontSize: 52, marginBottom: 6 },
  promptTitle: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  promptSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 6, textAlign: 'center' },
  hintBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hint: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
