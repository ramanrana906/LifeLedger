import {
  computeCorrelationPatterns,
  pearsonCorrelation,
} from './correlation-engine';

describe('correlation engine', () => {
  it('computes Pearson correlation for numeric pairs', () => {
    expect(
      pearsonCorrelation([
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
      ]),
    ).toBeCloseTo(1);

    expect(
      pearsonCorrelation([
        { x: 1, y: 6 },
        { x: 2, y: 4 },
        { x: 3, y: 2 },
      ]),
    ).toBeCloseTo(-1);
  });

  it('only surfaces patterns with enough overlapping points and meaningful correlation', () => {
    const today = new Date('2026-07-15T00:00:00.000Z');
    const sleep = Array.from({ length: 20 }, (_, index) => ({
      logDate: dateOffset(today, -(19 - index)),
      hours: index < 10 ? 5 : 8,
    }));
    const journals = Array.from({ length: 20 }, (_, index) => ({
      entryDate: dateOffset(today, -(18 - index)),
      mood: index < 10 ? 'Low' : 'Strong',
    }));

    const patterns = computeCorrelationPatterns({
      today,
      sleep,
      journals,
      diet: [],
      weights: [],
      sessions: [],
      dailyGoals: [],
      habits: [],
    });

    expect(
      patterns.some((pattern) => pattern.id.startsWith('sleep-next-mood')),
    ).toBe(true);
    expect(patterns[0].sampleSize).toBeGreaterThanOrEqual(14);
    expect(Math.abs(patterns[0].coefficient)).toBeGreaterThan(0.4);
    expect(patterns[0].sentence).toContain('last');
  });
});

function dateOffset(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
