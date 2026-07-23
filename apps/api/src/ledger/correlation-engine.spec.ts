import {
  computeCorrelationPatterns,
  linkedGoalMomentumByDate,
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

  it('builds goal momentum through a bidirectional, cyclic linked chain', () => {
    const momentum = linkedGoalMomentumByDate(
      {
        today: new Date('2026-07-23T00:00:00.000Z'),
        journals: [],
        sleep: [],
        diet: [],
        weights: [],
        sessions: [],
        dailyGoals: [],
        habits: [{ id: 'habit-1' }],
        goals: [{ id: 'goal-1', level: 'north_star' }],
        transactions: [
          {
            id: 'transaction-1',
            transactionDate: '2026-07-23',
            status: 'confirmed',
          },
          {
            id: 'unlinked-transaction',
            transactionDate: '2026-07-23',
            status: 'confirmed',
          },
        ],
        routineDayLogs: [
          {
            id: 'routine-log-1',
            routineId: 'routine-1',
            logDate: '2026-07-23',
            completionPct: 50,
          },
        ],
        habitActivity: [
          {
            id: 'checkin-1',
            habitId: 'habit-1',
            checkinDate: '2026-07-23',
            completed: true,
          },
        ],
        entityLinks: [
          {
            sourceType: 'goal',
            sourceId: 'goal-1',
            targetType: 'finance_debt',
            targetId: 'debt-1',
          },
          {
            sourceType: 'finance_transaction',
            sourceId: 'transaction-1',
            targetType: 'finance_debt',
            targetId: 'debt-1',
          },
          {
            sourceType: 'finance_transaction',
            sourceId: 'transaction-1',
            targetType: 'routine',
            targetId: 'routine-1',
          },
          {
            sourceType: 'routine',
            sourceId: 'routine-1',
            targetType: 'habit',
            targetId: 'habit-1',
          },
          {
            sourceType: 'habit',
            sourceId: 'habit-1',
            targetType: 'goal',
            targetId: 'goal-1',
          },
        ],
      },
      'goal-1',
    );

    expect(momentum.get('2026-07-23')).toBe(2.5);
  });

  it('correlates North Star mood with momentum from linked entities', () => {
    const today = new Date('2026-07-23T00:00:00.000Z');
    const journals = Array.from({ length: 70 }, (_, index) => ({
      id: `journal-${index}`,
      entryDate: dateOffset(today, -(69 - index)),
      mood: index < 35 ? 'Low' : 'Strong',
    }));
    const routineDayLogs = Array.from({ length: 70 }, (_, index) => ({
      id: `routine-log-${index}`,
      routineId: 'routine-1',
      logDate: dateOffset(today, -(69 - index)),
      completionPct: index < 35 ? 20 : 100,
    }));

    const input = {
      today,
      journals,
      sleep: [],
      diet: [],
      weights: [],
      sessions: [],
      dailyGoals: [],
      habits: [],
      goals: [
        {
          id: 'goal-1',
          level: 'north_star',
          title: 'Become financially free',
        },
      ],
      routineDayLogs,
      entityLinks: [
        {
          sourceType: 'routine',
          sourceId: 'routine-1',
          targetType: 'goal',
          targetId: 'goal-1',
        },
      ],
    };
    const prematurePatterns = computeCorrelationPatterns({
      ...input,
      journals: journals.slice(-59),
      routineDayLogs: routineDayLogs.slice(-59),
    });
    expect(
      prematurePatterns.some((pattern) =>
        pattern.id.startsWith('north-star-momentum-mood-goal-1'),
      ),
    ).toBe(false);

    const patterns = computeCorrelationPatterns(input);

    const linkedPattern = patterns.find((pattern) =>
      pattern.id.startsWith('north-star-momentum-mood-goal-1'),
    );
    expect(linkedPattern).toMatchObject({
      pair: 'Become financially free momentum and mood',
      coefficient: 1,
      sampleSize: 70,
    });
  });
});

function dateOffset(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
