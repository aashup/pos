import { ActiveChallenge } from './activeChallenge';
import type { Thresholds } from './config';
import { averageEmbeddings, computeEmbedding, embeddingToBase64 } from './embeddings';
import type { RgbFrame, TfliteModel } from './detector';
import { checkLiveness, type LivenessModels } from './liveness';
import { identify, verify, type Template } from './matcher';
import { evaluateQuality, largestFace } from './qualityGate';
import type {
  AuthMode,
  AuthResult,
  Challenge,
  DetectedFace,
  Guidance,
} from './types';

/**
 * Session orchestrator implementing a **bifurcated execution loop**:
 *
 *  - High-frequency tracking (gating + challenge): only the lightweight
 *    BlazeFace/Face Mesh models run, so the loop stays fast enough (tens of fps)
 *    to catch a 100–150 ms blink and head-yaw trajectory for the active
 *    challenge.
 *  - Low-frequency analysis (analyzing): the heavy MiniFASNet (passive liveness)
 *    and embedding models run **once**, on a single high-quality frame, only
 *    after the active challenge has passed.
 *
 * Pull-based and side-effect free, so it is trivial to unit-test and identical
 * across platforms.
 */

export type Stage = 'gating' | 'challenge' | 'analyzing' | 'done';

/** Debug logger — prints to Metro/logcat with a [FaceAuth] tag. */
const dbg = (...args: unknown[]) => console.log('[FaceAuth]', ...args);
const f2 = (n: number) => n.toFixed(3);

export interface PipelineModels {
  embedding: TfliteModel;
  liveness: LivenessModels;
}

/** Pre-computed values from the worklet thread — skip JS-side model calls when set. */
export interface PrecomputedFrameData {
  /** Mean luma (0–255) of the face region; replaces frame-based brightness check. */
  brightness?: number;
  /** Passive-liveness score from the worklet (0 = spoof, 1 = live). */
  livenessScore?: number;
  /** L2-normalised FaceNet embedding from the worklet; null = not ready yet. */
  embedding?: Float32Array | null;
}

export interface PipelineOptions {
  mode: AuthMode;
  personnelId?: string;
  templates: Template[];
  thresholds: Thresholds;
  challengePool: Challenge[];
  challengeTimeoutMs: number;
  /** Consecutive good frames required before leaving the gate. */
  gateFrames?: number;
  /** Embeddings to collect + average before matching. */
  embedFrames?: number;
  /** Applied to the averaged probe before matching (cancelable transform).
   *  Must match the transform used on the stored templates. Default: identity. */
  probeTransform?: (embedding: Float32Array) => Float32Array;
  rng?: () => number;
}

export interface Tick {
  stage: Stage;
  guidance: Guidance;
  done: boolean;
  result?: AuthResult;
}

export class FaceAuthSession {
  private stage: Stage = 'gating';
  private goodGateFrames = 0;
  private challenge: ActiveChallenge | null = null;
  private livenessScore = 0;
  private livenessChecked = false;
  private embeddings: Float32Array[] = [];
  private lastLog = 0;
  private readonly gateFrames: number;
  private readonly embedFrames: number;

  constructor(
    private readonly models: PipelineModels,
    private readonly opts: PipelineOptions,
  ) {
    if (opts.mode === 'verify' && !opts.personnelId) {
      throw new Error('verify mode requires a personnelId');
    }
    this.gateFrames = opts.gateFrames ?? 3;
    // Default 1 → embed on a single high-quality frame after the challenge.
    this.embedFrames = opts.embedFrames ?? 1;
  }

  get currentStage(): Stage {
    return this.stage;
  }

  /**
   * Advance the session by one camera frame.
   * `frame` is null in worklet mode (all inference is pre-computed).
   * `pre` carries worklet-computed values; falls back to JS-side inference when absent.
   */
  async process(
    frame: RgbFrame | null,
    faces: DetectedFace[],
    now: number,
    pre?: PrecomputedFrameData,
  ): Promise<Tick> {
    // Throttled tracking log (don't flood at high fps).
    if (now - this.lastLog > 700) {
      this.lastLog = now;
      const top = faces[0];
      dbg(
        `stage=${this.stage} faces=${faces.length}` +
          (top ? ` score=${f2(top.score)} yaw2=${top.headPose.yaw.toFixed(0)}` : ''),
      );
    }
    switch (this.stage) {
      case 'gating':
        return this.doGate(frame, faces, pre);
      case 'challenge':
        return this.doChallenge(faces, now);
      case 'analyzing':
        return this.doAnalyzing(frame, faces, pre);
      case 'done':
        return { stage: 'done', guidance: { message: '' }, done: true };
    }
  }

  cancel(): Tick {
    this.stage = 'done';
    return this.finish({
      ok: false,
      matchScore: 0,
      livenessScore: this.livenessScore,
      challengePassed: this.challenge?.status === 'passed',
      failureReason: 'cancelled',
    });
  }

  // ── High-frequency tracking loop (lightweight: BlazeFace box only) ────────

  private doGate(frame: RgbFrame | null, faces: DetectedFace[], pre?: PrecomputedFrameData): Tick {
    const q = evaluateQuality(
      { faces, frame: frame ?? undefined, brightness: pre?.brightness },
      this.opts.thresholds,
    );
    if (!q.ok) {
      this.goodGateFrames = 0;
      return { stage: 'gating', guidance: { message: q.guidance }, done: false };
    }
    this.goodGateFrames += 1;
    if (this.goodGateFrames >= this.gateFrames) {
      // Go straight to the active challenge — heavy liveness/embedding are
      // deferred to the analyzing stage so the challenge loop stays fast.
      this.challenge = new ActiveChallenge(
        { pool: this.opts.challengePool, timeoutMs: this.opts.challengeTimeoutMs },
        Date.now(),
        this.opts.rng,
      );
      this.stage = 'challenge';
      dbg(`gate passed → challenge: ${this.challenge.challenge}`);
      return {
        stage: 'challenge',
        guidance: { message: this.challenge.prompt, challenge: this.challenge.challenge },
        done: false,
      };
    }
    return { stage: 'gating', guidance: { message: 'Hold steady' }, done: false };
  }

  private doChallenge(faces: DetectedFace[], now: number): Tick {
    const c = this.challenge!;
    // Require exactly one tracked face; otherwise treat as lost tracking.
    const face = faces.length === 1 ? faces[0]! : null;
    const state = c.feed(face, now);
    if (state === 'failed') {
      this.stage = 'done';
      dbg(`challenge FAILED (${c.challenge}) — timeout or lost tracking`);
      return this.finish({
        ok: false,
        matchScore: 0,
        livenessScore: this.livenessScore,
        challengePassed: false,
        failureReason: 'challenge_failed',
      });
    }
    if (state === 'passed') {
      this.stage = 'analyzing';
      dbg(`challenge PASSED (${c.challenge}) → analyzing`);
      return { stage: 'analyzing', guidance: { message: 'Verifying…' }, done: false };
    }
    return {
      stage: 'challenge',
      guidance: { message: c.prompt, challenge: c.challenge },
      done: false,
    };
  }

  // ── Low-frequency analysis (heavy: MiniFASNet + embedding, run once) ──────

  private async doAnalyzing(
    frame: RgbFrame | null,
    faces: DetectedFace[],
    pre?: PrecomputedFrameData,
  ): Promise<Tick> {
    if (faces.length === 0) {
      return { stage: 'analyzing', guidance: { message: 'Hold steady' }, done: false };
    }
    // Only spend the heavy models on a high-quality frame.
    const q = evaluateQuality(
      { faces, frame: frame ?? undefined, brightness: pre?.brightness },
      this.opts.thresholds,
    );
    if (!q.ok) {
      return { stage: 'analyzing', guidance: { message: q.guidance }, done: false };
    }
    const face = largestFace(faces);

    // Passive liveness: run exactly once, after the challenge passed.
    if (!this.livenessChecked) {
      let liveScore: number;
      if (pre?.livenessScore !== undefined) {
        // Precomputed by worklet — use directly.
        liveScore = pre.livenessScore;
        dbg(`liveness (worklet): live=${f2(liveScore)} spoof=${f2(1 - liveScore)}`);
      } else if (frame) {
        // Fallback: JS-side inference (tests / headless mode).
        const lv = await checkLiveness(frame, face, this.models.liveness, this.opts.thresholds.spoofReject);
        liveScore = lv.liveScore;
        dbg(`liveness (JS): live=${f2(lv.liveScore)} spoof=${f2(lv.spoofScore)} isLive=${lv.isLive}`);
      } else {
        liveScore = 1; // no data available — assume live
      }
      this.livenessChecked = true;
      this.livenessScore   = liveScore;
      const spoofScore = 1 - liveScore;
      if (spoofScore >= this.opts.thresholds.spoofReject) {
        this.stage = 'done';
        return this.finish({
          ok: false,
          matchScore: 0,
          livenessScore: liveScore,
          challengePassed: true,
          failureReason: 'liveness_failed',
        });
      }
    }

    // Embedding: use precomputed value or fall back to JS-side inference.
    if (pre?.embedding) {
      this.embeddings.push(pre.embedding);
    } else if (frame) {
      this.embeddings.push(await computeEmbedding(frame, face, this.models.embedding));
    } else {
      // Embedding not ready this frame (needsEmbedding not yet true) — wait.
      return { stage: 'analyzing', guidance: { message: 'Verifying…' }, done: false };
    }
    if (this.embeddings.length < this.embedFrames) {
      return { stage: 'analyzing', guidance: { message: 'Verifying…' }, done: false };
    }
    return this.match();
  }

  private match(): Tick {
    const averaged = averageEmbeddings(this.embeddings);
    this.stage = 'done';

    // Enroll mode: hand back the captured template (pre-cancelable) — no match.
    if (this.opts.mode === 'enroll') {
      dbg(`ENROLL captured embedding (dims=${averaged.length})`);
      return this.finish({
        ok: true,
        matchScore: 1,
        livenessScore: this.livenessScore,
        challengePassed: true,
        embeddingB64: embeddingToBase64(averaged),
      });
    }

    const probe = this.opts.probeTransform ? this.opts.probeTransform(averaged) : averaged;
    if (this.opts.templates.length === 0) {
      dbg('match: no templates provisioned');
      return this.finish({
        ok: false,
        matchScore: 0,
        livenessScore: this.livenessScore,
        challengePassed: true,
        failureReason: 'no_template',
      });
    }
    if (this.opts.mode === 'verify') {
      const v = verify(probe, this.opts.personnelId!, this.opts.templates, this.opts.thresholds.matchCosine);
      dbg(`verify ${this.opts.personnelId}: score=${f2(v.score)} thresh=${f2(this.opts.thresholds.matchCosine)} ok=${v.ok}`);
      return this.finish({
        ok: v.ok,
        personnelId: v.ok ? this.opts.personnelId : undefined,
        matchScore: v.score,
        livenessScore: this.livenessScore,
        challengePassed: true,
        failureReason: v.ok ? undefined : 'no_match',
      });
    }
    const { match, best } = identify(probe, this.opts.templates, this.opts.thresholds.matchCosine);
    dbg(
      `identify: best=${best?.personnelId ?? '—'} score=${f2(best?.score ?? 0)} ` +
        `thresh=${f2(this.opts.thresholds.matchCosine)} match=${match?.personnelId ?? 'none'}`,
    );
    return this.finish({
      ok: match !== null,
      personnelId: match?.personnelId,
      matchScore: best?.score ?? 0,
      livenessScore: this.livenessScore,
      challengePassed: true,
      failureReason: match ? undefined : 'no_match',
    });
  }

  private finish(result: AuthResult): Tick {
    return { stage: 'done', guidance: { message: '' }, done: true, result };
  }
}
