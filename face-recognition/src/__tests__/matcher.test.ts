import { identify, verify, type Template } from '../matcher';
import { seededEmbedding } from './_helpers';

describe('matcher', () => {
  const DIMS = 128;
  const a = seededEmbedding(DIMS, 1);
  const b = seededEmbedding(DIMS, 2);
  const templates: Template[] = [
    { personnelId: 'A', embedding: a },
    { personnelId: 'B', embedding: b },
  ];

  // Helper: pre-filter as the pipeline now does before calling verify.
  const templatesFor = (id: string) => templates.filter((t) => t.personnelId === id);

  it('identify picks the closest above threshold', () => {
    const { match, best } = identify(a, templates, 0.65);
    expect(match?.personnelId).toBe('A');
    expect(best?.personnelId).toBe('A');
    expect(best!.score).toBeCloseTo(1, 5);
  });

  it('identify returns null match when nothing clears threshold', () => {
    const far = seededEmbedding(DIMS, 9999);
    const { match } = identify(far, templates, 0.99);
    expect(match).toBeNull();
  });

  it('verify accepts the true identity', () => {
    expect(verify(a, templatesFor('A'), 0.65).ok).toBe(true);
  });

  it('verify rejects a wrong identity', () => {
    expect(verify(a, templatesFor('B'), 0.65).ok).toBe(false);
  });

  it('verify returns score: null (not 0) when the claimed id has no template', () => {
    const result = verify(a, templatesFor('ZZZ'), 0.65);
    expect(result.ok).toBe(false);
    expect(result.score).toBeNull(); // null, not 0 — unambiguous "not enrolled" signal
  });

  it('verify returns a real score when a template exists but does not meet threshold', () => {
    const result = verify(a, templatesFor('B'), 0.99); // high threshold — will fail
    expect(result.ok).toBe(false);
    expect(result.score).not.toBeNull(); // real cosine score, not null
    expect(typeof result.score).toBe('number');
  });
});
