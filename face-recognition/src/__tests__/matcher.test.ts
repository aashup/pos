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

  it('verify accepts the true identity and rejects a wrong one', () => {
    expect(verify(a, 'A', templates, 0.65).ok).toBe(true);
    expect(verify(a, 'B', templates, 0.65).ok).toBe(false);
  });

  it('verify fails when the claimed id has no template', () => {
    expect(verify(a, 'ZZZ', templates, 0.65)).toEqual({ ok: false, score: 0 });
  });
});
