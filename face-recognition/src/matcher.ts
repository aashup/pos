import { cosineSimilarity } from './embeddings';

/**
 * 1:1 (verify) and 1:N (identify) matching over locally-held templates.
 *
 * A template is one personnel's enrolled embedding (already L2-normalized, and
 * already passed through the cancelable transform — see secure/cancelable.ts).
 * The probe embedding fed in here must have gone through the *same* transform.
 */

export interface Template {
  personnelId: string;
  embedding: Float32Array;
}

export interface Match {
  personnelId: string;
  score: number;
}

/** Best match across all templates (identify / 1:N). */
export function identify(
  probe: Float32Array,
  templates: Template[],
  threshold: number,
): { match: Match | null; best: Match | null } {
  let best: Match | null = null;
  for (const t of templates) {
    const score = cosineSimilarity(probe, t.embedding);
    if (!best || score > best.score) {
      best = { personnelId: t.personnelId, score };
    }
  }
  const match = best && best.score >= threshold ? best : null;
  return { match, best };
}

/** Verify a probe against one claimed identity (1:1).
 *  A personnel may have multiple enrolled templates; we take the highest. */
export function verify(
  probe: Float32Array,
  personnelId: string,
  templates: Template[],
  threshold: number,
): { ok: boolean; score: number } {
  let best = -Infinity;
for (const t of templates) {
    if (t.personnelId !== personnelId) continue;
    best = Math.max(best, cosineSimilarity(probe, t.embedding));
  }
  if (best === -Infinity) return { ok: false, score: 0 }; // no template for id
  return { ok: best >= threshold, score: best };
}
