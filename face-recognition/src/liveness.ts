import { expandBox, resampleToSquare, type RgbFrame, type TfliteModel } from './detector';
import type { BoundingBox, DetectedFace } from './types';

/**
 * Passive liveness via Silent-Face-Anti-Spoofing (MiniFASNet).
 *
 * The reference model is an ensemble of two MobileNetV2-class branches that each
 * see a differently-cropped patch around the face (a tight crop and a context
 * crop, controlled by a "scale" factor). We average their real-face
 * probabilities. This runs on a single RGB frame — no user action needed — and
 * is the fast first line of defense against printed photos and screen replays.
 */

const INPUT = 80;

/** Bounding-box expansion each anti-spoof branch expects, matching the bundled
 *  Silent-Face models `spoof_2_7.tflite` / `spoof_4_0.tflite`. */
const SCALES = [2.7, 4.0] as const;

export interface LivenessModels {
  /** One model per scale in SCALES (same order). */
  branches: TfliteModel[];
}

export interface LivenessResult {
  /** Probability the face is a real, live presentation (0..1). */
  liveScore: number;
  /** Probability it is a spoof (1 - liveScore). */
  spoofScore: number;
  /** True when spoofScore is below the configured reject threshold. */
  isLive: boolean;
}

/** Grow the detector box by `scale` about its center, clamped to the frame. */
export function scaleBox(box: BoundingBox, scale: number): BoundingBox {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const w = Math.min(1, box.width * scale);
  const h = Math.min(1, box.height * scale);
  return {
    x: Math.max(0, Math.min(1 - w, cx - w / 2)),
    y: Math.max(0, Math.min(1 - h, cy - h / 2)),
    width: w,
    height: h,
  };
}

/**
 * MiniFASNet output is a 3-logit softmax: [fake_2d, real, fake_3d-ish].
 * Index 1 is the live class. We softmax then take the live probability.
 */
export function decodeLiveProb(logits: Float32Array): number {
  if (logits.length < 2) return 0;
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i]!);
  let sum = 0;
  const exps = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    exps[i] = Math.exp(logits[i]! - max);
    sum += exps[i]!;
  }
  return sum > 0 ? exps[1]! / sum : 0;
}

/**
 * Run the passive-liveness ensemble for one frame.
 * @param spoofReject reject threshold from config.thresholds.spoofReject
 */
export async function checkLiveness(
  frame: RgbFrame,
  face: DetectedFace,
  models: LivenessModels,
  spoofReject: number,
): Promise<LivenessResult> {
  const n = Math.min(models.branches.length, SCALES.length);
  let liveSum = 0;
  for (let i = 0; i < n; i++) {
    const crop = scaleBox(expandBox(face.box, 0.1), SCALES[i]!);
    const input = resampleToSquare(frame, crop, INPUT); // 0..1 RGB
    const logits = (await models.branches[i]!.run([input]))[0] as Float32Array;
    liveSum += decodeLiveProb(logits);
  }
  const liveScore = n > 0 ? liveSum / n : 0;
  const spoofScore = 1 - liveScore;
  return {
    liveScore,
    spoofScore,
    isLive: spoofScore < spoofReject,
  };
}
