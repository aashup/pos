import { dotProduct } from './embeddings';

/**
 * 1:1 (verify) and 1:N (identify) matching over locally-held templates.
 *
 * A template is one personnel's enrolled embedding (already L2-normalized, and
 * already passed through the cancelable transform — see secure/cancelable.ts).
 * The probe embedding fed in here must have gone through the *same* transform.
 *
 * Performance notes
 * ─────────────────
 * • `dotProduct` is used instead of a full cosine-similarity computation.
 *   Because every embedding (probe and template) is L2-normalized before
 *   storage, the dot product IS the cosine similarity — skipping the two
 *   magnitude divisions saves ~2 × N multiplications per comparison.
 * • `verify` accepts a **pre-filtered** slice (only the templates that belong
 *   to the claimed identity), so 1:1 lookups are O(K) where K is the number
 *   of enrolled shots for that person, not O(all templates in the store).
 *   The caller is responsible for the O(1) map lookup before calling verify.
 * • Both inner loops use a numeric index instead of `for…of` to avoid the
 *   iterator-protocol overhead in tight V8 numeric loops.
 */

export interface Template {
  personnelId: string;
  embedding: Float32Array;
}

export interface Match {
  personnelId: string;
  score: number;
}

/**
 * Best match across all templates (identify / 1:N).
 *
 * Returns the highest-scoring template and, separately, whether that score
 * clears the threshold.
 */
export function identify(
  probe: Float32Array,
  templates: Template[],
  threshold: number,
): { match: Match | null; best: Match | null } {
  let best: Match | null = null;
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i]!;
    const score = dotProduct(probe, t.embedding);
    if (!best || score > best.score) {
      best = { personnelId: t.personnelId, score };
    }
  }
  const match = best && best.score >= threshold ? best : null;
  return { match, best };
}

/**
 * Verify a probe against one claimed identity (1:1).
 *
 * **`personnelTemplates` must already be filtered** to contain only the
 * embeddings that belong to the claimed identity.  Pass an empty array (not
 * the whole template pool) when no templates exist for that person.
 *
 * Returns `score: null` (not 0) when the slice is empty so callers can
 * distinguish "no template enrolled" from a genuine cosine score of 0.0
 * (orthogonal vectors), which is a real, if terrible, match result.
 */
export function verify(
  probe: Float32Array,
  personnelTemplates: Template[],
  threshold: number,
): { ok: boolean; score: number | null } {
  if (personnelTemplates.length === 0) {
    return { ok: false, score: null }; // no template enrolled — distinct from score 0.0
  }
  let best = -Infinity;
  for (let i = 0; i < personnelTemplates.length; i++) {
    const s = dotProduct(probe, personnelTemplates[i]!.embedding);
    if (s > best) best = s;
  }
  return { ok: best >= threshold, score: best };
}
