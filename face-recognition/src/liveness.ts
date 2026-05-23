import { expandBox, type RgbFrame, type TfliteModel } from './detector';
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
 * Resample a face crop from an RgbFrame and apply MiniFASNet preprocessing.
 *
 * MiniFASNet was trained with:
 *   transforms.ToTensor()                       → /255
 *   transforms.Normalize(mean=[0.406,0.456,0.485], std=[0.225,0.224,0.229])
 * where means/stds are in BGR order (OpenCV default).
 *
 * Our RgbFrame is in RGB order so we swap channels while normalising.
 */
function resampleLiveness(frame: RgbFrame, box: BoundingBox, size: number): Float32Array {
  const out  = new Float32Array(size * size * 3);
  const sx0  = box.x      * frame.width;
  const sy0  = box.y      * frame.height;
  const sw   = box.width  * frame.width;
  const sh   = box.height * frame.height;
  for (let y = 0; y < size; y++) {
    const fy = Math.min(frame.height - 1, Math.floor(sy0 + (y / size) * sh));
    for (let x = 0; x < size; x++) {
      const fx  = Math.min(frame.width - 1, Math.floor(sx0 + (x / size) * sw));
      const si  = (fy * frame.width + fx) * 3;
      const di  = (y * size + x) * 3;
      // RGB → BGR + ImageNet normalisation
      const r = frame.data[si]!     / 255;
      const g = frame.data[si + 1]! / 255;
      const b = frame.data[si + 2]! / 255;
      out[di]     = (b - 0.406) / 0.225;   // B  mean=0.406  std=0.225
      out[di + 1] = (g - 0.456) / 0.224;   // G  mean=0.456  std=0.224
      out[di + 2] = (r - 0.485) / 0.229;   // R  mean=0.485  std=0.229
    }
  }
  return out;
}

/**
 * Run the passive-liveness ensemble for one frame.
 *
 * Uses a SQUARE crop centred on the face (max(w,h)) so portrait and landscape
 * faces produce undistorted inputs. Each branch scales that square by its factor
 * to control how much background context the model sees.
 *
 * @param spoofReject reject threshold from config.thresholds.spoofReject
 */
export async function checkLiveness(
  frame: RgbFrame,
  face: DetectedFace,
  models: LivenessModels,
  spoofReject: number,
): Promise<LivenessResult> {
  // Build a square base box centred on the face (avoids aspect-ratio distortion).
  const faceSize = Math.max(face.box.width, face.box.height);
  const faceCx   = face.box.x + face.box.width  / 2;
  const faceCy   = face.box.y + face.box.height / 2;
  const squareBox: BoundingBox = {
    x:      Math.max(0, faceCx - faceSize / 2),
    y:      Math.max(0, faceCy - faceSize / 2),
    width:  Math.min(1, faceSize),
    height: Math.min(1, faceSize),
  };
  const expanded = expandBox(squareBox, 0.1);

  const n = Math.min(models.branches.length, SCALES.length);
  let liveSum = 0;
  for (let i = 0; i < n; i++) {
    const crop  = scaleBox(expanded, SCALES[i]!);
    const input = resampleLiveness(frame, crop, INPUT);
    const logits = (await models.branches[i]!.run([input]))[0] as Float32Array;
    liveSum += decodeLiveProb(logits);
  }
  const liveScore  = n > 0 ? liveSum / n : 0;
  const spoofScore = 1 - liveScore;
  console.log("Livescore " , liveScore, n, liveSum)
  return {
    liveScore,
    spoofScore,
    isLive: spoofScore < spoofReject,
  };
}
