import { evaluateRoutineStatuses } from './routine-engine';

describe('routine auto-check evaluation', () => {
  it('reflects real state for every routine step type', () => {
    const currentDate = new Date('2026-07-15T00:00:00.000Z');
    const routine = {
      id: 'routine-1',
      name: 'Morning launch',
      timeAnchor: 'morning',
      steps: [
        {
          id: 'step-habit',
          routineId: 'routine-1',
          orderIndex: 0,
          stepName: 'Meditate',
          stepType: 'habit',
          targetType: 'habit',
          targetId: 'habit-1',
        },
        {
          id: 'step-daily',
          routineId: 'routine-1',
          orderIndex: 1,
          stepName: 'Daily goal',
          stepType: 'daily_goal',
          targetType: 'goal',
          targetId: 'goal-daily',
        },
        {
          id: 'step-weekly',
          routineId: 'routine-1',
          orderIndex: 2,
          stepName: 'Weekly goal',
          stepType: 'weekly_goal',
          targetType: 'goal',
          targetId: 'goal-weekly',
        },
        {
          id: 'step-learning',
          routineId: 'routine-1',
          orderIndex: 3,
          stepName: 'Study',
          stepType: 'learning',
          targetType: 'learning_skill',
          targetId: 'skill-1',
        },
        {
          id: 'step-finance',
          routineId: 'routine-1',
          orderIndex: 4,
          stepName: 'Log expense',
          stepType: 'finance',
          linkedFinanceAction: 'expense',
        },
        {
          id: 'step-journal',
          routineId: 'routine-1',
          orderIndex: 5,
          stepName: 'Journal',
          stepType: 'journal',
          linkedJournal: 'today',
        },
        {
          id: 'step-standalone',
          routineId: 'routine-1',
          orderIndex: 6,
          stepName: 'Pack bag',
          stepType: 'standalone',
        },
      ],
    };

    const [status] = evaluateRoutineStatuses({
      routines: [routine],
      currentDate,
      goals: [
        { id: 'goal-daily', level: 'daily', completed: true },
        { id: 'goal-weekly', level: 'weekly', completed: true },
      ],
      habits: [{ id: 'habit-1', lastCheckin: currentDate }],
      sessions: [
        {
          id: 'session-1',
          skillId: 'skill-1',
          logDate: currentDate,
          minutes: 30,
        },
      ],
      financeMonths: [],
      transactions: [
        {
          id: 'transaction-1',
          transactionDate: currentDate,
          type: 'expense',
          amount: 20,
        },
      ],
      debtPayments: [],
      journal: {
        id: 'journal-1',
        entryDate: currentDate,
        body: 'A real entry.',
      },
      standaloneCompletions: [
        { routineStepId: 'step-standalone', completedOn: currentDate },
      ],
      routineDayLogs: [
        {
          routineId: 'routine-1',
          logDate: new Date('2026-07-13T00:00:00.000Z'),
          status: 'done',
        },
        {
          routineId: 'routine-1',
          logDate: new Date('2026-07-14T00:00:00.000Z'),
          status: 'done',
        },
      ],
    });

    expect(status.completionPct).toBe(100);
    expect(status.status).toBe('done');
    expect(status.streak).toBe(3);
    expect(status.steps.map((step) => [step.id, step.done])).toEqual([
      ['step-habit', true],
      ['step-daily', true],
      ['step-weekly', true],
      ['step-learning', true],
      ['step-finance', true],
      ['step-journal', true],
      ['step-standalone', true],
    ]);
    expect(
      status.steps.filter((step) => step.readOnly).map((step) => step.id),
    ).toEqual(['step-learning', 'step-finance', 'step-journal']);
  });
});
