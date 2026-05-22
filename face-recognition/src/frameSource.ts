import { useRef } from 'react';
import { useFrameProcessor, type Frame } from 'react-native-vision-camera';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import type { TfliteModel } from './detector';

// ─── constants ────────────────────────────────────────────────────────────────

/** Single resize size — all model crops are drawn from this buffer in the worklet. */
export const FRAME_SIZE = 256;

// Model input edges (must match bundled .tflite files)
const BF = 128;  // BlazeFace
const FM = 192;  // FaceMesh
const LV = 80;   // MiniFASNet liveness
const EM = 160;  // FaceNet-512

// ─── public types ─────────────────────────────────────────────────────────────

/** All TFLite models run synchronously inside the frame-processor worklet. */
export interface FrameSourceModels {
  blazeface: TfliteModel;
  faceMesh: TfliteModel;
  liveness0: TfliteModel;  // spoof_2_7.tflite
  liveness1: TfliteModel;  // spoof_4_0.tflite
  embedding: TfliteModel;
}

/**
 * Result marshalled from the native worklet thread to the JS thread.
 * Every field is a plain JS primitive or number[] — the only types that
 * worklets-core v1.x can safely transfer through useRunOnJS.
 * TypedArrays / ArrayBuffers are NOT supported and will throw at init time.
 */
export type WorkletFrameResult =
  | { detected: false }
  | {
      detected: true;
      /** Normalised [x, y, w, h, score] 0..1 */
      bbox: [number, number, number, number, number];
      /** 468 × [x, y] flat, normalised 0..1. Length = 936. */
      landmarks: number[];
      /** Mean luma (0–255) of the face region in the 256×256 frame. */
      brightness: number;
      /** Averaged passive-liveness score (0 = spoof, 1 = live). */
      livenessScore: number;
      /** L2-normalised 512-d FaceNet embedding, or null if not needed this frame. */
      embedding: number[] | null;
    };

export interface FrameSourceOptions {
  models: FrameSourceModels;
  onFrameResult: (result: WorkletFrameResult) => void | Promise<void>;
  minIntervalMs?: number;
  /**
   * SharedValue set to true by FaceAuthView when the pipeline enters the
   * 'analyzing' stage and actually needs an embedding vector.
   * Keeps the common case (gating / challenge) free of the 80 ms FaceNet call.
   */
  needsEmbedding: { value: boolean };
}

// ─── worklet-safe helper functions ───────────────────────────────────────────
// Marked with 'worklet' so worklets-core's Babel transform serialises them
// into the native-thread Hermes instance. Pure synchronous math only.

function wSigmoid(x: number): number {
  'worklet';
  return 1 / (1 + Math.exp(-x));
}

/**
 * Nearest-neighbour resample from a Uint8Array (FRAME_SIZE×FRAME_SIZE×3 uint8)
 * into a Float32Array normalised to [0, 1].
 * Box coords are normalised 0..1.
 */
function wResample01(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  size: number,
): Float32Array {
  'worklet';
  const out = new Float32Array(size * size * 3);
  const sx0 = boxX * srcW;
  const sy0 = boxY * srcH;
  const sw = boxW * srcW;
  const sh = boxH * srcH;
  for (let y = 0; y < size; y++) {
    const fy = Math.min(srcH - 1, Math.floor(sy0 + (y / size) * sh));
    for (let x = 0; x < size; x++) {
      const fx = Math.min(srcW - 1, Math.floor(sx0 + (x / size) * sw));
      const si = (fy * srcW + fx) * 3;
      const di = (y * size + x) * 3;
      out[di]     = (src[si]     ?? 0) / 255;
      out[di + 1] = (src[si + 1] ?? 0) / 255;
      out[di + 2] = (src[si + 2] ?? 0) / 255;
    }
  }
  return out;
}

/** Same as wResample01 but normalises to [-1, 1] — required by FaceNet. */
function wResampleM1P1(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  size: number,
): Float32Array {
  'worklet';
  const out = new Float32Array(size * size * 3);
  const sx0 = boxX * srcW;
  const sy0 = boxY * srcH;
  const sw = boxW * srcW;
  const sh = boxH * srcH;
  for (let y = 0; y < size; y++) {
    const fy = Math.min(srcH - 1, Math.floor(sy0 + (y / size) * sh));
    for (let x = 0; x < size; x++) {
      const fx = Math.min(srcW - 1, Math.floor(sx0 + (x / size) * sw));
      const si = (fy * srcW + fx) * 3;
      const di = (y * size + x) * 3;
      out[di]     = (src[si]     ?? 0) / 127.5 - 1;
      out[di + 1] = (src[si + 1] ?? 0) / 127.5 - 1;
      out[di + 2] = (src[si + 2] ?? 0) / 127.5 - 1;
    }
  }
  return out;
}

/** Expand box by `factor` on each side — mirrors detector.ts expandBox. */
function wExpandBox(
  x: number, y: number, w: number, h: number, factor: number,
): [number, number, number, number] {
  'worklet';
  const dx = w * factor;
  const dy = h * factor;
  const nx = Math.max(0, x - dx);
  const ny = Math.max(0, y - dy);
  return [nx, ny, Math.min(1 - nx, w + 2 * dx), Math.min(1 - ny, h + 2 * dy)];
}

/** Scale box about its center — mirrors liveness.ts scaleBox. */
function wScaleBox(
  x: number, y: number, w: number, h: number, scale: number,
): [number, number, number, number] {
  'worklet';
  const cx = x + w / 2;
  const cy = y + h / 2;
  const nw = Math.min(1, w * scale);
  const nh = Math.min(1, h * scale);
  return [
    Math.max(0, Math.min(1 - nw, cx - nw / 2)),
    Math.max(0, Math.min(1 - nh, cy - nh / 2)),
    nw,
    nh,
  ];
}

/**
 * Decode BlazeFace output: groups of [cx, cy, w, h, score_logit] × 5.
 * Returns null if nothing clears minScore.
 */
function wDecodeBlazeFace(
  raw: Float32Array | Int32Array | Uint8Array,
  minScore: number,
): [number, number, number, number, number] | null {
  'worklet';
  const o = raw as Float32Array;
  let best = -1;
  let bx = 0, by = 0, bw = 0, bh = 0;
  for (let i = 0; i + 5 <= o.length; i += 5) {
    const score = wSigmoid(o[i + 4] ?? 0);
    if (score < minScore || score <= best) continue;
    best = score;
    bx = o[i]     ?? 0;
    by = o[i + 1] ?? 0;
    bw = o[i + 2] ?? 0;
    bh = o[i + 3] ?? 0;
  }
  if (best < 0) return null;
  return [bx - bw / 2, by - bh / 2, bw, bh, best];
}

/**
 * Decode FaceMesh output (x, y, z triples in model-pixel space) to a flat
 * [x0,y0, x1,y1, …] array in normalised frame coordinates.
 */
function wDecodeFaceMesh(
  raw: Float32Array | Int32Array | Uint8Array,
  cropX: number, cropY: number, cropW: number, cropH: number,
): number[] {
  'worklet';
  const r = raw as Float32Array;
  const pts: number[] = [];
  for (let i = 0; i + 3 <= r.length; i += 3) {
    pts.push(cropX + ((r[i]     ?? 0) / FM) * cropW);
    pts.push(cropY + ((r[i + 1] ?? 0) / FM) * cropH);
  }
  return pts;
}

/**
 * MiniFASNet: 3-logit output [fake_2d, real, fake_3d].
 * Returns softmax probability of the real/live class (index 1).
 */
function wDecodeLiveness(raw: Float32Array | Int32Array | Uint8Array): number {
  'worklet';
  const r = raw as Float32Array;
  if (r.length < 2) return 0;
  let max = -1e9;
  for (let i = 0; i < r.length; i++) max = Math.max(max, r[i] ?? -1e9);
  let sum = 0;
  const exps: number[] = [];
  for (let i = 0; i < r.length; i++) {
    const e = Math.exp((r[i] ?? 0) - max);
    exps.push(e);
    sum += e;
  }
  return sum > 0 ? (exps[1] ?? 0) / sum : 0;
}

/**
 * L2-normalise a Float32Array and return a plain number[] (safe for useRunOnJS).
 */
function wL2NormalizeToArray(raw: Float32Array | Int32Array | Uint8Array): number[] {
  'worklet';
  const v = raw as Float32Array;
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += (v[i] ?? 0) ** 2;
  norm = Math.sqrt(norm) || 1;
  const out: number[] = new Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = (v[i] ?? 0) / norm;
  return out;
}

/**
 * Mean luma (0–255) over the face-bbox region. Sampled on a grid (~64 pts).
 */
function wMeanLuma(
  src: Uint8Array,
  srcW: number, srcH: number,
  boxX: number, boxY: number, boxW: number, boxH: number,
): number {
  'worklet';
  const x0 = Math.floor(boxX * srcW);
  const y0 = Math.floor(boxY * srcH);
  const w  = Math.max(1, Math.floor(boxW * srcW));
  const h  = Math.max(1, Math.floor(boxH * srcH));
  const step = Math.max(1, Math.floor(Math.min(w, h) / 8));
  let sum = 0, count = 0;
  for (let y = y0; y < y0 + h; y += step) {
    for (let x = x0; x < x0 + w; x += step) {
      const cx = Math.min(srcW - 1, x);
      const cy = Math.min(srcH - 1, y);
      const i  = (cy * srcW + cx) * 3;
      sum += 0.299 * (src[i] ?? 0) + 0.587 * (src[i + 1] ?? 0) + 0.114 * (src[i + 2] ?? 0);
      count += 1;
    }
  }
  return count === 0 ? 128 : sum / count;
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useFrameSource({
  models,
  onFrameResult,
  minIntervalMs = 200,
  needsEmbedding,
}: FrameSourceOptions) {
  const { resize } = useResizePlugin();

  const isBusy      = useSharedValue(false);
  const lastRunTime = useSharedValue(0);

  const cbRef = useRef(onFrameResult);
  cbRef.current = onFrameResult;

  // JS-thread receiver: accepts a plain WorkletFrameResult (no binary blobs).
  const deliver = useRunOnJS(
    async (result: WorkletFrameResult) => {
      try {
        await cbRef.current(result);
      } finally {
        isBusy.value = false;
      }
    },
    [isBusy],
  );

  // Destructure so each JSI HostObject is individually captured by the worklet.
  const { blazeface, faceMesh, liveness0, liveness1, embedding: embModel } = models;

  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';

      if (isBusy.value) return;
      const now = Date.now();
      if (now - lastRunTime.value < minIntervalMs) return;
      isBusy.value    = true;
      lastRunTime.value = now;

      // ── 1. Single resize to 256×256 uint8 (one native call) ───────────────
      const src = resize(frame, {
        scale: { width: FRAME_SIZE, height: FRAME_SIZE },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      }) as unknown as Uint8Array;

      // ── 2. BlazeFace: full frame 128×128, [0,1] ────────────────────────────
      const bfInput = wResample01(src, FRAME_SIZE, FRAME_SIZE, 0, 0, 1, 1, BF);
      const bfRaw   = blazeface.runSync([bfInput]);
      const bbox    = wDecodeBlazeFace(bfRaw[0] as Float32Array, 0.5);

      if (!bbox) {
        deliver({ detected: false });
        return;
      }
      // Avoid array destructuring (_slicedToArray is not worklet-compatible).
      const bx     = bbox[0];
      const by     = bbox[1];
      const bw     = bbox[2];
      const bh     = bbox[3];
      const bScore = bbox[4];

      // ── 3. Brightness (cheap grid sample over face region) ─────────────────
      const brightness = wMeanLuma(src, FRAME_SIZE, FRAME_SIZE, bx, by, bw, bh);

      // ── 4. FaceMesh: expanded bbox, 192×192, [0,1] ────────────────────────
      const exp     = wExpandBox(bx, by, bw, bh, 0.25);
      const ex = exp[0]; const ey = exp[1]; const ew = exp[2]; const eh = exp[3];
      const fmInput    = wResample01(src, FRAME_SIZE, FRAME_SIZE, ex, ey, ew, eh, FM);
      const fmRaw      = faceMesh.runSync([fmInput]);
      const landmarks  = wDecodeFaceMesh(fmRaw[0] as Float32Array, ex, ey, ew, eh);

      // ── 5. Liveness: two MiniFASNet branches (scales 2.7 and 4.0) ─────────
      const expLv   = wExpandBox(bx, by, bw, bh, 0.1);
      const expLvX  = expLv[0]; const expLvY = expLv[1];
      const expLvW  = expLv[2]; const expLvH = expLv[3];

      const sc0     = wScaleBox(expLvX, expLvY, expLvW, expLvH, 2.7);
      const lv0Input = wResample01(src, FRAME_SIZE, FRAME_SIZE, sc0[0], sc0[1], sc0[2], sc0[3], LV);
      const lv0Raw   = liveness0.runSync([lv0Input]);
      const live0    = wDecodeLiveness(lv0Raw[0] as Float32Array);

      const sc1     = wScaleBox(expLvX, expLvY, expLvW, expLvH, 4.0);
      const lv1Input = wResample01(src, FRAME_SIZE, FRAME_SIZE, sc1[0], sc1[1], sc1[2], sc1[3], LV);
      const lv1Raw   = liveness1.runSync([lv1Input]);
      const live1    = wDecodeLiveness(lv1Raw[0] as Float32Array);

      const livenessScore = (live0 + live1) / 2;

      // ── 6. Embedding: only when the analyzing stage requests it ───────────
      let embedding: number[] | null = null;
      if (needsEmbedding.value) {
        const emInput = wResampleM1P1(src, FRAME_SIZE, FRAME_SIZE, ex, ey, ew, eh, EM);
        const emRaw   = embModel.runSync([emInput]);
        embedding     = wL2NormalizeToArray(emRaw[0] as Float32Array);
      }

      deliver({
        detected: true,
        bbox: [bx, by, bw, bh, bScore],
        landmarks,
        brightness,
        livenessScore,
        embedding,
      });
    },
    [resize, deliver, isBusy, lastRunTime, needsEmbedding,
     blazeface, faceMesh, liveness0, liveness1, embModel],
  );

  return { frameProcessor };
}
