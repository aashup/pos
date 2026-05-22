import type {
  BoundingBox,
  DetectedFace,
  HeadPose,
  Point,
} from './types';

/**
 * On-device face detection + landmarks using open-source TFLite models
 * (BlazeFace for the bounding box, MediaPipe Face Mesh for 468 landmarks),
 * run through react-native-fast-tflite on the XNNPACK CPU delegate.
 *
 * This module is platform-agnostic TS. The raw tensor I/O is performed by the
 * loaded `TensorflowModel` objects which are created in the worklet/native
 * frame-processor layer; here we own preprocessing, output decoding, and the
 * geometry helpers (head pose, landmark subsets) that the rest of the package
 * consumes. Keeping decode logic in JS means it is identical on Android + iOS.
 */

type Tensor = Float32Array | Int32Array | Uint8Array;

/** Minimal shape of a react-native-fast-tflite model we depend on.
 *  `run` dispatches inference to fast-tflite's native background thread pool
 *  (off the JS thread); `runSync` blocks the caller. We prefer `run`. */
export interface TfliteModel {
  run(inputs: Tensor[]): Promise<Tensor[]>;
  runSync(inputs: Tensor[]): Tensor[];
}

/** Frame pixels handed to the detector: tightly-packed RGB, row-major. */
export interface RgbFrame {
  data: Uint8Array; // length = width * height * 3
  width: number;
  height: number;
}

export interface DetectorModels {
  blazeface: TfliteModel;
  faceMesh: TfliteModel;
}

const BLAZEFACE_INPUT = 128;
const FACEMESH_INPUT = 192;

/** Face Mesh landmark indices we rely on downstream (gate + challenges). */
export const LANDMARK = {
  leftEye: [33, 160, 158, 133, 153, 144], // EAR ring (outer→inner)
  rightEye: [362, 385, 387, 263, 373, 380],
  mouthLeft: 61,
  mouthRight: 291,
  mouthTop: 13,
  mouthBottom: 14,
  noseTip: 1,
  chin: 152,
  leftCheek: 234,
  rightCheek: 454,
  foreheadTop: 10,
} as const;

/** Bilinear-free nearest resample of an RgbFrame region into a normalized
 *  Float32Array (0..1), HWC layout, for a square model input. */
export function resampleToSquare(
  frame: RgbFrame,
  box: BoundingBox,
  size: number,
): Float32Array {
  const out = new Float32Array(size * size * 3);
  const sx0 = box.x * frame.width;
  const sy0 = box.y * frame.height;
  const sw = box.width * frame.width;
  const sh = box.height * frame.height;
  for (let y = 0; y < size; y++) {
    const fy = Math.min(frame.height - 1, Math.floor(sy0 + (y / size) * sh));
    for (let x = 0; x < size; x++) {
      const fx = Math.min(frame.width - 1, Math.floor(sx0 + (x / size) * sw));
      const src = (fy * frame.width + fx) * 3;
      const dst = (y * size + x) * 3;
      out[dst] = frame.data[src]! / 255;
      out[dst + 1] = frame.data[src + 1]! / 255;
      out[dst + 2] = frame.data[src + 2]! / 255;
    }
  }
  return out;
}

/** Decode BlazeFace raw output into the single best box (normalized coords).
 *  BlazeFace emits anchors + box regressors + scores; we keep the top score.
 *  Returns null if nothing clears `minScore`. */
export function decodeBlazeFace(
  boxesAndScores: Float32Array,
  minScore: number,
): { box: BoundingBox; score: number } | null {
  // Layout assumed: [..., cx, cy, w, h, score] groups of 5 in normalized space.
  let best: { box: BoundingBox; score: number } | null = null;
  for (let i = 0; i + 5 <= boxesAndScores.length; i += 5) {
    const score = sigmoid(boxesAndScores[i + 4]!);
    console.log("Detector score =>" + score + " minscore =>" + minScore)
    if (score < minScore || (best && score <= best.score)) continue;
    const cx = boxesAndScores[i]!;
    const cy = boxesAndScores[i + 1]!;
    const w = boxesAndScores[i + 2]!;
    const h = boxesAndScores[i + 3]!;
    best = {
      score,
      box: { x: cx - w / 2, y: cy - h / 2, width: w, height: h },
    };
  }
  return best;
}

/** Decode Face Mesh output (x,y,z triples, in input-pixel space) into
 *  normalized frame-space points using the crop box that fed the model. */
export function decodeFaceMesh(
  raw: Float32Array,
  cropBox: BoundingBox,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i + 3 <= raw.length; i += 3) {
    const nx = raw[i]! / FACEMESH_INPUT; // 0..1 within crop
    const ny = raw[i + 1]! / FACEMESH_INPUT;
    pts.push({
      x: cropBox.x + nx * cropBox.width,
      y: cropBox.y + ny * cropBox.height,
    });
  }
  return pts;
}

/** Estimate head pose from a few stable landmarks. Yaw from nose offset
 *  between cheeks, pitch from nose vertical position between forehead/chin,
 *  roll from the eye-line angle. Output in degrees. */
export function estimateHeadPose(lm: Point[]): HeadPose {
  const nose = lm[LANDMARK.noseTip];
  const lc = lm[LANDMARK.leftCheek];
  const rc = lm[LANDMARK.rightCheek];
  const top = lm[LANDMARK.foreheadTop];
  const chin = lm[LANDMARK.chin];
  const le = lm[LANDMARK.leftEye[0]];
  const re = lm[LANDMARK.rightEye[3]];
  if (!nose || !lc || !rc || !top || !chin || !le || !re) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }
  const yawRatio = (nose.x - (lc.x + rc.x) / 2) / Math.max(1e-6, rc.x - lc.x);
  const pitchRatio = (nose.y - (top.y + chin.y) / 2) / Math.max(1e-6, chin.y - top.y);
  const roll = Math.atan2(re.y - le.y, re.x - le.x) * (180 / Math.PI);
  return {
    yaw: clampDeg(yawRatio * 180),
    pitch: clampDeg(pitchRatio * 180),
    roll: clampDeg(roll),
  };
}

/** Pad a tight detector box outward so Face Mesh sees full head context. */
export function expandBox(box: BoundingBox, factor = 0.25): BoundingBox {
  const dx = box.width * factor;
  const dy = box.height * factor;
  return {
    x: Math.max(0, box.x - dx),
    y: Math.max(0, box.y - dy),
    width: Math.min(1 - Math.max(0, box.x - dx), box.width + 2 * dx),
    height: Math.min(1 - Math.max(0, box.y - dy), box.height + 2 * dy),
  };
}

/**
 * Per-frame detection: BlazeFace → best box, then (optionally) Face Mesh →
 * landmarks + head pose. Returns null when no face clears the threshold.
 *
 * `withLandmarks` lets callers skip the heavy Face Mesh model on stages that
 * only need the bounding box (gating, passive liveness) — a big CPU saving on
 * mid-range devices. Landmarks/pose are needed for the active challenge
 * (blink/smile/turn) and for aligned embedding.
 */
export async function detectFace(
  frame: RgbFrame,
  models: DetectorModels,
  minScore: number,
  withLandmarks = true,
): Promise<DetectedFace | null> {
  const bfInput = resampleToSquare(
    frame,
    { x: 0, y: 0, width: 1, height: 1 },
    BLAZEFACE_INPUT,
  );
  const bfOut = (await models.blazeface.run([bfInput]))[0] as Float32Array;
  const det = decodeBlazeFace(bfOut, minScore);
  if (!det) return null;

  if (!withLandmarks) {
    return { box: det.box, landmarks: [], headPose: { yaw: 0, pitch: 0, roll: 0 }, score: det.score };
  }

  const cropBox = expandBox(det.box);
  const fmInput = resampleToSquare(frame, cropBox, FACEMESH_INPUT);
  const fmOut = (await models.faceMesh.run([fmInput]))[0] as Float32Array;
  const landmarks = decodeFaceMesh(fmOut, cropBox);

  return {
    box: det.box,
    landmarks,
    headPose: estimateHeadPose(landmarks),
    score: det.score,
  };
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clampDeg(d: number): number {
  return Math.max(-90, Math.min(90, d));
}
