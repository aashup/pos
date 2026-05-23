import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
} from 'react-native-vision-camera';
import { useSharedValue } from 'react-native-worklets-core';

import { estimateHeadPose } from './detector';
import { useFrameSource, type FrameSourceModels, type WorkletFrameResult, type CenteringStatus } from './frameSource';
import { getConfig } from './runtime';
import { resolveThresholds } from './config';
import { useFaceAuth } from './useFaceAuth';
import type { PipelineModels } from './pipeline';
import type { AuthMode, AuthResult, Challenge, DetectedFace, Guidance, Point } from './types';
import { FaceMaskOverlay } from './FaceMaskOverlay';
import {
  startPeriodicCapture,
  stopPeriodicCapture,
  saveModelDebugFrame,
} from './debug';

/** Big, glanceable instruction for the current challenge / state. */
const CHALLENGE_PROMPT: Record<Challenge, { icon: string; title: string }> = {
  blink: { icon: '😉', title: 'Blink your eyes' },
  smile: { icon: '😊', title: 'Smile' },
  turn_head: { icon: '↔️', title: 'Turn your head' },
};

/** All TFLite models the view needs — matches FrameSourceModels exactly. */
export type FaceAuthModels = FrameSourceModels;

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
  const format = useCameraFormat(device, [
    { videoResolution: { width: 720, height: 1280 } },
    { fps: 30 },
  ]);

  // Debug: camera ref enables takePhoto() for periodic frame saves.
  const cameraRef = useRef<Camera>(null);
  const DEBUG_INTERVAL_MS = 5_000;

  const [hint, setHint] = useState<string>('Position your face in the frame');
  const [challenge, setChallenge] = useState<Challenge | undefined>();
  const [verifying, setVerifying] = useState(false);

  // Centering overlay state — driven by worklet thread via onCentering callback.
  const [faceCentered, setFaceCentered] = useState<boolean | null>(null);
  const [facePos, setFacePos] = useState<{ cx: number; cy: number } | null>(null);

  if (mode === 'verify' && !personnelId) {
    throw new Error('[offline-face-auth] verify mode requires a personnelId prop.');
  }

  const pipelineModels: PipelineModels = useMemo(
    () => ({
      embedding: models.embedding,
      liveness: { branches: [models.liveness0, models.liveness1] },
    }),
    [models.embedding, models.liveness0, models.liveness1],
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

  // SharedValue flipped to true when pipeline enters 'analyzing' stage so the
  // worklet runs FaceNet only on the frames where an embedding is needed.
  const needsEmbedding = useSharedValue(false);

  // Wrap handleGuidance: flip needsEmbedding when the 'Verifying…' message
  // appears (that message is only shown in the 'analyzing' stage). This must
  // be defined BEFORE useFaceAuth so it can be passed as onGuidance.
  const handleGuidanceWithEmbedFlag = useCallback(
    (g: Guidance) => {
      // 'Verifying…' is the sole message emitted by the analyzing stage.
      needsEmbedding.value = g.message === 'Verifying…';
      handleGuidance(g);
    },
    [needsEmbedding, handleGuidance],
  );

  const { start, cancel, feed, active, stageRef } = useFaceAuth({
    mode,
    personnelId,
    models: pipelineModels,
    onResult,
    onGuidance: handleGuidanceWithEmbedFlag,
  });

  // DEBUG — log raw liveness tensor once per session (first analyzing frame).
  // Shows: tensor length per branch, all raw values, which index is largest.
  // Remove once liveness class-index and normalisation are confirmed correct.
  const livenessRawLoggedRef = useRef(false);

  // Convert WorkletFrameResult → DetectedFace + PrecomputedFrameData, then
  // advance the pipeline. All TFLite inference already happened in the worklet.
  const onFrameResult = useCallback(
    async (result: WorkletFrameResult) => {
      if (!active) return;

      if (!result.detected) {
        await feed(null, []);
        return;
      }

      // DEBUG: log raw liveness tensor once when we first enter analyzing stage.
      if (__DEV__ && !livenessRawLoggedRef.current && stageRef.current === 'analyzing') {
        livenessRawLoggedRef.current = true;
        const sep = result.livenessRaw.indexOf(-1);
        const b0  = sep >= 0 ? result.livenessRaw.slice(0, sep)       : result.livenessRaw;
        const b1  = sep >= 0 ? result.livenessRaw.slice(sep + 1)      : [];
        const fmt = (arr: number[]) =>
          arr.map((v, i) => `[${i}]=${v.toFixed(4)}`).join('  ');
        console.log('[LivenessDebug] branch0 raw values:', fmt(b0));
        console.log('[LivenessDebug] branch1 raw values:', fmt(b1));
        console.log(
          '[LivenessDebug] interpretation: currently reading index 1 as live.',
          `branch0 idx0=${b0[0]?.toFixed(4)} idx1=${b0[1]?.toFixed(4)} idx2=${b0[2]?.toFixed(4) ?? 'N/A'}`,
        );
      }

      // Reconstruct Point[] landmarks from flat [x0,y0,x1,y1,...] array.
      const lms: Point[] = [];
      for (let i = 0; i + 1 < result.landmarks.length; i += 2) {
        lms.push({ x: result.landmarks[i]!, y: result.landmarks[i + 1]! });
      }

      const headPose = estimateHeadPose(lms);

      const face: DetectedFace = {
        box: {
          x: result.bbox[0],
          y: result.bbox[1],
          width: result.bbox[2],
          height: result.bbox[3],
        },
        score: result.bbox[4],
        landmarks: lms,
        headPose,
      };
      await feed(null, [face], {
        brightness: result.brightness,
        livenessScore: result.livenessScore,
        embedding: result.embedding ? new Float32Array(result.embedding) : null,
      });
    },
    [active, feed, stageRef, livenessRawLoggedRef],
  );

  // Resolve config once per render to get the current centerMargin.
  const cfg        = getConfig();
  const thresholds = resolveThresholds(cfg.thresholds);

  // Centering callback — fired from the worklet thread (via useRunOnJS) only
  // when the centering status or arrow direction actually changes, so the main
  // thread is never blocked on per-frame computations.
  const handleCentering = useCallback((s: CenteringStatus) => {
    if (!s.detected) {
      setFaceCentered(null);
      setFacePos(null);
    } else {
      setFaceCentered(s.centered);
      setFacePos({ cx: s.cx, cy: s.cy });
    }
  }, []);

  const { frameProcessor, triggerDebugCapture } = useFrameSource({
    models,
    onFrameResult,
    minIntervalMs: 0,   // isBusy guard throttles to inference speed
    needsEmbedding,
    onModelDebug: __DEV__ ? saveModelDebugFrame : undefined,
    onCentering: handleCentering,
    centerMargin: thresholds.centerMargin,
  });

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

  // ── Debug: every DEBUG_INTERVAL_MS — save a camera JPEG + model-input BMP ──
  // useEffect(() => {
  //   if (!__DEV__) return;
  //   if (active) {
  //     startPeriodicCapture(cameraRef, DEBUG_INTERVAL_MS);
  //     const t = setInterval(() => triggerDebugCapture(), DEBUG_INTERVAL_MS);
  //     return () => { clearInterval(t); stopPeriodicCapture(); };
  //   } else {
  //     stopPeriodicCapture();
  //   }
  //   return () => stopPeriodicCapture();
  // }, [active, triggerDebugCapture]);

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

  return (
    <View style={[styles.container, style]}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        fps={30}
        isActive={true}
        photo={true}
        frameProcessor={frameProcessor}
      />

      {BackButton}
      <FaceMaskOverlay centered={faceCentered} facePos={facePos} />
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
