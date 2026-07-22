// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export type Dashboard = {
  stats: Row;
  profile: Row;
  focusCycle: Row | null;
  today: string;
  weekStart: string;
  journal: Row | null;
  goals: Row[];
  dailyGoals: Row[];
  lifeGoals: Row[];
  weeklyGoals: Row[];
  debts: Row[];
  incomeSources: Row[];
  savings: Row | null;
  financeMonths: Row[];
  transactions: Row[];
  weights: Row[];
  diet: Row | null;
  workouts: Row[];
  sleep: Row[];
  habits: Row[];
  checkins: Row[];
  dates: Row[];
  skills: Row[];
  sessions: Row[];
  debtPayments: Row[];
  assets: Row[];
  assetSnapshots: Row[];
  netWorthSnapshots: Row[];
  loanSummaries: Row[];
  dietLogs: Row[];
  journalEntries: Row[];
  xpEvents: Row[];
  patterns: Row[];
  weeklyReflection: Row | null;
  journalGoalTags: Row[];
  journalHabitTags: Row[];
  routines: Row[];
  routineStatuses: Row[];
  routineDayLogs: Row[];
};

export const dashboardArrays: (keyof Dashboard)[] = [
  'goals',
  'dailyGoals',
  'lifeGoals',
  'weeklyGoals',
  'debts',
  'incomeSources',
  'financeMonths',
  'transactions',
  'weights',
  'workouts',
  'sleep',
  'habits',
  'checkins',
  'dates',
  'skills',
  'sessions',
  'debtPayments',
  'assets',
  'assetSnapshots',
  'netWorthSnapshots',
  'loanSummaries',
  'dietLogs',
  'journalEntries',
  'xpEvents',
  'patterns',
  'journalGoalTags',
  'journalHabitTags',
  'routines',
  'routineStatuses',
  'routineDayLogs',
];

export function normalizeDashboard(payload: Partial<Dashboard>): Dashboard {
  const normalized = {
    ...payload,
    stats: payload.stats ?? {},
    profile: payload.profile ?? {},
    focusCycle: payload.focusCycle ?? null,
    today: payload.today ?? new Date().toISOString().slice(0, 10),
    weekStart: payload.weekStart ?? new Date().toISOString().slice(0, 10),
    journal: payload.journal ?? null,
    diet: payload.diet ?? null,
    savings: payload.savings ?? null,
    weeklyReflection: payload.weeklyReflection ?? null,
  } as Dashboard;

  dashboardArrays.forEach((key) => {
    if (!Array.isArray(normalized[key])) {
      (normalized[key] as Row[]) = [];
    }
  });

  return normalized;
}
