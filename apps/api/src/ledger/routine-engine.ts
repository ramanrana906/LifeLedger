export const ROUTINE_STEP_TYPES = [
  'habit',
  'daily_goal',
  'weekly_goal',
  'learning',
  'finance',
  'journal',
  'standalone',
] as const;

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return fallback;
}

export type RoutineStepTypeValue = (typeof ROUTINE_STEP_TYPES)[number];
export type RoutineStepRecord = Record<string, unknown> & {
  id: string;
  routineId: string;
  orderIndex: number;
  stepName: string;
  stepType: string;
  targetType?: string | null;
  targetId?: string | null;
  linkedFinanceAction?: string | null;
  linkedJournal?: string | null;
};
export type RoutineRecord = Record<string, unknown> & {
  id: string;
  name: string;
  timeAnchor?: string | null;
  steps: RoutineStepRecord[];
};
export type RoutineStatus = {
  id: string;
  routineId: string;
  name: string;
  timeAnchor: string | null;
  completionPct: number;
  completedSteps: number;
  totalSteps: number;
  status: 'done' | 'partial' | 'not_done';
  streak: number;
  steps: Array<
    RoutineStepRecord & {
      done: boolean;
      readOnly: boolean;
      actionTab: string | null;
      actionHealthTab?: string | null;
    }
  >;
};

export function dateKey(value: string | Date = new Date()) {
  return dateOnly(value).toISOString().slice(0, 10);
}

export function sameDate(left: unknown, right: Date) {
  if (!left) return false;
  return dateKey(left as string | Date) === dateKey(right);
}

export function routineStepType(value: unknown): RoutineStepTypeValue {
  const type = asString(value, 'standalone');
  if (!ROUTINE_STEP_TYPES.includes(type as RoutineStepTypeValue)) {
    throw new Error('Unknown routine step type.');
  }
  return type as RoutineStepTypeValue;
}

export function evaluateRoutineStatuses({
  routines,
  currentDate,
  goals,
  habits,
  sessions,
  financeMonths,
  debtPayments,
  transactions = [],
  journal,
  standaloneCompletions,
  routineDayLogs,
}: {
  routines: RoutineRecord[];
  currentDate: Date;
  goals: Record<string, unknown>[];
  habits: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  financeMonths: Record<string, unknown>[];
  debtPayments: Record<string, unknown>[];
  transactions?: Record<string, unknown>[];
  journal: Record<string, unknown> | null;
  standaloneCompletions: Record<string, unknown>[];
  routineDayLogs: Record<string, unknown>[];
}): RoutineStatus[] {
  const todayKey = dateKey(currentDate);
  const goalsById = new Map(goals.map((goal) => [String(goal.id), goal]));
  const habitsById = new Map(habits.map((habit) => [String(habit.id), habit]));
  const completedStandaloneStepIds = new Set(
    standaloneCompletions
      .filter((completion) => sameDate(completion.completedOn, currentDate))
      .map((completion) => String(completion.routineStepId)),
  );
  const hasJournalToday = Boolean(journal && asString(journal.body).trim());
  const hasLearningToday = (skillId?: string | null) =>
    sessions.some(
      (session) =>
        sameDate(session.logDate, currentDate) &&
        (!skillId || asString(session.skillId) === skillId),
    );
  const hasFinanceToday =
    transactions.some((transaction) =>
      sameDate(transaction.transactionDate ?? transaction.date, currentDate),
    ) ||
    financeMonths.some((month) => sameDate(month.month, currentDate)) ||
    debtPayments.some((payment) => sameDate(payment.paidOn, currentDate));
  const doneRoutineDays = new Map<string, Set<string>>();
  for (const log of routineDayLogs) {
    if (String(log.status) !== 'done') continue;
    const routineId = String(log.routineId);
    const set = doneRoutineDays.get(routineId) ?? new Set<string>();
    set.add(dateKey(log.logDate as string | Date));
    doneRoutineDays.set(routineId, set);
  }

  const stepDone = (step: RoutineStepRecord) => {
    switch (routineStepType(step.stepType)) {
      case 'habit': {
        const habit =
          step.targetType === 'habit' && step.targetId
            ? habitsById.get(String(step.targetId))
            : null;
        return Boolean(habit && sameDate(habit.lastCheckin, currentDate));
      }
      case 'daily_goal': {
        const goal =
          step.targetType === 'goal' && step.targetId
            ? goalsById.get(String(step.targetId))
            : null;
        return Boolean(goal?.completed);
      }
      case 'weekly_goal': {
        const goal =
          step.targetType === 'goal' && step.targetId
            ? goalsById.get(String(step.targetId))
            : null;
        return Boolean(goal?.completed);
      }
      case 'learning':
        return hasLearningToday(
          step.targetType === 'learning_skill' && step.targetId
            ? String(step.targetId)
            : null,
        );
      case 'finance':
        return hasFinanceToday;
      case 'journal':
        return hasJournalToday;
      case 'standalone':
        return completedStandaloneStepIds.has(step.id);
    }
  };

  const stepAction = (step: RoutineStepRecord) => {
    const type = routineStepType(step.stepType);
    if (type === 'finance') return { readOnly: true, actionTab: 'Finance' };
    if (type === 'journal') return { readOnly: true, actionTab: 'Today' };
    if (type === 'learning') return { readOnly: true, actionTab: 'Learning' };
    return { readOnly: false, actionTab: null };
  };

  return routines.map((routine) => {
    const steps = [...(routine.steps ?? [])].sort(
      (a, b) => Number(a.orderIndex) - Number(b.orderIndex),
    );
    const evaluatedSteps = steps.map((step) => {
      const action = stepAction(step);
      return {
        ...step,
        done: stepDone(step),
        readOnly: action.readOnly,
        actionTab: action.actionTab,
      };
    });
    const completedSteps = evaluatedSteps.filter((step) => step.done).length;
    const totalSteps = evaluatedSteps.length;
    const completionPct = totalSteps
      ? Math.round((completedSteps / totalSteps) * 100)
      : 0;
    const status: RoutineStatus['status'] =
      completionPct === 100 && totalSteps > 0
        ? 'done'
        : completionPct > 0
          ? 'partial'
          : 'not_done';
    const doneDays = new Set(doneRoutineDays.get(routine.id) ?? []);
    if (status === 'done') doneDays.add(todayKey);
    else doneDays.delete(todayKey);
    let streak = 0;
    for (let offset = 0; offset < 365; offset += 1) {
      const key = dateKey(addDays(currentDate, -offset));
      if (!doneDays.has(key)) break;
      streak += 1;
    }

    return {
      id: routine.id,
      routineId: routine.id,
      name: routine.name,
      timeAnchor: routine.timeAnchor ?? null,
      protected: Boolean(routine.protected),
      completionPct,
      completedSteps,
      totalSteps,
      status,
      streak,
      steps: evaluatedSteps,
    };
  });
}

function dateOnly(value: string | Date = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
