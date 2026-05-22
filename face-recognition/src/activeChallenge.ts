import { LANDMARK } from './detector';
import type { Challenge, DetectedFace, Point } from './types';

/**
 * Active liveness challenge — the visible anti-fraud step. The user is asked to
 * blink, smile, or turn their head; we verify it purely from the Face Mesh
 * landmark stream (no extra model). This defeats static photos and most replays
 * that the passive model might let through, and crucially must be tracked on a
 * *continuous* live face — see `feed` rejecting on lost tracking.
 */

export interface ChallengeConfig {
  /** Allowed challenges; one is chosen at random per session. */
  pool: Challenge[];
  /** Max time to satisfy the challenge before failing (ms). */
  timeoutMs: number;
}

export type ChallengeState = 'pending' | 'passed' | 'failed';

const EAR_OPEN = 0.23; // eye-aspect-ratio above this = open
const EAR_CLOSED = 0.15; // below this = closed (blink trough)
const SMILE_RATIO = 0.55; // mouth width / height above this = smiling
const TURN_YAW = 15; // degrees of yaw to count as a head turn

export class ActiveChallenge {
  readonly challenge: Challenge;
  private state: ChallengeState = 'pending';
  private startedAt: number;
  // blink: need open -> closed -> open
  private sawClosed = false;
  // smile: baseline neutral then a rise
  private sawNeutralMouth = false;
  // turn: must return toward center after crossing the threshold
  private sawTurn = false;

  constructor(cfg: ChallengeConfig, now: number, rng: () => number = Math.random) {
    if (cfg.pool.length === 0) throw new Error('challenge pool is empty');
    this.challenge = cfg.pool[Math.floor(rng() * cfg.pool.length)]!;
    this.startedAt = now;
    this.timeoutMs = cfg.timeoutMs;
  }

  private timeoutMs: number;

  get status(): ChallengeState {
    return this.state;
  }

  /** Short instruction for the UI. */
  get prompt(): string {
    switch (this.challenge) {
      case 'blink':
        return 'Blink your eyes';
      case 'smile':
        return 'Smile';
      case 'turn_head':
        return 'Turn your head slowly, then back';
    }
  }

  /**
   * Feed one tracked frame. Pass `face = null` when tracking is lost (no face,
   * multiple faces, or quality gate failed) — that fails the challenge to stop
   * a photo being swapped in mid-sequence.
   */
  feed(face: DetectedFace | null, now: number): ChallengeState {
    if (this.state !== 'pending') return this.state;
    if (now - this.startedAt > this.timeoutMs) {
      this.state = 'failed';
      return this.state;
    }
    if (!face) {
      this.state = 'failed';
      return this.state;
    }

    switch (this.challenge) {
      case 'blink':
        this.feedBlink(face);
        break;
      case 'smile':
        this.feedSmile(face);
        break;
      case 'turn_head':
        this.feedTurn(face);
        break;
    }
    return this.state;
  }

  private feedBlink(face: DetectedFace): void {
    const ear = (eyeAspectRatio(face, 'left') + eyeAspectRatio(face, 'right')) / 2;
    if (ear < EAR_CLOSED) this.sawClosed = true;
    else if (this.sawClosed && ear > EAR_OPEN) this.state = 'passed';
  }

  private feedSmile(face: DetectedFace): void {
    const ratio = mouthRatio(face);
    if (ratio < SMILE_RATIO * 0.8) this.sawNeutralMouth = true;
    else if (this.sawNeutralMouth && ratio > SMILE_RATIO) this.state = 'passed';
  }

  private feedTurn(face: DetectedFace): void {
    const yaw = face.headPose.yaw;
    if (Math.abs(yaw) > TURN_YAW) this.sawTurn = true;
    else if (this.sawTurn && Math.abs(yaw) < TURN_YAW * 0.5) this.state = 'passed';
  }
}

/** Eye Aspect Ratio from a 6-point eye ring: (v1+v2)/(2*h). */
export function eyeAspectRatio(face: DetectedFace, side: 'left' | 'right'): number {
  const idx = side === 'left' ? LANDMARK.leftEye : LANDMARK.rightEye;
  const p = idx.map((i) => face.landmarks[i]);
  if (p.some((q) => !q)) return 1; // missing → treat as open
  const [p0, p1, p2, p3, p4, p5] = p as Point[];
  const v1 = dist(p1!, p5!);
  const v2 = dist(p2!, p4!);
  const h = dist(p0!, p3!) || 1e-6;
  return (v1 + v2) / (2 * h);
}

/** Mouth openness/spread ratio = lip-corner width / vertical opening proxy. */
export function mouthRatio(face: DetectedFace): number {
  const l = face.landmarks[LANDMARK.mouthLeft];
  const r = face.landmarks[LANDMARK.mouthRight];
  const top = face.landmarks[LANDMARK.mouthTop];
  const bot = face.landmarks[LANDMARK.mouthBottom];
  if (!l || !r || !top || !bot) return 0;
  const width = dist(l, r);
  const height = dist(top, bot) || 1e-6;
  return width / height;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
