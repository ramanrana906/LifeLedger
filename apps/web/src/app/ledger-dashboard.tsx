'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Label,
} from 'recharts';
import { AppLogoMark } from '@/components/app-logo';
import { SignOutButton } from '@/components/sign-out-button';

// The dashboard payload is intentionally loose because it mirrors Prisma JSON.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Dashboard = {
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

const dashboardArrays: (keyof Dashboard)[] = [
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

const tabs = [
  { key: 'Today', icon: 'sun' },
  { key: 'Goals', icon: 'target' },
  { key: 'Finance', icon: 'coins' },
  { key: 'Health', icon: 'heart' },
  { key: 'Relationships', icon: 'users' },
  { key: 'Learning', icon: 'book' },
  { key: 'Habits', icon: 'repeat' },
  { key: 'Routines', icon: 'routine' },
  { key: 'Review', icon: 'chart' },
  { key: 'Settings', icon: 'settings' },
] as const;
const moduleOptions = [
  { key: 'journal', label: 'Journal', tab: 'Today' },
  { key: 'goals', label: 'Goals', tab: 'Goals' },
  { key: 'finance', label: 'Finance', tab: 'Finance' },
  { key: 'health', label: 'Health', tab: 'Health' },
  { key: 'sleep', label: 'Sleep', tab: 'Health', healthTab: 'Sleep' },
  { key: 'relationships', label: 'Relationships', tab: 'Relationships' },
  { key: 'learning', label: 'Learning', tab: 'Learning' },
  { key: 'habits', label: 'Habits', tab: 'Habits' },
  { key: 'routines', label: 'Routines', tab: 'Routines' },
] as const;
const moods = ['Strong', 'Steady', 'Tired', 'Low', 'Restless'];
const fourThieves = [
  'Inability to say no',
  'Fear of things falling apart',
  'Poor health/energy',
  'Unsupportive environment',
];
const rangeOptions = [7, 30, 90, 9999] as const;
const colors = {
  brass: '#4F46E5',
  brassDeep: '#4338CA',
  moss: '#10B981',
  wax: '#EF4444',
  warning: '#F59E0B',
  ai: '#8B5CF6',
  cyan: '#06B6D4',
  neutral: '#94A3B8',
  rule: '#E5E7EB',
  ink: '#111827',
  muted: '#6B7280',
  card: '#ffffff',
};

const gridStroke = '#F1F5F9';

function Parchment({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="parchment p-6">
      <header className="mb-4 flex items-end justify-between gap-4 border-b pb-4">
        <div>
          {eyebrow ? <div className="label-caps mb-2">{eyebrow}</div> : null}
          <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function SubTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel = 'Module sections',
}: {
  tabs: readonly T[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-1 shadow-sm" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={`min-h-10 rounded-xl px-4 text-sm font-medium transition active:scale-95 ${value === tab ? 'bg-brass text-white shadow-sm' : 'text-[var(--muted)] hover:bg-background hover:text-ink'}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, tone = 'text-brass' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className={`stat-number mt-1 font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function NavIcon({ name, className = '' }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
    coins: <><ellipse cx="9" cy="7" rx="5" ry="3" /><path d="M4 7v5c0 1.7 2.2 3 5 3s5-1.3 5-3V7" /><path d="M10 16c.8 1.2 2.7 2 5 2 2.8 0 5-1.3 5-3v-5c0-1.4-1.5-2.6-3.7-2.9" /></>,
    heart: <path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 0 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1Z" />,
    moon: <path d="M20.8 14.2A8.6 8.6 0 0 1 9.8 3.2 8.7 8.7 0 1 0 20.8 14.2Z" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" /></>,
    repeat: <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
    routine: <><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6.5 5.2 8 7 4.5" /><path d="M4 12.5 5.2 14 7 10.5" /><circle cx="5.5" cy="18" r="1.5" /></>,
    chart: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15l3-4 3 2 4-6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    sparkles: <><path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
    settings: <><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 20.9 10H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></>,
  };
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {paths[name] ?? paths.inbox}
    </svg>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className ?? ''}`} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`field min-h-28 resize-y leading-7 ${props.className ?? ''}`} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`field ${props.className ?? ''}`} />;
}

function ChartPlaceholder({ children = 'Log your first entry to see trends here' }: { children?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-dashed bg-background/55 p-4 text-center text-sm text-[var(--muted)]">
      <div>
        <span className="empty-state-icon mx-auto mb-3"><NavIcon name="chart" className="h-4 w-4" /></span>
        <div>{children}</div>
      </div>
    </div>
  );
}

function MiniLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function normalizeDashboard(payload: Partial<Dashboard>): Dashboard {
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

function RangeToggle({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex rounded-2xl border bg-background p-1">
      {rangeOptions.map((item) => (
        <button
          key={item}
          className={`rounded-xl px-2.5 py-1 text-xs transition duration-150 active:scale-95 ${value === item ? 'bg-brass text-white shadow-sm' : 'text-[var(--muted)] hover:bg-card hover:text-brass'}`}
          onClick={() => onChange(item)}
          type="button"
        >
          {item === 9999 ? 'All' : `${item}d`}
        </button>
      ))}
    </div>
  );
}

function ChartBox({ children, height = 240 }: { children: React.ReactNode; height?: number }) {
  return <div className="h-[var(--chart-h)] w-full" style={{ '--chart-h': `${height}px` } as React.CSSProperties}>{children}</div>;
}

function AxisLabel({ value, axis = 'x' }: { value: string; axis?: 'x' | 'y' }) {
  return (
    <Label
      value={value}
      position={axis === 'x' ? 'insideBottom' : 'insideLeft'}
      angle={axis === 'y' ? -90 : 0}
      offset={axis === 'x' ? -4 : 8}
      style={{ fill: colors.muted, fontSize: 10, letterSpacing: 0 }}
    />
  );
}

function SparkBox({ children }: { children: React.ReactNode }) {
  return <div className="h-24 w-full">{children}</div>;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border bg-card px-3 py-2 text-xs shadow-sm">
      {label ? <div className="mb-1 font-medium text-ink">{label}</div> : null}
      {payload.map((item) => (
        <div key={`${item.name}-${item.value}`} className="flex items-center gap-2 text-[var(--muted)]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? colors.brass }} />
          <span>{item.name}: {item.value}</span>
        </div>
      ))}
    </div>
  );
}

function dateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function daysBack(todayIso: string, days: number) {
  const end = new Date(todayIso);
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - i);
    result.push(dateKey(date));
  }
  return result;
}

function filterRange<T extends Row>(rows: T[], key: string, days: number, todayIso: string) {
  if (days === 9999) return rows;
  const min = new Date(todayIso);
  min.setUTCDate(min.getUTCDate() - days + 1);
  return rows.filter((row) => new Date(row[key]).getTime() >= min.getTime());
}

function monthKey(value: string | Date) {
  return dateKey(value).slice(0, 7);
}

function financeTransactionsForMonth(data: Dashboard, month = monthKey(data.today)) {
  return data.transactions.filter((row) => monthKey(row.transactionDate ?? row.date ?? row.createdAt) === month);
}

function financeTotalsForMonth(data: Dashboard, month = monthKey(data.today)) {
  return financeTransactionsForMonth(data, month).reduce(
    (totals, row) => {
      const amount = Number(row.amount ?? 0);
      if (row.type === 'income') totals.income += amount;
      if (row.type === 'expense') totals.expenses += amount;
      if (row.type === 'debt_payment') totals.debtPaid += amount;
      return totals;
    },
    { income: 0, expenses: 0, debtPaid: 0 },
  );
}

function expenseBreakdownForMonth(data: Dashboard, month = monthKey(data.today)) {
  const totals = new Map<string, number>();
  financeTransactionsForMonth(data, month)
    .filter((row) => row.type === 'expense')
    .forEach((row) => {
      const category = String(row.category ?? 'Other');
      totals.set(category, (totals.get(category) ?? 0) + Number(row.amount ?? 0));
    });
  return [...totals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function transactionTypeLabel(type?: string) {
  if (type === 'income') return 'Income';
  if (type === 'debt_payment') return 'Debt payment';
  return 'Expense';
}

const skillStages = [
  { value: 'DONT_KNOW_HOW', label: "Don't know how" },
  { value: 'KNOW_HOW_NOT_DONE', label: "Know how, haven't done it" },
  { value: 'CAN_DO_IT', label: 'Can do it' },
  { value: 'DO_IT_WELL', label: 'Do it well' },
  { value: 'COACH_IT', label: 'Coach it' },
] as const;

function skillStageIndex(stage?: string) {
  const index = skillStages.findIndex((item) => item.value === stage);
  return index >= 0 ? index : 0;
}

function skillStageLabel(stage?: string) {
  return skillStages[skillStageIndex(stage)].label;
}

function SkillStageProgress({ stage }: { stage?: string }) {
  const current = skillStageIndex(stage);
  return (
    <div className="mt-2 max-w-xs">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span>{skillStageLabel(stage)}</span>
        <span className="tabular-nums">{current + 1}/5</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {skillStages.map((item, index) => (
          <span
            key={item.value}
            className={`h-1.5 rounded-full transition ${index <= current ? 'bg-brass' : 'bg-rule'}`}
            title={item.label}
          />
        ))}
      </div>
    </div>
  );
}

function moduleCountsByDay(data: Dashboard, days = 90) {
  const counts = new Map<string, Set<string>>();
  const add = (date: string | undefined, module: string) => {
    if (!date) return;
    const key = dateKey(date);
    const set = counts.get(key) ?? new Set<string>();
    set.add(module);
    counts.set(key, set);
  };

  data.journalEntries.forEach((row) => add(row.entryDate, 'journal'));
  data.xpEvents.forEach((row) => add(row.createdAt, row.source ?? 'activity'));
  data.transactions.forEach((row) => add(row.transactionDate, 'finance'));
  data.debtPayments.forEach((row) => add(row.paidOn, 'finance'));
  data.dietLogs.forEach((row) => add(row.logDate, 'diet'));
  data.weights.forEach((row) => add(row.logDate, 'weight'));
  data.workouts.forEach((row) => add(row.logDate, 'workout'));
  data.sleep.forEach((row) => add(row.logDate, 'sleep'));
  data.sessions.forEach((row) => add(row.logDate, 'learning'));
  data.routineDayLogs.filter((row) => row.status !== 'not_done').forEach((row) => add(row.logDate, 'routines'));

  return daysBack(data.today, days).map((date) => ({ date, count: counts.get(date)?.size ?? 0 }));
}

function Heatmap({ days, compact = false }: { days: { date: string; count: number }[]; compact?: boolean }) {
  const tone = (count: number) => {
    if (count >= 4) return 'bg-brass';
    if (count >= 2) return 'bg-brass/65';
    if (count === 1) return 'bg-brass/30';
    return 'bg-card';
  };

  return (
    <div className={`grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1 ${compact ? 'max-w-full' : ''}`}>
      {days.map((day) => (
        <div
          key={day.date}
          title={`${day.date}: ${day.count} logged module${day.count === 1 ? '' : 's'}`}
          className={`${compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'} shrink-0 rounded-[3px] border border-rule ${tone(day.count)} hover:border-brass`}
        />
      ))}
    </div>
  );
}

function ProgressBar({ value, max, tone = colors.brass }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-rule">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: tone }} />
      </div>
      <div className="mt-1 text-xs text-[var(--muted)]">{pct}%</div>
    </div>
  );
}

function daysLoggedThisWeek(data: Dashboard) {
  const week = new Set(daysBack(data.today, 7));
  return moduleCountsByDay(data, 7).filter((day) => week.has(day.date) && day.count > 0).length;
}

function daysUntil(dateIso: string, todayIso: string) {
  const end = new Date(dateIso).getTime();
  const now = new Date(todayIso).getTime();
  return Math.ceil((end - now) / 86400000);
}

function navigateTo(tab: string, options?: string | { healthTab?: string; financeTab?: string; learningTab?: string }) {
  if (typeof window !== 'undefined') {
    const next = typeof options === 'string' ? { healthTab: options } : options;
    if (next?.healthTab) window.sessionStorage.setItem('life-ledger-health-tab', next.healthTab);
    if (next?.financeTab) window.sessionStorage.setItem('life-ledger-finance-tab', next.financeTab);
    if (next?.learningTab) window.sessionStorage.setItem('life-ledger-learning-tab', next.learningTab);
  }
  setTimeout(() => document.querySelector<HTMLButtonElement>(`button[data-tab="${tab}"]`)?.click());
}

function goalChildren(data: Dashboard, parentGoalId: string | null) {
  return data.goals
    .filter((goal) => (goal.parentGoalId ?? null) === parentGoalId)
    .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
}

function childGoalLevel(level: string) {
  if (level === 'life') return 'monthly';
  if (level === 'monthly') return 'weekly';
  if (level === 'weekly') return 'daily';
  return null;
}

function goalLevelLabel(level: string) {
  if (level === 'life') return 'North Star';
  if (level === 'monthly') return 'Monthly Milestone';
  if (level === 'weekly') return 'Weekly Goal';
  if (level === 'daily') return 'Daily Goal';
  return 'Goal';
}

function addGoalLabel(level: string) {
  if (level === 'monthly') return '+ Add monthly milestone';
  if (level === 'weekly') return '+ Add weekly goal';
  if (level === 'daily') return '+ Add daily goal';
  return '+ Add child goal';
}

function goalTitle(data: Dashboard, goalId?: string | null) {
  if (!goalId) return null;
  return data.goals.find((goal) => goal.id === goalId)?.title ?? null;
}

function goalDefinition(goal: Row) {
  return String(goal.definitionOfDone ?? goal.targetDescription ?? '');
}

function northStarForGoal(data: Dashboard, goal: Row | null | undefined) {
  let current = goal;
  const seen = new Set<string>();
  while (current?.parentGoalId && !seen.has(String(current.id))) {
    seen.add(String(current.id));
    current = data.goals.find((item) => item.id === current?.parentGoalId);
  }
  return current?.level === 'life' ? current : null;
}

function northStarWhyLine(data: Dashboard, goal: Row | null | undefined) {
  const northStar = northStarForGoal(data, goal);
  if (!northStar?.whyThisMatters) return null;
  return `Part of: ${northStar.title} - because ${northStar.whyThisMatters}`;
}

function monthEndDate(todayIso: string) {
  const date = new Date(todayIso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function currentFocusGoal(data: Dashboard) {
  const focusGoalId = data.focusCycle?.focusGoalId;
  return focusGoalId ? data.goals.find((goal) => goal.id === focusGoalId) ?? null : null;
}

function descendantGoalIds(data: Dashboard, goalId: string) {
  const ids = new Set<string>([goalId]);
  let changed = true;
  while (changed) {
    changed = false;
    data.goals.forEach((goal) => {
      if (goal.parentGoalId && ids.has(goal.parentGoalId) && !ids.has(goal.id)) {
        ids.add(goal.id);
        changed = true;
      }
    });
  }
  return ids;
}

function goalProgress(data: Dashboard, goalId: string) {
  const ids = descendantGoalIds(data, goalId);
  const completable = data.goals.filter((goal) => ids.has(goal.id) && goal.id !== goalId && (goal.level === 'weekly' || goal.level === 'daily'));
  const complete = completable.filter((goal) => goal.completed).length;
  return { complete, total: completable.length };
}

function parseTargetAmount(value?: string | number | null) {
  if (value == null) return 0;
  const text = String(value).toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return 0;
  if (text.includes('crore') || /\bcr\b/.test(text)) return base * 10000000;
  if (text.includes('lakh') || /\bl\b/.test(text)) return base * 100000;
  return base;
}

function financeGoalProgress(data: Dashboard, goal: Row) {
  const linkedDebts = data.debts.filter((debt) => debt.linkedGoalId === goal.id);
  const linkedSavings = data.savings?.linkedGoalId === goal.id ? data.savings : null;
  const debtTarget = linkedDebts.reduce((sum, debt) => sum + Number(debt.principal ?? 0), 0);
  const debtRemaining = linkedDebts.reduce((sum, debt) => sum + Number(debt.balance ?? 0), 0);
  const savingsTarget = linkedSavings ? Number(linkedSavings.goalAmount ?? 0) || parseTargetAmount(goal.targetMetric) : 0;
  const savingsCurrent = linkedSavings ? Number(linkedSavings.balance ?? 0) : 0;
  const total = debtTarget + savingsTarget;
  if (!total) return null;
  const complete = Math.min(total, Math.max(0, debtTarget - debtRemaining) + Math.min(savingsCurrent, savingsTarget));
  return {
    complete,
    total,
    pct: Math.round((complete / total) * 100),
    label: linkedDebts.length && linkedSavings ? 'finance progress' : linkedDebts.length ? 'debt reduced' : 'savings progress',
  };
}

function goalLevelClasses(level: string) {
  if (level === 'life') return {
    card: 'border-l-4 border-l-brass bg-card shadow-sm',
    title: 'text-lg font-semibold text-ink',
    meta: 'text-xs',
    pad: 'p-4',
  };
  if (level === 'monthly') return {
    card: 'border-l-4 border-l-moss/70 bg-background/60',
    title: 'text-base font-semibold text-ink',
    meta: 'text-xs',
    pad: 'p-3',
  };
  if (level === 'weekly') return {
    card: 'border-l-2 border-l-brass/45 bg-card/80',
    title: 'text-sm font-medium text-ink',
    meta: 'text-xs',
    pad: 'p-3',
  };
  return {
    card: 'border-l-2 border-l-rule bg-card/70',
    title: 'text-sm font-medium text-ink',
    meta: 'text-xs',
    pad: 'px-3 py-2.5',
  };
}

function debtSeries(data: Dashboard) {
  const payments = [...data.debtPayments].sort((a, b) => String(a.paidOn).localeCompare(String(b.paidOn)));
  const initialDebt = data.debts.reduce((sum, item) => sum + Number(item.principal ?? item.balance), 0);
  let running = initialDebt;
  const points = [{ date: payments[0]?.paidOn ? dateKey(payments[0].paidOn) : data.today, debt: Number(initialDebt.toFixed(2)) }];
  payments.forEach((payment) => {
    running = Math.max(0, running - Number(payment.principalPortion ?? payment.amount));
    points.push({ date: dateKey(payment.paidOn), debt: Number(running.toFixed(2)) });
  });
  const currentDebt = data.debts.reduce((sum, item) => sum + Number(item.balance), 0);
  if (!points.length || points.at(-1)?.date !== data.today) points.push({ date: data.today, debt: Number(currentDebt.toFixed(2)) });
  return points;
}

function assetSeries(data: Dashboard) {
  const rows = data.netWorthSnapshots.map((row) => ({
    date: dateKey(row.snapshotDate),
    assets: Number(row.totalAssets ?? 0),
  }));
  if (!rows.length && !data.assets.length) return [];
  if (!rows.length) rows.push({ date: data.today, assets: totalAssets(data) });
  return rows;
}

function netWorthSeries(data: Dashboard) {
  const rows = data.netWorthSnapshots.map((row) => ({
    date: dateKey(row.snapshotDate),
    netWorth: Number(row.netWorth ?? 0),
  }));
  if (!rows.length && !data.assets.length && !data.debts.length) return [];
  if (!rows.length) rows.push({ date: data.today, netWorth: totalAssets(data) - totalLiabilities(data) });
  return rows;
}

function totalAssets(data: Dashboard) {
  return data.assets.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
}

function totalLiabilities(data: Dashboard) {
  return data.debts.reduce((sum, item) => sum + Number(item.balance ?? 0), 0);
}

function monthlyPaymentRate(data: Dashboard) {
  const byMonth = new Map<string, number>();
  data.transactions
    .filter((row) => row.type === 'debt_payment')
    .forEach((row) => {
      const key = monthKey(row.transactionDate ?? row.createdAt);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(row.amount ?? 0));
    });
  if (byMonth.size) {
    const avg = [...byMonth.values()].reduce((sum, value) => sum + value, 0) / byMonth.size;
    if (avg > 0) return avg;
  }
  return data.debtPayments.reduce((sum, row) => sum + Number(row.amount), 0) / Math.max(1, data.debtPayments.length);
}

function projectedPayoff(data: Dashboard) {
  const payoffDates = data.loanSummaries
    .map((item) => item.projectedPayoffDate ? new Date(item.projectedPayoffDate).getTime() : null)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (payoffDates.length) {
    return new Date(Math.max(...payoffDates)).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }
  const debt = data.debts.reduce((sum, item) => sum + Number(item.balance), 0);
  const monthly = monthlyPaymentRate(data);
  if (!debt || !monthly) return 'No projection yet';
  const date = new Date(data.today);
  date.setUTCMonth(date.getUTCMonth() + Math.ceil(debt / monthly));
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function studyStreak(data: Dashboard) {
  const studied = new Set(data.sessions.map((row) => dateKey(row.logDate)));
  let streak = 0;
  for (const date of [...daysBack(data.today, 365)].reverse()) {
    if (!studied.has(date)) break;
    streak += 1;
  }
  return streak;
}

export function LedgerDashboard({ name }: { name?: string | null }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [active, setActive] = useState('Today');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [undo, setUndo] = useState<{ type: string; id: string; label: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch('/api/ledger/dashboard', { cache: 'no-store' });
    if (response.ok) setData(normalizeDashboard(await response.json()));
    setLoading(false);
  }

  async function action(type: string, payload: Row = {}) {
    setSaving(true);
    await fetch('/api/ledger/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
    await load();
    setSaving(false);

    if (type.endsWith('.delete') && payload.id) {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo({ type: type.replace('.delete', '.restore'), id: String(payload.id), label: String(payload.label ?? 'Entry') });
      undoTimer.current = setTimeout(() => setUndo(null), 7000);
    }
  }

  async function restoreDeleted() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const pending = undo;
    setUndo(null);
    setSaving(true);
    await fetch('/api/ledger/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: pending.type, payload: { id: pending.id } }),
    });
    await load();
    setSaving(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const xpToNext = Math.max((data?.stats?.level ?? 1) * 100, 100);
  const xp = data?.stats?.xp ?? 0;
  const xpPct = Math.min(100, Math.round((xp / xpToNext) * 100));
  const initials = (name ?? 'LL').split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'LL';
  const firstName = name?.split(/\s|@/).filter(Boolean)[0] ?? 'Raman';

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      <aside className="bg-[var(--sidebar)] text-white md:sticky md:top-0 md:h-screen md:w-[260px] md:shrink-0">
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <AppLogoMark className="h-11 w-11 shrink-0 shadow-[0_16px_34px_rgba(79,70,229,0.26)]" />
            <div className="min-w-0">
              <div className="text-base font-semibold tracking-tight">Life Ledger</div>
              <div className="mt-1 text-xs text-slate-400">Personal operating system</div>
            </div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-2 md:block md:space-y-1 md:p-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              data-tab={tab.key}
              onClick={() => setActive(tab.key)}
              className={`flex min-h-11 w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                active === tab.key ? 'bg-[#EEF2FF] text-[#4338CA] shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white active:scale-[0.99]'
              }`}
            >
              <NavIcon name={tab.icon} className={`h-4 w-4 ${active === tab.key ? 'text-[#4338CA]' : 'text-slate-500'}`} />
              {tab.key}
            </button>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-4 md:block">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4F46E5] text-sm font-semibold text-white ring-2 ring-white/10">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{name ?? 'Life Ledger'}</div>
              <div className="text-xs text-slate-400">Signed in</div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-rule bg-background/85 px-5 py-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur-xl md:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="mr-auto min-w-56">
              <div className="label-caps">Personal OS</div>
              <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-ink">Welcome back, {firstName}</h1>
            </div>

            <label className="hidden min-h-11 w-full max-w-md items-center gap-3 rounded-2xl border border-rule bg-card px-4 text-sm text-[var(--muted)] shadow-sm lg:flex">
              <NavIcon name="search" className="h-4 w-4 text-[var(--muted)]" />
              <input className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--muted)]" placeholder="Search goals, notes, habits..." aria-label="Search" />
            </label>

            <div className="hidden min-w-48 rounded-2xl border bg-card px-4 py-3 shadow-sm xl:block">
              <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>Level {data?.stats?.level ?? 1}</span>
                <span>{xp}/{xpToNext} XP</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-rule">
                <div className="h-full rounded-full bg-brass transition-all" style={{ width: `${xpPct}%` }} />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-card text-[var(--muted)] shadow-sm transition hover:border-brass hover:text-brass active:scale-95" aria-label="Notifications">
                <NavIcon name="bell" className="h-4 w-4" />
              </button>
              <button type="button" className="hidden min-h-11 items-center gap-2 rounded-2xl border border-[#8B5CF6]/25 bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(99,102,241,0.24)] transition hover:scale-[1.01] md:inline-flex">
                <NavIcon name="sparkles" className="h-4 w-4" />
                AI Assistant
              </button>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brass text-sm font-semibold text-white shadow-sm">
                {initials}
              </div>
            </div>

            <div className="flex w-full items-center gap-3 text-sm text-[var(--muted)] lg:hidden">
              <label className="flex min-h-11 flex-1 items-center gap-3 rounded-2xl border bg-card px-4 shadow-sm">
                <NavIcon name="search" className="h-4 w-4" />
                <input className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--muted)]" placeholder="Search ledger..." aria-label="Search" />
              </label>
              <div className="rounded-2xl border bg-card px-3 py-2 shadow-sm">
                <div className="text-xs">Streak</div>
                <div className="font-semibold tabular-nums text-brass">{data?.stats?.currentStreak ?? 0}d</div>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
          {loading && <Parchment title="Loading">Opening the ledger...</Parchment>}
          {!loading && data && (
            <>
              {active === 'Today' && <Today key={data.journal?.id ?? 'new-entry'} data={data} action={action} saving={saving} />}
              {active === 'Goals' && <Goals data={data} action={action} />}
              {active === 'Finance' && <Finance data={data} action={action} />}
              {active === 'Health' && <Health data={data} action={action} />}
              {active === 'Relationships' && <Relationships data={data} action={action} />}
              {active === 'Learning' && <Learning data={data} action={action} />}
              {active === 'Habits' && <Habits data={data} action={action} />}
              {active === 'Routines' && <Routines data={data} action={action} />}
              {active === 'Review' && <Review key={data.weeklyReflection?.id ?? data.weekStart} data={data} action={action} />}
              {active === 'Settings' && <CycleSettings key={data.focusCycle?.id ?? 'cycle'} data={data} action={action} />}
            </>
          )}
        </div>
      </main>
      {undo && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-lg">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 text-ink">{undo.label} moved to archive.</div>
            <button className="rounded-xl border border-brass px-3 py-1.5 text-xs font-medium text-brass hover:bg-brass hover:text-white" onClick={restoreDeleted}>
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Today({ data, action, saving }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void>; saving: boolean }) {
  const [mood, setMood] = useState(data.journal?.mood ?? 'Steady');
  const [body, setBody] = useState(data.journal?.body ?? '');
  const [taggedGoalIds, setTaggedGoalIds] = useState<string[]>(() => (data.journal?.goalTags ?? []).map((row: Row) => String(row.goalId)));
  const [taggedHabitIds, setTaggedHabitIds] = useState<string[]>(() => (data.journal?.habitTags ?? []).map((row: Row) => String(row.habitId)));
  const [goal, setGoal] = useState('');
  const xpToNext = Math.max((data.stats?.level ?? 1) * 100, 100);
  const xp = data.stats?.xp ?? 0;
  const latestWeight = data.weights.at(-1)?.weight;
  const previousWeight = data.weights.at(-2)?.weight;
  const debtPaidThisMonth = financeTotalsForMonth(data).debtPaid;
  const cycleDaysLeft = data.focusCycle?.endDate ? daysUntil(String(data.focusCycle.endDate), data.today) : null;
  const todayGoals = data.goals.filter((item) => item.level === 'daily' && dateKey(item.targetDate) === data.today);
  const todayGoalIds = new Set(todayGoals.map((item) => String(item.id)));
  const workGoalOptions = data.goals.filter((item) => todayGoalIds.has(String(item.id)) || item.level === 'weekly');
  const workHabitOptions = data.habits.filter((item) => item.kind === 'break' || item.lastCheckin !== data.today);
  const toggleTag = (kind: 'goal' | 'habit', id: string) => {
    const setter = kind === 'goal' ? setTaggedGoalIds : setTaggedHabitIds;
    setter((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <div className="space-y-5">
      {cycleDaysLeft != null && cycleDaysLeft <= 5 ? (
        <div className="rounded-2xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-ink">
          This focus cycle ends in <span className="font-semibold tabular-nums text-brass">{Math.max(cycleDaysLeft, 0)} days</span>. Visit Settings to choose the next North Star when you are ready.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <CurrentFocusPanel data={data} action={action} />
        <AIInsightCard data={data} />
      </div>

      <TodayRoutines data={data} action={action} />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="stat-card border-l-4 border-l-brass p-5">
          <Stat label="Streak" value={`${data.stats?.currentStreak ?? 0}d`} tone="text-brass" />
        </div>
        <div className="stat-card border-l-4 border-l-moss p-5">
          <div className="label-caps mb-2">Level {data.stats?.level ?? 1}</div>
          <ProgressBar value={xp} max={xpToNext} />
          <div className="mt-1 text-xs text-[var(--muted)]">{xp}/{xpToNext} XP</div>
        </div>
        <div className="stat-card border-l-4 border-l-[#06B6D4] p-5">
          <Stat label="Days logged" value={`${daysLoggedThisWeek(data)}/7`} tone="text-moss" />
        </div>
        <div className="stat-card border-l-4 border-l-wax p-5">
          <Stat
            label={latestWeight && previousWeight ? 'Weight trend' : 'Debt paid'}
            value={latestWeight && previousWeight ? `${Number(latestWeight) <= Number(previousWeight) ? '↓' : '↑'} ${Math.abs(Number(latestWeight) - Number(previousWeight)).toFixed(1)}` : Number(debtPaidThisMonth).toFixed(0)}
            tone={latestWeight && previousWeight && Number(latestWeight) > Number(previousWeight) ? 'text-wax' : 'text-moss'}
          />
        </div>
      </div>

      <ExecutiveSnapshots data={data} />

      <Parchment title="Last 90 Days" eyebrow="Activity heatmap">
        <Heatmap days={moduleCountsByDay(data, 90)} />
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>Less</span>
          <span className="h-3 w-3 rounded-[3px] border border-rule bg-card" />
          <span className="h-3 w-3 rounded-[3px] border border-brass/20 bg-brass/25" />
          <span className="h-3 w-3 rounded-[3px] border border-brass/30 bg-brass/55" />
          <span className="h-3 w-3 rounded-[3px] border border-brass/40 bg-brass" />
          <span>More</span>
        </div>
      </Parchment>

      <Parchment title="Today's Entry" eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}>
        <div className="flex flex-wrap gap-2">
          {moods.map((item) => (
            <button key={item} onClick={() => setMood(item)} className={`rounded-xl border px-3 py-1.5 text-sm transition duration-200 active:scale-95 ${mood === item ? 'border-brass bg-brass text-white shadow-sm' : 'hover:border-brass hover:bg-brass/5 hover:text-brass'}`}>
              {item}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <div className="mb-2 text-xs font-medium text-[var(--muted)]">Worked on</div>
          <div className="flex flex-wrap gap-1.5">
            {[...workGoalOptions, ...workHabitOptions].length === 0 ? <span className="text-xs text-[var(--muted)]">No active goals or due habits today.</span> : null}
            {workGoalOptions.map((item) => (
              <button
                key={`goal-${item.id}`}
                type="button"
                onClick={() => toggleTag('goal', String(item.id))}
                className={`rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${taggedGoalIds.includes(String(item.id)) ? 'border-brass bg-brass text-white' : 'bg-card text-[var(--muted)] hover:border-brass hover:text-brass'}`}
              >
                {item.title}
              </button>
            ))}
            {workHabitOptions.map((item) => (
              <button
                key={`habit-${item.id}`}
                type="button"
                onClick={() => toggleTag('habit', String(item.id))}
                className={`rounded-full border px-2.5 py-1 text-xs transition active:scale-95 ${taggedHabitIds.includes(String(item.id)) ? 'border-brass bg-brass text-white' : 'bg-card text-[var(--muted)] hover:border-brass hover:text-brass'}`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
        <TextArea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write today's entry..." className={body.trim() ? 'mt-4 min-h-36' : 'mt-4'} />
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm italic text-[var(--muted)]">{data.journal ? 'Entry started' : '+10 XP for first entry today'}</span>
          <div className="flex gap-2">
            {data.journal?.id ? <button disabled={saving} className="btn" onClick={() => action('journal.delete', { id: data.journal?.id, label: 'Journal entry' })}>Delete</button> : null}
            <button disabled={saving} className="btn btn-primary" onClick={() => action('journal.save', { mood, body, goalIds: taggedGoalIds, habitIds: taggedHabitIds })}>Save entry</button>
          </div>
        </div>
      </Parchment>

      <div className="grid gap-5 lg:grid-cols-2">
        <PatternsPanel patterns={data.patterns} />

        <Parchment title="Journal History" eyebrow="Recent entries">
          {data.journalEntries.length === 0 ? <Empty tone="ink">No journal entries yet.</Empty> : null}
          {[...data.journalEntries].reverse().slice(0, 8).map((item) => (
            <ListItem
              key={item.id}
              title={`${item.entryDate} · ${item.mood}`}
              note={String(item.body ?? '').slice(0, 120)}
              onEdit={() => {
                const nextBody = ask('Edit journal entry', item.body);
                if (nextBody != null) action('journal.update', { id: item.id, mood: item.mood, body: nextBody });
              }}
              onDelete={() => action('journal.delete', { id: item.id, label: 'Journal entry' })}
            />
          ))}
        </Parchment>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Parchment title="Today's Goals" eyebrow="Checklist">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (goal.trim()) action('goal.add', { title: goal.trim(), level: 'daily', targetDate: data.today }).then(() => setGoal(''));
            }}
            className="mb-4 flex gap-2"
          >
            <Field value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Add a goal for today..." />
            <button className="btn btn-primary">Add</button>
          </form>
          {todayGoals.length === 0 ? <Empty tone="moss">No goals for today.</Empty> : null}
          {todayGoals.map((item) => (
            <ListItem
              key={item.id}
              title={item.title}
              muted={item.completed}
              right={<button className={`btn ${item.completed ? 'check-pop border-moss bg-moss text-white' : ''}`} onClick={() => action('goal.toggle', { id: item.id })}>{item.completed ? 'Undo' : 'Done'}</button>}
              onEdit={() => {
                const title = ask('Edit daily goal', item.title);
                if (title) action('goal.update', { id: item.id, title, targetDescription: item.targetDescription ?? '', targetDate: item.targetDate ?? data.today });
              }}
              onDelete={() => action('goal.delete', { id: item.id, label: 'Daily goal' })}
            />
          ))}
        </Parchment>

        <QuickLogStrip />
      </div>
    </div>
  );
}

function routineAppliesNow(anchor?: string | null) {
  if (!anchor || anchor === 'anytime') return true;
  const hour = new Date().getHours();
  if (anchor === 'morning') return hour >= 4 && hour < 12;
  if (anchor === 'afternoon') return hour >= 12 && hour < 17;
  if (anchor === 'evening') return hour >= 17 && hour < 22;
  if (anchor === 'night') return hour >= 22 || hour < 4;
  return true;
}

function routineAnchorLabel(anchor?: string | null) {
  if (!anchor || anchor === 'anytime') return 'Anytime';
  return anchor[0].toUpperCase() + anchor.slice(1);
}

function routineStepTypeLabel(type?: string | null) {
  const labels: Record<string, string> = {
    habit: 'Habit',
    daily_goal: 'Daily goal',
    weekly_goal: 'Weekly goal',
    learning: 'Learning',
    finance: 'Finance',
    journal: 'Journal',
    standalone: 'Standalone',
  };
  return labels[String(type)] ?? 'Step';
}

function routineStepTargetLabel(data: Dashboard, step: Row) {
  if (step.stepType === 'habit' && step.linkedHabitId) return data.habits.find((item) => item.id === step.linkedHabitId)?.name;
  if (step.stepType === 'daily_goal' && step.linkedDailyGoalId) return data.goals.find((item) => item.id === step.linkedDailyGoalId)?.title;
  if (step.stepType === 'weekly_goal' && step.linkedWeeklyGoalId) return data.goals.find((item) => item.id === step.linkedWeeklyGoalId)?.title;
  if (step.stepType === 'learning' && step.linkedSkillId) return data.skills.find((item) => item.id === step.linkedSkillId)?.name;
  if (step.stepType === 'finance') return 'Finance activity today';
  if (step.stepType === 'journal') return 'Today journal entry';
  return null;
}

function TodayRoutines({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const routines = data.routineStatuses.filter((routine) => routineAppliesNow(routine.timeAnchor));
  if (data.routines.length === 0) return null;

  const openStepTarget = (step: Row) => {
    if (step.actionTab === 'Finance') navigateTo('Finance', { financeTab: 'Transactions' });
    else if (step.actionTab === 'Learning') navigateTo('Learning', { learningTab: 'Sessions' });
    else if (step.actionTab === 'Today') navigateTo('Today');
  };

  return (
    <Parchment title="Routines" eyebrow="Live checklists">
      {routines.length === 0 ? <Empty tone="moss">No routines scheduled for this time of day.</Empty> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {routines.map((routine) => (
          <div key={routine.id} className={`rounded-2xl border bg-background/45 p-4 ${routine.protected ? 'border-l-4 border-l-brass shadow-[0_14px_34px_rgba(79,70,229,0.08)]' : ''}`}>
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-ink">{routine.name}</h3>
                  <span className="rounded-full border px-2 py-0.5 text-xs text-[var(--muted)]">{routineAnchorLabel(routine.timeAnchor)}</span>
                  {routine.protected ? <span className="rounded-full border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs font-medium text-brass">Protected</span> : null}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {routine.completedSteps}/{routine.totalSteps} steps · {routine.streak ?? 0}d routine streak
                </div>
              </div>
              <strong className="text-lg tabular-nums text-brass">{routine.completionPct}%</strong>
            </div>
            <ProgressBar value={Number(routine.completionPct ?? 0)} max={100} tone={routine.completionPct === 100 ? colors.moss : colors.brass} />
            <div className="mt-4 space-y-2">
              {(routine.steps ?? []).map((step: Row) => {
                const done = Boolean(step.done);
                const targetLabel = routineStepTargetLabel(data, step);
                const canToggle = !step.readOnly && !(step.stepType === 'habit' && done);
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={!canToggle && !step.readOnly}
                    onClick={() => {
                      if (step.readOnly) openStepTarget(step);
                      else if (canToggle) action('routineStep.toggle', { id: step.id });
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition active:scale-[0.99] ${done ? 'border-moss/30 bg-moss/10 text-ink' : 'bg-card text-ink hover:border-brass hover:text-brass'} ${step.readOnly && !done ? 'border-dashed' : ''}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${done ? 'border-moss bg-moss text-white' : 'border-rule bg-background text-transparent'}`}>✓</span>
                    <span className="min-w-0 flex-1">
                      <span className={done ? 'font-medium line-through decoration-moss/60' : 'font-medium'}>{step.stepName}</span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {routineStepTypeLabel(String(step.stepType))}{targetLabel ? ` · ${targetLabel}` : ''}{step.readOnly && !done ? ' · open to log' : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Parchment>
  );
}

function AIInsightCard({ data }: { data: Dashboard }) {
  const pattern = data.patterns[0];
  const focusGoal = currentFocusGoal(data);
  const fallback = focusGoal
    ? `Your current focus is ${focusGoal.title}. Keep today narrow: one daily goal, one supporting habit, then journal the result.`
    : 'Set a North Star in Cycle Settings to unlock a clearer focus thread across goals, habits, and journal entries.';

  return (
    <section className="relative overflow-hidden rounded-[18px] border border-[#8B5CF6]/30 bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] p-6 text-white shadow-[0_22px_54px_rgba(99,102,241,0.26)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_16rem)]" />
      <div className="relative">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur">
          <NavIcon name="sparkles" className="h-3.5 w-3.5" />
          AI Insight
        </div>
        <h2 className="text-[22px] font-semibold leading-tight tracking-tight">Today&apos;s signal</h2>
        <p className="mt-3 text-sm leading-6 text-white/86">
          {pattern ? String(pattern.sentence) : fallback}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/80">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur">Weekly refresh</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur">Private data</span>
        </div>
      </div>
    </section>
  );
}

function ExecutiveSnapshots({ data }: { data: Dashboard }) {
  const weeklyMinutes = data.sessions
    .filter((row) => new Date(row.logDate).getTime() >= new Date(data.weekStart).getTime())
    .reduce((sum, row) => sum + Number(row.minutes), 0);
  const habitCompletion = data.habits.length
    ? Math.round((data.habits.filter((row) => row.lastCheckin === data.today || (row.kind === 'break' && row.lastSlip !== data.today)).length / data.habits.length) * 100)
    : 0;
  const latestWeight = data.weights.at(-1)?.weight;
  const cards = [
    { label: 'Finance Snapshot', value: totalLiabilities(data).toFixed(0), note: 'current liabilities', icon: 'coins', color: '#16A34A' },
    { label: 'Health Snapshot', value: latestWeight ? Number(latestWeight).toFixed(1) : '-', note: data.workouts.length ? `${data.workouts.length} workouts logged` : 'no recent workouts', icon: 'heart', color: '#EF4444' },
    { label: 'Learning Progress', value: `${Math.round(weeklyMinutes / 60)}h`, note: `${studyStreak(data)} day study streak`, icon: 'book', color: '#06B6D4' },
    { label: 'Habit Progress', value: `${habitCompletion}%`, note: 'today completion', icon: 'repeat', color: '#10B981' },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
          className="stat-card group p-5 text-left transition"
          onClick={() => navigateTo(card.label.split(' ')[0] === 'Habit' ? 'Habits' : card.label.split(' ')[0])}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: `${card.color}18`, color: card.color }}>
              <NavIcon name={card.icon} className="h-4 w-4" />
            </span>
            <span className="text-xs text-[var(--muted)] transition group-hover:text-ink">Open</span>
          </div>
          <div className="label-caps">{card.label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">{card.value}</div>
          <div className="mt-1 text-sm text-[var(--muted)]">{card.note}</div>
        </button>
      ))}
    </div>
  );
}

function CurrentFocusPanel({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const focusGoal = currentFocusGoal(data);
  if (!focusGoal) {
    return (
      <section className="parchment border-t-4 border-t-brass bg-brass/5 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="label-caps mb-2">Current Focus</div>
            <h2 className="text-xl font-semibold text-ink">No active focus goal</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Set one in Cycle Settings to connect your weekly goal, daily goals, and linked habits here.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => navigateTo('Settings')}>Cycle Settings</button>
        </div>
      </section>
    );
  }
  const ids = descendantGoalIds(data, focusGoal.id);
  const weeklyGoals = data.goals.filter((goal) => ids.has(goal.id) && goal.level === 'weekly');
  const activeWeekly = weeklyGoals.find((goal) => !goal.completed) ?? weeklyGoals[0] ?? null;
  const dailyGoals = data.goals.filter((goal) => ids.has(goal.id) && goal.level === 'daily' && dateKey(goal.targetDate) === data.today);
  const habits = data.habits.filter((habit) => habit.linkedGoalId && ids.has(String(habit.linkedGoalId)));
  return (
    <section className="parchment overflow-hidden border-t-4 border-t-brass bg-brass/5 p-0">
      <div className="p-5 md:p-6">
        <div className="label-caps mb-2">Current Focus</div>
        <h2 className="text-2xl font-semibold tracking-tight text-brass">{focusGoal.title}</h2>
        {(focusGoal.whyThisMatters || goalDefinition(focusGoal)) ? <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{String(focusGoal.whyThisMatters ?? goalDefinition(focusGoal))}</p> : null}
      </div>
      <div className="border-t bg-card/70">
        <div className="grid divide-y lg:grid-cols-[1fr_1.2fr_1fr] lg:divide-x lg:divide-y-0">
          <div className="p-4">
            <div className="label-caps mb-2">Active weekly goal</div>
            {activeWeekly ? (
              <div className={`text-sm font-medium ${activeWeekly.completed ? 'text-[var(--muted)] line-through' : 'text-ink'}`}>
                {activeWeekly.completed ? <span className="mr-2 text-moss">✓</span> : null}
                {activeWeekly.title}
              </div>
            ) : <div className="text-sm text-[var(--muted)]">No weekly goal connected yet.</div>}
          </div>
          <div className="p-4">
            <div className="label-caps mb-2">Today&apos;s daily goals</div>
            {dailyGoals.length === 0 ? <div className="text-sm text-[var(--muted)]">No daily goals linked for today.</div> : null}
            <div className="flex flex-wrap gap-2">
              {dailyGoals.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => action('goal.toggle', { id: item.id })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${item.completed ? 'border-moss bg-moss text-white' : 'bg-card text-ink hover:border-brass hover:text-brass'}`}
                >
                  {item.completed ? '✓ ' : ''}{item.title}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            <div className="label-caps mb-2">Linked habits</div>
            {habits.length === 0 ? <div className="text-sm text-[var(--muted)]">No habits linked yet.</div> : null}
            <div className="flex flex-wrap gap-2">
              {habits.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => action(item.kind === 'break' ? 'habit.slip' : 'habit.checkin', { id: item.id })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${item.lastCheckin === data.today ? 'border-moss bg-moss text-white' : 'bg-card text-ink hover:border-moss hover:text-moss'}`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickLogStrip() {
  return (
    <Parchment title="Quick Log" eyebrow="Modules">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {moduleOptions.map((item) => (
          <button
            key={item.key}
            onClick={() => navigateTo(item.tab, 'healthTab' in item ? item.healthTab : undefined)}
            className="shrink-0 rounded-xl border bg-background px-3 py-2 text-sm text-[var(--muted)] transition hover:border-brass hover:text-brass active:scale-[0.98]"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </Parchment>
  );
}

function Goals({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const focusGoal = currentFocusGoal(data);
    return new Set(focusGoal ? [String(focusGoal.id)] : []);
  });
  const roots = goalChildren(data, null);
  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return (
    <div className="space-y-5">
      <Parchment title="Goal Tree" eyebrow="North Star to daily">
        <GoalAddForm data={data} action={action} showLevelSelect />
        {roots.length === 0 ? <Empty tone="moss">No goals added yet.</Empty> : null}
        <div className="space-y-3">
          {roots.map((goal) => (
            <GoalTreeItem
              key={goal.id}
              data={data}
              goal={goal}
              depth={0}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              action={action}
            />
          ))}
        </div>
      </Parchment>
    </div>
  );
}

function GoalAddForm({
  data,
  action,
  parentGoal,
  level: fixedLevel,
  showLevelSelect = false,
}: {
  data: Dashboard;
  action: (type: string, payload?: Row) => Promise<void>;
  parentGoal?: Row;
  level?: string;
  showLevelSelect?: boolean;
}) {
  const initialLevel = fixedLevel ?? 'life';
  const [level, setLevel] = useState(initialLevel);
  const [title, setTitle] = useState('');
  const [targetMetric, setTargetMetric] = useState('');
  const [targetDate, setTargetDate] = useState(initialLevel === 'monthly' ? monthEndDate(data.today) : '');
  const [definitionOfDone, setDefinitionOfDone] = useState('');
  const [whyThisMatters, setWhyThisMatters] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(initialLevel === 'life');
  const effectiveLevel = fixedLevel ?? level;
  const parentWhy = ['monthly', 'weekly'].includes(effectiveLevel) ? northStarWhyLine(data, parentGoal) : null;
  const promptByLevel: Record<string, string> = {
    life: "What's the ONE thing you can do such that by doing it, everything else becomes easier or unnecessary?",
    monthly: "What's your one thing this month, given your North Star?",
    weekly: "What's your one thing this week?",
    daily: "What's your one thing today?",
  };
  const prompt = promptByLevel[effectiveLevel] ?? 'What is the next clear goal?';
  const parentContext = parentGoal ? String(parentGoal.title ?? '') : '';

  const clearDetailsForLevel = (nextLevel: string) => {
    setDetailsOpen(nextLevel === 'life');
    setTargetDate(nextLevel === 'monthly' ? monthEndDate(data.today) : '');
    setTargetMetric('');
    setDefinitionOfDone('');
    setWhyThisMatters('');
  };

  const reset = () => {
    setTitle('');
    setTargetMetric('');
    setTargetDate(effectiveLevel === 'monthly' ? monthEndDate(data.today) : '');
    setDefinitionOfDone('');
    setWhyThisMatters('');
    setDetailsOpen(effectiveLevel === 'life');
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        action('goal.add', {
          parentGoalId: parentGoal?.id,
          level: effectiveLevel,
          title: title.trim(),
          targetMetric,
          targetDate,
          definitionOfDone,
          whyThisMatters,
        }).then(reset);
      }}
      className={`${parentGoal ? 'rounded-2xl border border-dashed border-brass/35 bg-brass/5 p-3' : 'mb-5 rounded-2xl border bg-background/60 p-4'}`}
    >
      <div className="mb-3 rounded-2xl border border-brass/20 bg-brass/5 p-4">
        <div className="label-caps mb-2">{effectiveLevel === 'life' ? 'Focusing question' : goalLevelLabel(effectiveLevel)}</div>
        <p className="text-base font-semibold leading-6 text-ink">{prompt}</p>
        {parentContext ? (
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Parent: <span className="font-medium text-ink">{parentContext}</span>
          </p>
        ) : null}
      </div>
      <div className={`grid gap-2 ${showLevelSelect ? 'md:grid-cols-[1fr_190px_auto]' : 'md:grid-cols-[1fr_auto]'}`}>
        <Field value={title} onChange={(event) => setTitle(event.target.value)} placeholder={effectiveLevel === 'life' ? 'Answer the focusing question...' : 'Answer with the next one thing...'} />
        {showLevelSelect ? (
          <Select value={level} onChange={(event) => {
            const nextLevel = event.target.value;
            setLevel(nextLevel);
            clearDetailsForLevel(nextLevel);
          }}>
            <option value="life">North Star</option>
            <option value="monthly">Monthly milestone</option>
            <option value="weekly">Weekly goal</option>
            <option value="daily">Daily goal</option>
          </Select>
        ) : null}
        <button className="btn btn-primary">{effectiveLevel === 'life' ? 'Add North Star' : addGoalLabel(effectiveLevel).replace('+ ', '')}</button>
      </div>

      {effectiveLevel !== 'daily' ? (
        <div className="mt-3">
          <button
            type="button"
            className="text-sm font-medium text-brass hover:text-brass-deep"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen ? 'Hide detail' : 'Add more detail'}
          </button>
          {detailsOpen ? (
            <GoalSmartFields
              data={data}
              level={effectiveLevel}
              parentGoal={parentGoal}
              targetMetric={targetMetric}
              setTargetMetric={setTargetMetric}
              targetDate={targetDate}
              setTargetDate={setTargetDate}
              definitionOfDone={definitionOfDone}
              setDefinitionOfDone={setDefinitionOfDone}
              whyThisMatters={whyThisMatters}
              setWhyThisMatters={setWhyThisMatters}
              parentWhy={parentWhy}
            />
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function GoalSmartFields({
  level,
  targetMetric,
  setTargetMetric,
  targetDate,
  setTargetDate,
  definitionOfDone,
  setDefinitionOfDone,
  whyThisMatters,
  setWhyThisMatters,
  parentWhy,
}: {
  data: Dashboard;
  level: string;
  parentGoal?: Row;
  targetMetric: string;
  setTargetMetric: (value: string) => void;
  targetDate: string;
  setTargetDate: (value: string) => void;
  definitionOfDone: string;
  setDefinitionOfDone: (value: string) => void;
  whyThisMatters: string;
  setWhyThisMatters: (value: string) => void;
  parentWhy?: string | null;
}) {
  if (level === 'daily') return null;
  return (
    <div className="mt-3 space-y-3 rounded-2xl border bg-card/70 p-3">
      {parentWhy ? <div className="text-xs leading-5 text-[var(--muted)]">{parentWhy}</div> : null}
      <div className={level === 'weekly' ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Target metric</span>
          <Field className="mt-1.5" value={targetMetric} onChange={(event) => setTargetMetric(event.target.value)} placeholder={level === 'weekly' ? '15 problems' : level === 'monthly' ? '50 problems solved' : '20 LPA'} />
        </label>
        {['life', 'monthly'].includes(level) ? (
          <label className="block">
            <span className="text-xs font-medium text-[var(--muted)]">Deadline</span>
            <Field className="mt-1.5" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
          </label>
        ) : null}
      </div>
      {['life', 'monthly'].includes(level) ? (
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Definition of done</span>
          <Field className="mt-1.5" value={definitionOfDone} onChange={(event) => setDefinitionOfDone(event.target.value)} placeholder="What specifically counts as achieved?" />
        </label>
      ) : null}
      {level === 'life' ? (
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Why this matters</span>
          <TextArea className="mt-1.5 min-h-24" value={whyThisMatters} onChange={(event) => setWhyThisMatters(event.target.value)} placeholder="The reminder you want to see when motivation dips..." />
        </label>
      ) : null}
    </div>
  );
}

function GoalEditForm({
  data,
  goal,
  action,
  onCancel,
}: {
  data: Dashboard;
  goal: Row;
  action: (type: string, payload?: Row) => Promise<void>;
  onCancel: () => void;
}) {
  const level = String(goal.level);
  const parentGoal = goal.parentGoalId ? data.goals.find((item) => item.id === goal.parentGoalId) : undefined;
  const [title, setTitle] = useState(String(goal.title ?? ''));
  const [targetMetric, setTargetMetric] = useState(String(goal.targetMetric ?? ''));
  const [targetDate, setTargetDate] = useState(goal.targetDate ? dateKey(goal.targetDate) : '');
  const [definitionOfDone, setDefinitionOfDone] = useState(goalDefinition(goal));
  const [whyThisMatters, setWhyThisMatters] = useState(String(goal.whyThisMatters ?? ''));
  const parentWhy = ['monthly', 'weekly'].includes(level) ? northStarWhyLine(data, parentGoal) : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        action('goal.update', {
          id: goal.id,
          title: title.trim(),
          targetMetric,
          targetDate,
          definitionOfDone,
          whyThisMatters,
        }).then(onCancel);
      }}
      className="mt-4 rounded-2xl border bg-background/60 p-3"
    >
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <Field value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Goal title" />
        <button className="btn btn-primary">Save</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
      {level !== 'daily' ? (
        <GoalSmartFields
          data={data}
          level={level}
          parentGoal={parentGoal}
          targetMetric={targetMetric}
          setTargetMetric={setTargetMetric}
          targetDate={targetDate}
          setTargetDate={setTargetDate}
          definitionOfDone={definitionOfDone}
          setDefinitionOfDone={setDefinitionOfDone}
          whyThisMatters={whyThisMatters}
          setWhyThisMatters={setWhyThisMatters}
          parentWhy={parentWhy}
        />
      ) : null}
    </form>
  );
}

function GoalTreeItem({
  data,
  goal,
  depth,
  expanded,
  toggleExpanded,
  action,
}: {
  data: Dashboard;
  goal: Row;
  depth: number;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  action: (type: string, payload?: Row) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const children = goalChildren(data, goal.id);
  const isOpen = expanded.has(goal.id);
  const nextLevel = childGoalLevel(String(goal.level));
  const canComplete = goal.level === 'daily' || goal.level === 'weekly';
  const classes = goalLevelClasses(String(goal.level));
  const financeProgress = financeGoalProgress(data, goal);
  const progress = goalProgress(data, goal.id);
  const progressPct = financeProgress?.pct ?? (progress.total ? Math.round((progress.complete / progress.total) * 100) : 0);
  const hasProgress = Boolean(financeProgress) || ((goal.level === 'life' || goal.level === 'monthly') && progress.total > 0);
  const definition = goalDefinition(goal);
  const parentWhy = ['monthly', 'weekly'].includes(String(goal.level)) ? northStarWhyLine(data, goal) : null;

  return (
    <div className={`${depth > 0 ? 'relative pl-4 before:absolute before:left-0 before:top-0 before:h-full before:border-l before:border-rule' : ''}`}>
      <div className={`rounded-2xl border transition hover:shadow-sm ${classes.card} ${classes.pad}`}>
        <div className="flex items-start gap-2">
        <button
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-brass/10 hover:text-brass active:scale-95"
          onClick={() => toggleExpanded(goal.id)}
          type="button"
          aria-label={isOpen ? 'Collapse goal' : 'Expand goal'}
        >
          {children.length || nextLevel ? <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span> : <span className="text-rule">•</span>}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`truncate ${classes.title} ${goal.completed ? 'text-[var(--muted)] line-through' : ''}`}>
            {canComplete && goal.completed ? <span className="mr-2 text-moss">✓</span> : null}
            {goal.title}
          </div>
          <div className={`mt-1 flex flex-wrap gap-2 text-[var(--muted)] ${classes.meta}`}>
            <span>{goalLevelLabel(String(goal.level))}</span>
            {goal.targetMetric && ['life', 'monthly', 'weekly'].includes(String(goal.level)) ? <span>Target: {String(goal.targetMetric)}</span> : null}
            {goal.targetDate && ['life', 'monthly'].includes(String(goal.level)) ? <span>Due: {dateKey(goal.targetDate)}</span> : null}
          </div>
          {hasProgress ? (
            <div className="mt-3 max-w-sm">
              <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                <span>{financeProgress ? `${financeProgress.complete.toFixed(0)}/${financeProgress.total.toFixed(0)} ${financeProgress.label}` : `${progress.complete}/${progress.total} action goals done`}</span>
                <span className="tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-rule">
                <div className="h-full rounded-full bg-brass transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          ) : null}
        </div>
        {canComplete ? (
          <button className={`btn ${goal.completed ? 'check-pop border-moss bg-moss text-white' : ''}`} onClick={() => action('goal.toggle', { id: goal.id })}>
            {goal.completed ? 'Undo' : 'Done'}
          </button>
        ) : null}
        <button
          className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white"
          onClick={() => setEditing((value) => !value)}
        >
          Edit
        </button>
        <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('goal.delete', { id: goal.id, label: 'Goal' })}>Delete</button>
      </div>
      {editing ? <GoalEditForm data={data} goal={goal} action={action} onCancel={() => setEditing(false)} /> : null}
      {isOpen && !editing && (definition || goal.whyThisMatters || parentWhy) ? (
        <div className="mt-4 space-y-2 border-t pt-3 text-sm text-[var(--muted)]">
          {definition && ['life', 'monthly'].includes(String(goal.level)) ? <div><span className="font-medium text-ink">Done:</span> {definition}</div> : null}
          {goal.whyThisMatters && goal.level === 'life' ? <div><span className="font-medium text-ink">Why:</span> {String(goal.whyThisMatters)}</div> : null}
          {parentWhy ? <div>{parentWhy}</div> : null}
        </div>
      ) : null}
      </div>
      {isOpen ? (
        <div className="mt-2 space-y-2 pl-6">
          {children.map((child) => (
            <GoalTreeItem
              key={child.id}
              data={data}
              goal={child}
              depth={depth + 1}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              action={action}
            />
          ))}
          {nextLevel ? (
            <GoalAddForm data={data} action={action} parentGoal={goal} level={nextLevel} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Finance({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const financeTabs = ['Debts', 'Assets', 'Income', 'Savings', 'Transactions'] as const;
  const [activeFinanceTab, setActiveFinanceTab] = useState<(typeof financeTabs)[number]>(() => {
    if (typeof window === 'undefined') return 'Debts';
    const saved = window.sessionStorage.getItem('life-ledger-finance-tab');
    window.sessionStorage.removeItem('life-ledger-finance-tab');
    return financeTabs.includes(saved as (typeof financeTabs)[number]) ? saved as (typeof financeTabs)[number] : 'Debts';
  });
  const [income, setIncome] = useState({ name: '', amount: '', frequency: 'monthly' });
  const [asset, setAsset] = useState({ name: '', type: 'mutual-fund', currentValue: '' });
  const [debt, setDebt] = useState({
    name: '',
    amount: '',
    loanType: 'personal',
    interestRate: '',
    tenureMonths: '',
    emiAmount: '',
    dueDay: '1',
    linkedGoalId: '',
  });
  const [debtGoalQuery, setDebtGoalQuery] = useState('');
  const [payment, setPayment] = useState({ debtId: '', amount: '' });
  const [savings, setSavings] = useState('');
  const [savingsGoal, setSavingsGoal] = useState(String(data.savings?.goalAmount ?? '10000'));
  const [savingsGoalQuery, setSavingsGoalQuery] = useState('');
  const [range, setRange] = useState(90);
  const [transaction, setTransaction] = useState({ date: data.today, type: 'expense', amount: '', category: 'Food', note: '', linkedDebtId: '' });
  const [transactionFilter, setTransactionFilter] = useState({ type: '', category: '', startDate: '', endDate: '', query: '' });
  const goalOptions = data.goals.map((goal) => ({ id: String(goal.id), label: `${goalLevelLabel(String(goal.level))}: ${goal.title}` }));
  const goalIdFromLabel = (label: string) => goalOptions.find((goal) => goal.label === label)?.id ?? '';
  const goalLabelFromId = (id?: string | null) => goalOptions.find((goal) => goal.id === id)?.label ?? '';
  const totalDebt = totalLiabilities(data);
  const totalAssetValue = totalAssets(data);
  const netWorth = totalAssetValue - totalDebt;
  const currentMonthTotals = financeTotalsForMonth(data);
  const monthlyIncome = currentMonthTotals.income;
  const debtData = filterRange(debtSeries(data), 'date', range, data.today);
  const assetData = filterRange(assetSeries(data), 'date', range, data.today);
  const netWorthData = filterRange(netWorthSeries(data), 'date', range, data.today);
  const monthMix = [
    { name: 'Income', value: currentMonthTotals.income, color: colors.moss },
    { name: 'Expenses', value: currentMonthTotals.expenses, color: colors.wax },
    { name: 'Debt paid', value: currentMonthTotals.debtPaid, color: colors.brass },
  ].filter((item) => item.value > 0);
  const expenseBreakdown = expenseBreakdownForMonth(data).map((item, index) => ({
    ...item,
    color: [colors.wax, colors.warning, colors.brass, colors.moss, colors.cyan, colors.neutral][index % 6],
  }));
  const transactionCategories = [...new Set(['Food', 'Transport', 'Rent', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Debt', 'Income', 'Other', ...data.transactions.map((row) => String(row.category ?? '')).filter(Boolean)])];
  const transactionCategoryValue = transaction.category && transactionCategories.includes(transaction.category) ? transaction.category : '__custom';
  const filteredTransactions = data.transactions.filter((item) => {
    const date = String(item.transactionDate ?? '');
    if (transactionFilter.type && item.type !== transactionFilter.type) return false;
    if (transactionFilter.category && !String(item.category ?? '').toLowerCase().includes(transactionFilter.category.toLowerCase())) return false;
    if (transactionFilter.startDate && date < transactionFilter.startDate) return false;
    if (transactionFilter.endDate && date > transactionFilter.endDate) return false;
    if (transactionFilter.query) {
      const haystack = `${item.category ?? ''} ${item.note ?? ''} ${item.linkedDebt?.name ?? ''}`.toLowerCase();
      if (!haystack.includes(transactionFilter.query.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <datalist id="finance-goal-options">
        {goalOptions.map((goal) => <option key={goal.id} value={goal.label} />)}
      </datalist>
      <datalist id="finance-transaction-categories">
        {transactionCategories.map((category) => <option key={category} value={category} />)}
      </datalist>
      <Parchment title="Ledger" eyebrow="Summary">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat label="Monthly income" value={monthlyIncome.toFixed(2)} tone="text-moss" />
          <Stat label="Assets" value={totalAssetValue.toFixed(2)} tone="text-moss" />
          <Stat label="Total debt" value={totalDebt.toFixed(2)} tone="text-wax" />
          <Stat label="Net worth" value={netWorth.toFixed(2)} tone={netWorth >= 0 ? 'text-brass' : 'text-wax'} />
        </div>
      </Parchment>

      <SubTabs tabs={financeTabs} value={activeFinanceTab} onChange={setActiveFinanceTab} ariaLabel="Finance sections" />

      <div className={activeFinanceTab === 'Income' ? 'space-y-5' : 'hidden'}>
      <Parchment title="Income" eyebrow="Sources">
        <form onSubmit={(e) => submit(e, () => action('income.add', income).then(() => setIncome({ name: '', amount: '', frequency: 'monthly' })))} className="mb-4 grid gap-2 md:grid-cols-[1fr_180px_180px_auto]">
          <Field placeholder="Source name" value={income.name} onChange={(e) => setIncome({ ...income, name: e.target.value })} />
          <Field placeholder="Amount" type="number" value={income.amount} onChange={(e) => setIncome({ ...income, amount: e.target.value })} />
          <Select value={income.frequency} onChange={(e) => setIncome({ ...income, frequency: e.target.value })}>
            <option value="monthly">Recurring monthly</option>
            <option value="one-time">One-time</option>
          </Select>
          <button className="btn btn-primary">Add income</button>
        </form>
        {data.incomeSources.length === 0 ? <Empty>No income sources added yet.</Empty> : null}
        {data.incomeSources.map((item) => (
          <ListItem
            key={item.id}
            title={item.name}
            note={`${Number(item.amount).toFixed(2)} · ${item.frequency === 'one-time' ? 'one-time' : 'recurring monthly'}`}
            onEdit={() => {
              const name = ask('Income source name', item.name);
              if (!name) return;
              const amount = ask('Amount', item.amount);
              if (amount == null) return;
              const frequency = ask('Frequency: monthly or one-time', item.frequency ?? 'monthly');
              if (!frequency) return;
              action('income.update', { id: item.id, name, amount, frequency });
            }}
            onDelete={() => action('income.delete', { id: item.id, label: 'Income source' })}
          />
        ))}
      </Parchment>
      </div>

      <div className={activeFinanceTab === 'Assets' ? 'space-y-5' : 'hidden'}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Parchment title="Assets" eyebrow="Manual values">
          <form onSubmit={(e) => submit(e, () => action('asset.add', asset).then(() => setAsset({ name: '', type: 'mutual-fund', currentValue: '' })))} className="mb-4 grid gap-2 md:grid-cols-[1fr_170px_160px_auto]">
            <Field placeholder="Asset name" value={asset.name} onChange={(e) => setAsset({ ...asset, name: e.target.value })} />
            <Select value={asset.type} onChange={(e) => setAsset({ ...asset, type: e.target.value })}>
              <option value="mutual-fund">Mutual fund</option>
              <option value="stock">Stock</option>
              <option value="fd">FD</option>
              <option value="real-estate">Real estate</option>
              <option value="other">Other</option>
            </Select>
            <Field placeholder="Current value" type="number" value={asset.currentValue} onChange={(e) => setAsset({ ...asset, currentValue: e.target.value })} />
            <button className="btn btn-primary">Add asset</button>
          </form>
          {data.assets.length === 0 ? <Empty>No assets tracked yet.</Empty> : null}
          {data.assets.map((item) => (
            <ListItem
              key={item.id}
              title={item.name}
              note={`${item.type} · ${Number(item.currentValue).toFixed(2)}`}
              onEdit={() => {
                const name = ask('Asset name', item.name);
                if (!name) return;
                const type = ask('Asset type', item.type ?? 'other');
                if (!type) return;
                const currentValue = ask('Current value', item.currentValue);
                if (currentValue == null) return;
                action('asset.update', { id: item.id, name, type, currentValue });
              }}
              onDelete={() => action('asset.delete', { id: item.id, label: 'Asset' })}
            />
          ))}
        </Parchment>

        <Parchment title="Asset Trend" eyebrow="Snapshot history" action={<RangeToggle value={range} onChange={setRange} />}>
          <ChartBox height={260}>
            {assetData.length ? (
              <ResponsiveContainer>
                <AreaChart data={assetData} margin={{ bottom: 16, left: 8 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}><AxisLabel value="Date" /></XAxis>
                  <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={54}><AxisLabel value="Assets" axis="y" /></YAxis>
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="assets" name="Assets" stroke={colors.moss} fill={colors.moss} fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <ChartPlaceholder>Update an asset value to see the trend.</ChartPlaceholder>}
          </ChartBox>
        </Parchment>
      </div>

      <Parchment title="Net Worth" eyebrow="Assets minus liabilities">
        <div className="mb-5 grid grid-cols-3 gap-6">
          <Stat label="Assets" value={totalAssetValue.toFixed(2)} tone="text-moss" />
          <Stat label="Liabilities" value={totalDebt.toFixed(2)} tone="text-wax" />
          <Stat label="Net worth" value={netWorth.toFixed(2)} tone={netWorth >= 0 ? 'text-brass' : 'text-wax'} />
        </div>
        <ChartBox height={240}>
          {netWorthData.length ? (
            <ResponsiveContainer>
              <LineChart data={netWorthData} margin={{ bottom: 16, left: 8 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}><AxisLabel value="Date" /></XAxis>
                <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={58}><AxisLabel value="Net worth" axis="y" /></YAxis>
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="netWorth" name="Net worth" stroke={colors.brass} strokeWidth={2} dot={{ r: 2, fill: colors.brass }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <ChartPlaceholder>Add assets or loans to see net worth history.</ChartPlaceholder>}
        </ChartBox>
      </Parchment>

      </div>

      <div className={activeFinanceTab === 'Debts' ? 'space-y-5' : 'hidden'}>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Parchment title="Debt Payoff" eyebrow={`Projected payoff: ${projectedPayoff(data)}`} action={<RangeToggle value={range} onChange={setRange} />}>
          <ChartBox>
            {debtData.length ? (
              <ResponsiveContainer>
                <AreaChart data={debtData} margin={{ bottom: 16, left: 8 }}>
                  <defs>
                    <linearGradient id="debtFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={colors.wax} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={colors.wax} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}>
                    <AxisLabel value="Date" />
                  </XAxis>
                  <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={50}>
                    <AxisLabel value="Debt" axis="y" />
                  </YAxis>
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="debt" name="Debt" stroke={colors.wax} strokeWidth={2} fill="url(#debtFill)" animationDuration={500} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <ChartPlaceholder>Add a debt or payment to see payoff trends.</ChartPlaceholder>}
          </ChartBox>
        </Parchment>

        <Parchment title="This Month" eyebrow="Income, expenses, debt">
          {monthMix.length ? (
            <ChartBox height={220}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={monthMix} innerRadius={54} outerRadius={82} dataKey="value" paddingAngle={3}>
                    {monthMix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>
          ) : <Empty>Add this month&apos;s transactions to see the mix.</Empty>}
          <div className="mt-3 space-y-2 text-sm">
            {monthMix.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
                <span className="tabular-nums">{item.value.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </Parchment>
      </div>

      <Parchment title="Debts" eyebrow="Loans & obligations">
        <form
          onSubmit={(e) => submit(e, () => action('debt.add', { ...debt, linkedGoalId: goalIdFromLabel(debtGoalQuery) || null }).then(() => {
            setDebt({ name: '', amount: '', loanType: 'personal', interestRate: '', tenureMonths: '', emiAmount: '', dueDay: '1', linkedGoalId: '' });
            setDebtGoalQuery('');
          }))}
          className="mb-4 grid gap-2 md:grid-cols-4"
        >
          <Field placeholder="Name" value={debt.name} onChange={(e) => setDebt({ ...debt, name: e.target.value })} />
          <Field placeholder="Amount" type="number" value={debt.amount} onChange={(e) => setDebt({ ...debt, amount: e.target.value })} />
          <Select value={debt.loanType} onChange={(e) => setDebt({ ...debt, loanType: e.target.value })}>
            <option value="personal">Personal</option>
            <option value="home">Home</option>
            <option value="car">Car</option>
            <option value="credit-card">Credit card</option>
            <option value="other">Other</option>
          </Select>
          <Field placeholder="Rate %" type="number" value={debt.interestRate} onChange={(e) => setDebt({ ...debt, interestRate: e.target.value })} />
          <Field placeholder="Tenure months" type="number" value={debt.tenureMonths} onChange={(e) => setDebt({ ...debt, tenureMonths: e.target.value })} />
          <Field placeholder="EMI amount" type="number" value={debt.emiAmount} onChange={(e) => setDebt({ ...debt, emiAmount: e.target.value })} />
          <Field placeholder="Due day" type="number" min={1} max={28} value={debt.dueDay} onChange={(e) => setDebt({ ...debt, dueDay: e.target.value })} />
          <Field list="finance-goal-options" placeholder="Link to a goal (optional)" value={debtGoalQuery} onChange={(e) => setDebtGoalQuery(e.target.value)} />
          <button className="btn btn-primary">Add debt</button>
        </form>
        {data.debts.map((item) => (
          <LoanItem key={item.id} item={item} summary={data.loanSummaries.find((row) => row.debtId === item.id)} data={data} goalLabelFromId={goalLabelFromId} goalIdFromLabel={goalIdFromLabel} action={action} />
        ))}
        {data.debts.length === 0 ? <Empty>No loans or obligations recorded yet.</Empty> : null}
        <form onSubmit={(e) => submit(e, () => action('debt.pay', payment).then(() => setPayment({ ...payment, amount: '' })))} className="mt-5 grid gap-2 border-t pt-4 md:grid-cols-[1fr_180px_auto]">
          <Select value={payment.debtId} onChange={(e) => setPayment({ ...payment, debtId: e.target.value })}>
            <option value="">Select debt</option>
            {data.debts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
          <Field placeholder="Amount" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
          <button className="btn btn-primary">Log payment</button>
        </form>
        {data.debtPayments.length ? (
          <div className="mt-5 border-t pt-4">
            <div className="label-caps mb-2">Recent payments</div>
            {[...data.debtPayments].reverse().slice(0, 5).map((item) => (
              <ListItem
                key={item.id}
                title={`${item.paidOn} · ${Number(item.amount).toFixed(2)} ${item.kind === 'emi' ? 'EMI' : 'extra'}`}
                note={`${data.debts.find((debtRow) => debtRow.id === item.debtId)?.name ?? 'Debt payment'} · principal ${Number(item.principalPortion ?? item.amount).toFixed(2)} · interest ${Number(item.interestPortion ?? 0).toFixed(2)} · balance ${item.resultingBalance == null ? '-' : Number(item.resultingBalance).toFixed(2)}`}
                onDelete={() => action('debtPayment.delete', { id: item.id, label: 'Debt payment' })}
              />
            ))}
          </div>
        ) : <div className="mt-5"><Empty>No debt payments logged yet.</Empty></div>}
      </Parchment>
      </div>

      <div className={activeFinanceTab === 'Savings' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Savings" eyebrow="Balance">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              action('savings.save', {
                balance: savings || data.savings?.balance || 0,
                goalAmount: savingsGoal,
                linkedGoalId: goalIdFromLabel(savingsGoalQuery) || data.savings?.linkedGoalId || null,
              }).then(() => setSavings(''));
            }}
            className="mb-5 grid gap-2 md:grid-cols-2 lg:grid-cols-1"
          >
            <Field type="number" value={savings} onChange={(event) => setSavings(event.target.value)} placeholder={`Current: ${data.savings?.balance ?? 0}`} />
            <Field type="number" value={savingsGoal} onChange={(event) => setSavingsGoal(event.target.value)} placeholder="Savings goal" />
            <Field list="finance-goal-options" value={savingsGoalQuery} onChange={(event) => setSavingsGoalQuery(event.target.value)} placeholder={data.savings?.linkedGoalId ? `Linked: ${goalTitle(data, String(data.savings.linkedGoalId))}` : 'Link to a goal (optional)'} />
            <button className="btn btn-primary">Save savings</button>
          </form>
          {data.savings?.linkedGoalId ? (
            <span className="mb-4 inline-flex items-center gap-1 rounded-full border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs font-medium text-brass">
              <NavIcon name="target" className="h-3 w-3" /> {goalTitle(data, String(data.savings.linkedGoalId)) ?? 'Linked goal'}
            </span>
          ) : null}
          <ProgressBar value={Number(data.savings?.balance ?? 0)} max={Number(savingsGoal) || 1} tone={colors.moss} />
        </Parchment>
      </div>

      <div className={activeFinanceTab === 'Transactions' ? 'space-y-5' : 'hidden'}>
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
        <Parchment title="Transactions" eyebrow="Daily finance log">
          <form
            onSubmit={(event) => submit(event, () => {
              const category = transaction.category.trim() || (transaction.type === 'debt_payment' ? 'Debt' : transaction.type === 'income' ? 'Income' : 'Other');
              action('transaction.add', { ...transaction, category }).then(() => setTransaction({
                date: data.today,
                type: 'expense',
                amount: '',
                category: 'Food',
                note: '',
                linkedDebtId: '',
              }));
            })}
            className="mb-5 grid gap-2 md:grid-cols-3 xl:grid-cols-6"
          >
            <Field type="date" value={transaction.date} onChange={(event) => setTransaction({ ...transaction, date: event.target.value })} />
            <Select
              value={transaction.type}
              onChange={(event) => {
                const type = event.target.value;
                setTransaction({
                  ...transaction,
                  type,
                  category: type === 'debt_payment' ? 'Debt' : type === 'income' ? 'Income' : transaction.category || 'Food',
                  linkedDebtId: type === 'debt_payment' ? transaction.linkedDebtId : '',
                });
              }}
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="debt_payment">Debt Payment</option>
            </Select>
            <Field placeholder="Amount" type="number" value={transaction.amount} onChange={(event) => setTransaction({ ...transaction, amount: event.target.value })} />
            <Select
              value={transactionCategoryValue}
              onChange={(event) => setTransaction({ ...transaction, category: event.target.value === '__custom' ? '' : event.target.value })}
            >
              {transactionCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              <option value="__custom">Custom category</option>
            </Select>
            {transactionCategoryValue === '__custom' ? (
              <Field placeholder="Custom category" value={transaction.category} onChange={(event) => setTransaction({ ...transaction, category: event.target.value })} />
            ) : null}
            {transaction.type === 'debt_payment' ? (
              <Select value={transaction.linkedDebtId} onChange={(event) => setTransaction({ ...transaction, linkedDebtId: event.target.value })}>
                <option value="">Select debt</option>
                {data.debts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            ) : null}
            <Field
              className={transaction.type !== 'debt_payment' ? 'md:col-span-2 xl:col-span-1' : ''}
              placeholder="Note (optional)"
              value={transaction.note}
              onChange={(event) => setTransaction({ ...transaction, note: event.target.value })}
            />
            <button className="btn btn-primary">Save</button>
          </form>

          <div className="mb-4 grid gap-2 md:grid-cols-5">
            <Select value={transactionFilter.type} onChange={(event) => setTransactionFilter({ ...transactionFilter, type: event.target.value })}>
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="debt_payment">Debt Payment</option>
            </Select>
            <Field list="finance-transaction-categories" placeholder="Category" value={transactionFilter.category} onChange={(event) => setTransactionFilter({ ...transactionFilter, category: event.target.value })} />
            <Field type="date" value={transactionFilter.startDate} onChange={(event) => setTransactionFilter({ ...transactionFilter, startDate: event.target.value })} />
            <Field type="date" value={transactionFilter.endDate} onChange={(event) => setTransactionFilter({ ...transactionFilter, endDate: event.target.value })} />
            <Field placeholder="Search notes" value={transactionFilter.query} onChange={(event) => setTransactionFilter({ ...transactionFilter, query: event.target.value })} />
          </div>

          {filteredTransactions.length === 0 ? <Empty tone="moss">No transactions match this view.</Empty> : null}
          {filteredTransactions.map((item) => (
            <ListItem
              key={item.id}
              title={`${dateKey(item.transactionDate)} · ${transactionTypeLabel(item.type)} · ${item.category ?? 'Other'}`}
              note={`${item.note ? `${item.note} · ` : ''}${item.linkedDebt?.name ? `Debt: ${item.linkedDebt.name}` : ''}`}
              right={
                <span className={`font-semibold tabular-nums ${item.type === 'income' ? 'text-moss' : item.type === 'debt_payment' ? 'text-brass' : 'text-wax'}`}>
                  {item.type === 'income' ? '+' : '-'}{Number(item.amount ?? 0).toFixed(2)}
                </span>
              }
              onEdit={() => {
                const date = ask('Date', dateKey(item.transactionDate));
                if (!date) return;
                const type = ask('Type: income, expense, debt_payment', item.type);
                if (!type) return;
                const amount = ask('Amount', item.amount);
                if (amount == null) return;
                const category = ask('Category', item.category ?? (type === 'debt_payment' ? 'Debt' : 'Other'));
                if (!category) return;
                const note = ask('Note', item.note ?? '');
                if (note == null) return;
                let linkedDebtId = '';
                if (type === 'debt_payment') {
                  const debtName = ask('Debt name', item.linkedDebt?.name ?? data.debts[0]?.name ?? '');
                  if (!debtName) return;
                  linkedDebtId = data.debts.find((debtItem) => debtItem.id === debtName || String(debtItem.name).toLowerCase() === debtName.toLowerCase())?.id ?? '';
                  if (!linkedDebtId) return;
                }
                action('transaction.update', { id: item.id, date, type, amount, category, note, linkedDebtId });
              }}
              onDelete={() => action('transaction.delete', { id: item.id, label: 'Transaction' })}
            />
          ))}
        </Parchment>
        <Parchment title="Expenses by Category" eyebrow="This month">
          <ChartBox height={240}>
            {expenseBreakdown.length ? (
              <ResponsiveContainer>
                <BarChart data={expenseBreakdown} margin={{ bottom: 16, left: 8 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}>
                    <AxisLabel value="Category" />
                  </XAxis>
                  <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={54}>
                    <AxisLabel value="Amount" axis="y" />
                  </YAxis>
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Expense" radius={[8, 8, 0, 0]}>
                    {expenseBreakdown.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <ChartPlaceholder>Log an expense to see category spending.</ChartPlaceholder>}
          </ChartBox>
          <div className="mt-4 space-y-2 text-sm">
            {expenseBreakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 truncate">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-medium tabular-nums">{item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Parchment>
        </div>
      </div>
    </div>
  );
}

function Health({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const healthTabs = ['Weight', 'Diet', 'Workouts', 'Sleep'] as const;
  const [activeHealthTab, setActiveHealthTab] = useState<(typeof healthTabs)[number]>(() => {
    if (typeof window === 'undefined') return 'Weight';
    const saved = window.sessionStorage.getItem('life-ledger-health-tab');
    window.sessionStorage.removeItem('life-ledger-health-tab');
    return healthTabs.includes(saved as (typeof healthTabs)[number]) ? saved as (typeof healthTabs)[number] : 'Weight';
  });
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [range, setRange] = useState(90);
  const [diet, setDiet] = useState({ calories: data.diet?.calories ?? '', protein: data.diet?.protein ?? '' });
  const [workout, setWorkout] = useState({ exercise: '', sets: '', reps: '', weight: '' });
  const unit = data.profile?.unitsWeight ?? 'kg';
  const latest = data.weights.at(-1)?.weight;
  const goal = data.profile?.goalWeight;
  const weightData = filterRange(data.weights, 'logDate', range, data.today).map((row) => ({ date: row.logDate, weight: Number(row.weight) }));
  const dietByDate = new Map(data.dietLogs.map((row) => [dateKey(row.logDate), row]));
  const dietBars = daysBack(data.today, 14).map((date) => ({
    date,
    calories: Number(dietByDate.get(date)?.calories ?? 0),
    protein: Number(dietByDate.get(date)?.protein ?? 0),
  }));
  const workoutCounts = new Map<string, number>();
  data.workouts.forEach((row) => workoutCounts.set(dateKey(row.logDate), (workoutCounts.get(dateKey(row.logDate)) ?? 0) + 1));
  const workoutHeat = daysBack(data.today, 90).map((date) => ({ date, count: workoutCounts.get(date) ?? 0 }));
  const startWeight = weightData[0]?.weight;
  const currentWeight = weightData.at(-1)?.weight;
  const progressLow = goal && startWeight ? Math.min(Number(goal), startWeight) : undefined;
  const progressHigh = goal && startWeight ? Math.max(Number(goal), startWeight) : undefined;

  return (
    <div className="space-y-6">
      <SubTabs tabs={healthTabs} value={activeHealthTab} onChange={setActiveHealthTab} ariaLabel="Health sections" />

      {activeHealthTab === 'Weight' ? (
      <Parchment title="Weight" eyebrow="Trend toward goal" action={<RangeToggle value={range} onChange={setRange} />}>
        <div className="mb-5 grid grid-cols-3 gap-6">
          <Stat label="Current" value={latest ? `${latest} ${unit}` : '-'} />
          <Stat label="Goal" value={goal ? `${goal} ${unit}` : '-'} tone="text-brass" />
          <Stat label="Delta" value={latest && goal ? (Number(latest) - Number(goal)).toFixed(1) : '-'} tone="text-moss" />
        </div>
        {weightData.length ? (
          <ChartBox>
            <ResponsiveContainer>
              <LineChart data={weightData} margin={{ bottom: 16, left: 8 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}>
                  <AxisLabel value="Date" />
                </XAxis>
                <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={44} domain={['dataMin - 2', 'dataMax + 2']}>
                  <AxisLabel value={`Weight (${unit})`} axis="y" />
                </YAxis>
                <Tooltip content={<ChartTooltip />} />
                {progressLow && progressHigh && <ReferenceArea y1={progressLow} y2={progressHigh} fill={colors.brass} fillOpacity={0.07} />}
                {goal && <ReferenceLine y={Number(goal)} stroke={colors.moss} strokeDasharray="4 4" label={{ value: 'goal', fontSize: 11, fill: colors.muted }} />}
                <Line type="monotone" dataKey="weight" name={`Weight (${unit})`} stroke={colors.brass} strokeWidth={2} dot={{ r: 2, fill: colors.brass }} activeDot={{ r: 4 }} animationDuration={500} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        ) : <ChartBox><ChartPlaceholder>Log weight to see the trend.</ChartPlaceholder></ChartBox>}
        {startWeight && currentWeight && goal ? (
          <div className="mt-3 text-xs text-[var(--muted)]">
            Progress made: {Math.abs(startWeight - currentWeight).toFixed(1)} {unit}; remaining: {Math.abs(currentWeight - Number(goal)).toFixed(1)} {unit}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <InlineForm value={weight} setValue={setWeight} type="number" placeholder={`Weight (${unit})`} button="Log" onAdd={(value) => action('weight.add', { weight: value })} />
          <InlineForm value={goalWeight} setValue={setGoalWeight} type="number" placeholder={`Goal (${unit})`} button="Set goal" onAdd={(value) => action('profile.goalWeight', { goalWeight: value })} />
        </div>
        {data.weights.length ? (
          <div className="mt-5 border-t pt-4">
            <div className="label-caps mb-2">Recent weight logs</div>
            {[...data.weights].reverse().slice(0, 5).map((item) => (
              <ListItem
                key={item.id}
                title={`${item.logDate} · ${item.weight} ${unit}`}
                onEdit={() => {
                  const next = ask('Edit weight', item.weight);
                  if (next != null) action('weight.update', { id: item.id, weight: next });
                }}
                onDelete={() => action('weight.delete', { id: item.id, label: 'Weight log' })}
              />
            ))}
          </div>
        ) : null}
      </Parchment>
      ) : null}

      {activeHealthTab === 'Diet' ? (
        <Parchment title="Diet Today" eyebrow="Calories & protein">
          <MiniLegend items={[{ label: 'Calories', color: colors.brass }, { label: 'Protein', color: colors.moss }]} />
          <ChartBox>
            {data.dietLogs.length ? (
              <ResponsiveContainer>
                <BarChart data={dietBars} margin={{ bottom: 16, left: 8 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.muted }} tickLine={false} axisLine={false}>
                    <AxisLabel value="Date" />
                  </XAxis>
                  <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={44}>
                    <AxisLabel value="Intake" axis="y" />
                  </YAxis>
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={1800} stroke={colors.brass} strokeDasharray="4 4" />
                  <Bar dataKey="calories" name="Calories" fill={colors.brass} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="protein" name="Protein" fill={colors.moss} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <ChartPlaceholder>Log calories or protein to see intake trends.</ChartPlaceholder>}
          </ChartBox>
          <form onSubmit={(e) => submit(e, () => action('diet.save', diet))} className="grid gap-2 md:grid-cols-3">
            <Field placeholder="Calories" type="number" value={diet.calories} onChange={(e) => setDiet({ ...diet, calories: e.target.value })} />
            <Field placeholder="Protein (g)" type="number" value={diet.protein} onChange={(e) => setDiet({ ...diet, protein: e.target.value })} />
            <button className="btn btn-primary">Save</button>
          </form>
          {data.dietLogs.length ? (
            <div className="mt-5 border-t pt-4">
              <div className="label-caps mb-2">Recent diet logs</div>
              {[...data.dietLogs].reverse().slice(0, 5).map((item) => (
                <ListItem
                  key={item.id}
                  title={item.logDate}
                  note={`${item.calories} cal · ${item.protein}g protein`}
                  onEdit={() => {
                    const calories = ask('Calories', item.calories);
                    if (calories == null) return;
                    const protein = ask('Protein', item.protein);
                    if (protein == null) return;
                    action('diet.update', { id: item.id, calories, protein });
                  }}
                  onDelete={() => action('diet.delete', { id: item.id, label: 'Diet log' })}
                />
              ))}
            </div>
          ) : null}
        </Parchment>
      ) : null}

      {activeHealthTab === 'Workouts' ? (
      <>
        <Parchment title="Workout Consistency" eyebrow="Last 90 days">
          <Heatmap days={workoutHeat} />
        </Parchment>
      <Parchment title="Workouts" eyebrow="Log">
        <form onSubmit={(e) => submit(e, () => action('workout.add', workout).then(() => setWorkout({ exercise: '', sets: '', reps: '', weight: '' })))} className="mb-4 grid gap-2 md:grid-cols-5">
          <Field className="md:col-span-2" placeholder="Exercise" value={workout.exercise} onChange={(e) => setWorkout({ ...workout, exercise: e.target.value })} />
          <Field placeholder="Sets" type="number" value={workout.sets} onChange={(e) => setWorkout({ ...workout, sets: e.target.value })} />
          <Field placeholder="Reps" type="number" value={workout.reps} onChange={(e) => setWorkout({ ...workout, reps: e.target.value })} />
          <button className="btn btn-primary">Log</button>
        </form>
        {data.workouts.length === 0 ? <Empty>No workouts logged yet.</Empty> : null}
        {data.workouts.map((item) => (
          <ListItem
            key={item.id}
            title={item.exercise}
            note={`${item.logDate} · ${item.sets} x ${item.reps} @ ${item.weight}`}
            onEdit={() => {
              const exercise = ask('Exercise', item.exercise);
              if (!exercise) return;
              const sets = ask('Sets', item.sets);
              if (sets == null) return;
              const reps = ask('Reps', item.reps);
              if (reps == null) return;
              const nextWeight = ask('Weight', item.weight);
              if (nextWeight == null) return;
              action('workout.update', { id: item.id, exercise, sets, reps, weight: nextWeight });
            }}
            onDelete={() => action('workout.delete', { id: item.id, label: 'Workout log' })}
          />
        ))}
      </Parchment>
      </>
      ) : null}

      {activeHealthTab === 'Sleep' ? <Sleep data={data} action={action} /> : null}
    </div>
  );
}

function Sleep({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const [sleep, setSleep] = useState({ hours: '', quality: '3' });
  const [range, setRange] = useState(30);
  const sleepRows = filterRange([...data.sleep].reverse(), 'logDate', range, data.today);
  const avg = sleepRows.length ? sleepRows.reduce((sum, item) => sum + Number(item.hours), 0) / sleepRows.length : 0;
  return (
    <Parchment title="Sleep" eyebrow="Recovery" action={<RangeToggle value={range} onChange={setRange} />}>
      <div className="mb-5 grid grid-cols-2 gap-6">
        <Stat label="Average" value={avg ? avg.toFixed(1) : '-'} tone="text-brass" />
        <Stat label="Logs" value={sleepRows.length} />
      </div>
      <ChartBox>
        {sleepRows.length ? (
          <ResponsiveContainer>
            <BarChart data={sleepRows.map((row) => ({ date: row.logDate, hours: Number(row.hours) }))} margin={{ bottom: 16, left: 8 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}>
                <AxisLabel value="Date" />
              </XAxis>
              <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={42} domain={[0, 'dataMax + 1']}>
                <AxisLabel value="Hours" axis="y" />
              </YAxis>
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={7} stroke={colors.brass} strokeDasharray="4 4" />
              <Bar dataKey="hours" name="Hours" radius={[4, 4, 0, 0]}>
                {sleepRows.map((row) => <Cell key={row.id} fill={Number(row.hours) >= 7 ? colors.moss : colors.wax} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartPlaceholder>Log sleep to see recovery trends.</ChartPlaceholder>}
      </ChartBox>
      <form onSubmit={(e) => submit(e, () => action('sleep.add', sleep).then(() => setSleep({ hours: '', quality: '3' })))} className="mb-4 grid gap-2 md:grid-cols-3">
        <Field placeholder="Hours" type="number" value={sleep.hours} onChange={(e) => setSleep({ ...sleep, hours: e.target.value })} />
        <Select value={sleep.quality} onChange={(e) => setSleep({ ...sleep, quality: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Quality {n}</option>)}</Select>
        <button className="btn btn-primary">Log sleep</button>
      </form>
      {data.sleep.length === 0 ? <Empty>No sleep logs yet.</Empty> : null}
      {data.sleep.map((item) => (
        <ListItem
          key={item.id}
          title={`${item.hours} hours`}
          note={`${item.logDate} · quality ${item.quality}/5`}
          onEdit={() => {
            const hours = ask('Sleep hours', item.hours);
            if (hours == null) return;
            const quality = ask('Quality 1-5', item.quality);
            if (quality == null) return;
            action('sleep.update', { id: item.id, hours, quality, logDate: item.logDate });
          }}
          onDelete={() => action('sleep.delete', { id: item.id, label: 'Sleep log' })}
        />
      ))}
    </Parchment>
  );
}

function Relationships({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const relationshipTabs = ['Check-ins', 'Important Dates'] as const;
  const [activeRelationshipTab, setActiveRelationshipTab] = useState<(typeof relationshipTabs)[number]>('Check-ins');
  const [checkin, setCheckin] = useState({ personName: '', category: 'Friend', rating: '3', note: '' });
  const [date, setDate] = useState({ personName: '', kind: '', date: '' });
  return (
    <div className="space-y-6">
      <SubTabs tabs={relationshipTabs} value={activeRelationshipTab} onChange={setActiveRelationshipTab} ariaLabel="Relationship sections" />

      <div className={activeRelationshipTab === 'Check-ins' ? 'space-y-5' : 'hidden'}>
      <Parchment title="Weekly Check-ins" eyebrow={`Week of ${data.weekStart}`}>
        <form onSubmit={(e) => submit(e, () => action('relationship.add', checkin).then(() => setCheckin({ personName: '', category: 'Friend', rating: '3', note: '' })))} className="mb-4 grid gap-2 md:grid-cols-5">
          <Field placeholder="Person" value={checkin.personName} onChange={(e) => setCheckin({ ...checkin, personName: e.target.value })} />
          <Field placeholder="Category" value={checkin.category} onChange={(e) => setCheckin({ ...checkin, category: e.target.value })} />
          <Select value={checkin.rating} onChange={(e) => setCheckin({ ...checkin, rating: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}</Select>
          <Field placeholder="Note" value={checkin.note} onChange={(e) => setCheckin({ ...checkin, note: e.target.value })} />
          <button className="btn btn-primary">Add</button>
        </form>
        {data.checkins.length === 0 ? <Empty>No check-ins yet this week.</Empty> : null}
        {data.checkins.map((item) => (
          <ListItem
            key={item.id}
            title={item.personName}
            note={`${item.category} · ${item.rating}/5${item.note ? ` · ${item.note}` : ''}`}
            onEdit={() => {
              const personName = ask('Person', item.personName);
              if (!personName) return;
              const rating = ask('Rating 1-5', item.rating);
              if (rating == null) return;
              const note = ask('Note', item.note ?? '');
              action('relationship.update', { ...item, personName, rating, note });
            }}
            onDelete={() => action('relationship.delete', { id: item.id, label: 'Relationship check-in' })}
          />
        ))}
      </Parchment>
      </div>

      <div className={activeRelationshipTab === 'Important Dates' ? 'space-y-5' : 'hidden'}>
      <Parchment title="Important Dates" eyebrow="Remember">
        <form onSubmit={(e) => submit(e, () => action('importantDate.add', date).then(() => setDate({ personName: '', kind: '', date: '' })))} className="mb-4 grid gap-2 md:grid-cols-4">
          <Field placeholder="Person" value={date.personName} onChange={(e) => setDate({ ...date, personName: e.target.value })} />
          <Field placeholder="Kind" value={date.kind} onChange={(e) => setDate({ ...date, kind: e.target.value })} />
          <Field type="date" value={date.date} onChange={(e) => setDate({ ...date, date: e.target.value })} />
          <button className="btn btn-primary">Add date</button>
        </form>
        {data.dates.length === 0 ? <Empty>No important dates added.</Empty> : null}
        {data.dates.map((item) => (
          <ListItem
            key={item.id}
            title={item.personName}
            note={`${item.kind} · ${item.date}`}
            onEdit={() => {
              const personName = ask('Person', item.personName);
              if (!personName) return;
              const kind = ask('Kind', item.kind);
              if (!kind) return;
              const dateValue = ask('Date', item.date);
              if (!dateValue) return;
              action('importantDate.update', { id: item.id, personName, kind, date: dateValue });
            }}
            onDelete={() => action('importantDate.delete', { id: item.id, label: 'Important date' })}
          />
        ))}
      </Parchment>
      </div>
    </div>
  );
}

function LoanItem({
  item,
  summary,
  data,
  goalLabelFromId,
  goalIdFromLabel,
  action,
}: {
  item: Row;
  summary?: Row;
  data: Dashboard;
  goalLabelFromId: (id?: string | null) => string;
  goalIdFromLabel: (label: string) => string;
  action: (type: string, payload?: Row) => Promise<void>;
}) {
  return (
    <div className="ledger-row py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {item.linkedGoalId ? (
            <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs font-medium text-brass">
              <NavIcon name="target" className="h-3 w-3" /> {goalTitle(data, String(item.linkedGoalId)) ?? 'Linked goal'}
            </span>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium">{item.name}</div>
            <span className="rounded border px-2 py-0.5 text-xs text-[var(--muted)]">{item.type ?? 'other'}</span>
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            Principal {Number(item.principal).toFixed(2)} · rate {Number(item.interestRate).toFixed(2)}% · EMI {item.emiAmount ? Number(item.emiAmount).toFixed(2) : '-'} · due {item.dueDay ?? '-'}
          </div>
          {summary?.emiWarning ? <div className="mt-2 text-xs text-wax">{summary.emiWarning}</div> : null}
          <div className="mt-2 grid gap-3 text-xs text-[var(--muted)] md:grid-cols-3">
            <div>Interest paid <span className="font-medium text-ink">{Number(summary?.totalInterestPaid ?? 0).toFixed(2)}</span></div>
            <div>Principal paid <span className="font-medium text-ink">{Number(summary?.totalPrincipalPaid ?? 0).toFixed(2)}</span></div>
            <div>Projected payoff <span className="font-medium text-ink">{summary?.projectedPayoffDate ?? '-'}</span></div>
          </div>
        </div>
        <strong className="shrink-0 text-wax">{Number(item.balance).toFixed(2)}</strong>
        <Field
          list="finance-goal-options"
          defaultValue={goalLabelFromId(item.linkedGoalId)}
          onBlur={(event) => action('debt.update', { ...item, linkedGoalId: goalIdFromLabel(event.target.value) || null, loanType: item.type ?? 'other' })}
          className="max-w-48 text-xs"
          placeholder="Link to a goal (optional)"
          aria-label="Link loan to goal"
        />
        <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white" onClick={() => {
          const name = ask('Loan name', item.name);
          if (!name) return;
          const balance = ask('Current outstanding balance', item.balance);
          if (balance == null) return;
          const interestRate = ask('Annual interest rate %', item.interestRate ?? 0);
          if (interestRate == null) return;
          const tenureMonths = ask('Tenure months', item.tenureMonths ?? '');
          if (tenureMonths == null) return;
          const emiAmount = ask('EMI amount', item.emiAmount ?? '');
          if (emiAmount == null) return;
          const dueDay = ask('Due day of month', item.dueDay ?? '');
          if (dueDay == null) return;
          action('debt.update', { ...item, name, balance, interestRate, tenureMonths, emiAmount, dueDay, linkedGoalId: item.linkedGoalId ?? null, loanType: item.type ?? 'other' });
        }}>Edit</button>
        <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('debt.delete', { id: item.id, label: 'Loan' })}>Delete</button>
      </div>
    </div>
  );
}

function Learning({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const learningTabs = ['Skills', 'Sessions', 'Resources'] as const;
  const [activeLearningTab, setActiveLearningTab] = useState<(typeof learningTabs)[number]>(() => {
    if (typeof window === 'undefined') return 'Skills';
    const saved = window.sessionStorage.getItem('life-ledger-learning-tab');
    window.sessionStorage.removeItem('life-ledger-learning-tab');
    return learningTabs.includes(saved as (typeof learningTabs)[number]) ? saved as (typeof learningTabs)[number] : 'Skills';
  });
  const [skill, setSkill] = useState({ name: '', status: 'DONT_KNOW_HOW' });
  const [skillGoalQuery, setSkillGoalQuery] = useState('');
  const [session, setSession] = useState({ skillId: '', minutes: '', notes: '' });
  const goalOptions = data.goals.map((goal) => ({ id: String(goal.id), label: `${goalLevelLabel(String(goal.level))}: ${goal.title}` }));
  const goalIdFromLabel = (label: string) => goalOptions.find((goal) => goal.label === label)?.id ?? '';
  const goalLabelFromId = (id?: string | null) => goalOptions.find((goal) => goal.id === id)?.label ?? '';
  const skillHours = data.skills.map((skillRow) => ({
    name: skillRow.name,
    hours: Number((data.sessions.filter((row) => row.skillId === skillRow.id).reduce((sum, row) => sum + Number(row.minutes), 0) / 60).toFixed(1)),
  })).filter((row) => row.hours > 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <Parchment title="Hours by Skill" eyebrow="Cumulative study">
          {skillHours.length ? (
            <ChartBox>
              <ResponsiveContainer>
                <BarChart data={skillHours} layout="vertical" margin={{ left: 18, bottom: 14 }}>
                  <CartesianGrid stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}>
                    <AxisLabel value="Hours" />
                  </XAxis>
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={90}>
                    <AxisLabel value="Skill" axis="y" />
                  </YAxis>
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="hours" name="Hours" fill={colors.brass} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          ) : <ChartBox><ChartPlaceholder>Log a study session to see skill progress.</ChartPlaceholder></ChartBox>}
        </Parchment>
        <Parchment title="Study Streak" eyebrow="Consecutive days">
          <Stat label="Current" value={`${studyStreak(data)}d`} tone="text-moss" />
          <div className="mt-5">
            <Heatmap days={moduleCountsByDay({ ...data, journalEntries: [], weights: [], workouts: [], sleep: [], debtPayments: [], dietLogs: [], xpEvents: data.xpEvents.filter((row) => row.source === 'learning') }, 42)} compact />
          </div>
        </Parchment>
      </div>
      <SubTabs tabs={learningTabs} value={activeLearningTab} onChange={setActiveLearningTab} ariaLabel="Learning sections" />

      <div className={activeLearningTab === 'Skills' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Skills" eyebrow="Active learning">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!skill.name.trim()) return;
              action('skill.add', { name: skill.name.trim(), status: skill.status, linkedGoalId: goalIdFromLabel(skillGoalQuery) || null }).then(() => {
                setSkill({ name: '', status: 'DONT_KNOW_HOW' });
                setSkillGoalQuery('');
              });
            }}
            className="mb-4 grid gap-2 md:grid-cols-[1fr_230px_260px_auto]"
          >
            <Field value={skill.name} onChange={(event) => setSkill({ ...skill, name: event.target.value })} placeholder="Skill name..." />
            <Select value={skill.status} onChange={(event) => setSkill({ ...skill, status: event.target.value })}>
              {skillStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
            </Select>
            <Field list="learning-goal-options" value={skillGoalQuery} onChange={(event) => setSkillGoalQuery(event.target.value)} placeholder="Link to a goal (optional)" />
            <datalist id="learning-goal-options">
              {goalOptions.map((goal) => <option key={goal.id} value={goal.label} />)}
            </datalist>
            <button className="btn btn-primary">Add</button>
          </form>
          {data.skills.length === 0 ? <Empty tone="ink">No skills added yet.</Empty> : null}
          {data.skills.map((item) => (
            <div key={item.id} className="ledger-row flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                {item.linkedGoalId ? (
                  <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs font-medium text-brass">
                    <NavIcon name="target" className="h-3 w-3" /> {goalTitle(data, String(item.linkedGoalId)) ?? 'Linked goal'}
                  </span>
                ) : null}
                <div className="truncate text-base font-medium">{item.name}</div>
                <SkillStageProgress stage={String(item.status ?? 'DONT_KNOW_HOW')} />
              </div>
              <Select
                value={String(item.status ?? 'DONT_KNOW_HOW')}
                onChange={(event) => action('skill.update', { ...item, status: event.target.value })}
                className="max-w-56 text-xs"
                aria-label="Skill stage"
              >
                {skillStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
              </Select>
              <Field
                list="learning-goal-options"
                defaultValue={goalLabelFromId(item.linkedGoalId)}
                onBlur={(event) => action('skill.update', { ...item, linkedGoalId: goalIdFromLabel(event.target.value) || null })}
                className="max-w-48 text-xs"
                placeholder="Link to a goal (optional)"
                aria-label="Link skill to goal"
              />
              <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white" onClick={() => {
                const name = ask('Skill name', item.name);
                if (name) action('skill.update', { ...item, name, linkedGoalId: item.linkedGoalId ?? null });
              }}>Edit</button>
              <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('skill.delete', { id: item.id, label: 'Skill' })}>Delete</button>
            </div>
          ))}
        </Parchment>
      </div>

      <div className={activeLearningTab === 'Sessions' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Sessions" eyebrow="Study log">
          <form onSubmit={(e) => submit(e, () => action('learning.add', session).then(() => setSession({ skillId: '', minutes: '', notes: '' })))} className="mb-4 grid gap-2 md:grid-cols-4 lg:grid-cols-2">
            <Select value={session.skillId} onChange={(e) => setSession({ ...session, skillId: e.target.value })}>
              <option value="">Select skill</option>
              {data.skills.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
            <Field placeholder="Minutes" type="number" value={session.minutes} onChange={(e) => setSession({ ...session, minutes: e.target.value })} />
            <Field placeholder="Notes" value={session.notes} onChange={(e) => setSession({ ...session, notes: e.target.value })} />
            <button className="btn btn-primary">Log</button>
          </form>
          {data.sessions.length === 0 ? <Empty tone="moss">No learning sessions logged yet.</Empty> : null}
          {data.sessions.map((item) => (
            <ListItem
              key={item.id}
              title={`${item.minutes} minutes`}
              note={`${item.logDate}${item.skill?.name ? ` · ${item.skill.name}` : ''}${item.notes ? ` · ${item.notes}` : ''}`}
              onEdit={() => {
                const minutes = ask('Minutes studied', item.minutes);
                if (minutes == null) return;
                const notes = ask('Notes', item.notes ?? '');
                action('learning.update', { id: item.id, skillId: item.skillId ?? null, minutes, notes });
              }}
              onDelete={() => action('learning.delete', { id: item.id, label: 'Learning session' })}
            />
          ))}
        </Parchment>
      </div>

      <div className={activeLearningTab === 'Resources' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Resources" eyebrow="Tracker">
          <Empty tone="ink">No resources tracked yet.</Empty>
        </Parchment>
      </div>
    </div>
  );
}

function Habits({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const habitTabs = ['Building', 'Breaking'] as const;
  const [activeHabitTab, setActiveHabitTab] = useState<(typeof habitTabs)[number]>('Building');
  const [habit, setHabit] = useState({ name: '', kind: 'build', linkedGoalId: '', whyThisMatters: '' });
  const [habitGoalQuery, setHabitGoalQuery] = useState('');
  const [expandedHabitId, setExpandedHabitId] = useState('');
  const building = data.habits.filter((item) => item.kind === 'build');
  const breaking = data.habits.filter((item) => item.kind === 'break');
  const currentTime = new Date(data.today).getTime();
  const daysSince = (iso?: string | null) => (iso ? Math.floor((currentTime - new Date(iso).getTime()) / 86400000) : 0);
  const goalOptions = data.goals.map((goal) => ({ id: String(goal.id), label: `${goalLevelLabel(String(goal.level))}: ${goal.title}` }));
  const goalIdFromLabel = (label: string) => goalOptions.find((goal) => goal.label === label)?.id ?? '';
  const goalLabelFromId = (id?: string | null) => goalOptions.find((goal) => goal.id === id)?.label ?? '';
  return (
    <div className="space-y-5">
      <Parchment title="New Habit" eyebrow="Add">
        <form
          onSubmit={(e) => submit(e, () => action('habit.add', { ...habit, linkedGoalId: habit.linkedGoalId || null }).then(() => {
            setHabit({ name: '', kind: 'build', linkedGoalId: '', whyThisMatters: '' });
            setHabitGoalQuery('');
          }))}
          className="grid gap-2 md:grid-cols-[1fr_150px_260px_auto]"
        >
          <Field placeholder="Habit name" value={habit.name} onChange={(e) => setHabit({ ...habit, name: e.target.value })} />
          <Select value={habit.kind} onChange={(e) => setHabit({ ...habit, kind: e.target.value })}><option value="build">Build</option><option value="break">Break</option></Select>
          <Field
            list="habit-goal-options"
            placeholder="Link to a goal (optional)"
            value={habitGoalQuery}
            onChange={(e) => {
              const query = e.target.value;
              setHabitGoalQuery(query);
              setHabit({ ...habit, linkedGoalId: goalIdFromLabel(query) });
            }}
          />
          <datalist id="habit-goal-options">
            {goalOptions.map((goal) => <option key={goal.id} value={goal.label} />)}
          </datalist>
          <button className="btn btn-primary">Add</button>
          <label className="md:col-span-4">
            <span className="text-xs font-medium text-[var(--muted)]">Why this is a standard for me</span>
            <TextArea
              className="mt-1.5 min-h-20"
              placeholder="Optional reflective reminder. Leave blank if this habit is just practical."
              value={habit.whyThisMatters}
              onChange={(event) => setHabit({ ...habit, whyThisMatters: event.target.value })}
            />
          </label>
        </form>
      </Parchment>
      <SubTabs tabs={habitTabs} value={activeHabitTab} onChange={setActiveHabitTab} ariaLabel="Habit sections" />

      <div className={activeHabitTab === 'Building' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Building" eyebrow="Check in daily">
          {building.length === 0 ? <Empty tone="moss">Nothing to build yet.</Empty> : null}
          <div className="space-y-5">
            {building.map((item) => {
              const activeDates = new Set(daysBack(item.lastCheckin ?? data.today, Number(item.currentStreak) || 0));
              const heat = daysBack(data.today, 42).map((date) => ({ date, count: activeDates.has(date) ? 1 : 0 }));
              return (
                <div key={item.id} className="ledger-row pb-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {item.linkedGoalId ? (
                        <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs font-medium text-brass">
                          <NavIcon name="target" className="h-3 w-3" /> {goalTitle(data, String(item.linkedGoalId)) ?? 'Linked goal'}
                        </span>
                      ) : null}
                      {item.whyThisMatters ? (
                        <button
                          type="button"
                          onClick={() => setExpandedHabitId(expandedHabitId === String(item.id) ? '' : String(item.id))}
                          className="mb-1 ml-1 inline-flex items-center gap-1 rounded-full border border-moss/25 bg-moss/10 px-2 py-0.5 text-xs font-medium text-moss"
                        >
                          Standard
                        </button>
                      ) : null}
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-[var(--muted)]">Longest {item.longestStreak}d · last {item.lastCheckin ?? '-'}</div>
                    </div>
                    <strong className="text-brass">{item.currentStreak}d</strong>
                    <Field
                      list="habit-goal-options"
                      defaultValue={goalLabelFromId(item.linkedGoalId)}
                      onBlur={(event) => action('habit.update', { id: item.id, name: item.name, kind: item.kind, linkedGoalId: goalIdFromLabel(event.target.value) || null })}
                      className="max-w-48 text-xs"
                      aria-label="Link habit to goal"
                      placeholder="Link to a goal (optional)"
                    />
                    <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white" onClick={() => {
                      const name = ask('Habit name', item.name);
                      if (!name) return;
                      const whyThisMatters = ask('Why this is a standard for me', item.whyThisMatters ?? '');
                      if (whyThisMatters == null) return;
                      action('habit.update', { id: item.id, name, kind: item.kind, linkedGoalId: item.linkedGoalId ?? null, whyThisMatters });
                    }}>Edit</button>
                    <button className={`btn ${item.lastCheckin === data.today ? 'check-pop border-moss bg-moss text-white' : ''}`} onClick={() => action('habit.checkin', { id: item.id })}>Check in</button>
                    <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('habit.delete', { id: item.id, label: 'Habit' })}>Delete</button>
                  </div>
                  {expandedHabitId === String(item.id) && item.whyThisMatters ? (
                    <div className="mb-4 rounded-2xl border border-moss/20 bg-moss/5 p-3 text-sm leading-6 text-ink">
                      <div className="label-caps mb-1">Standard</div>
                      {String(item.whyThisMatters)}
                    </div>
                  ) : null}
                  <Heatmap days={heat} compact />
                </div>
              );
            })}
          </div>
        </Parchment>
      </div>

      <div className={activeHabitTab === 'Breaking' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Breaking" eyebrow="Days since last slip">
          {breaking.length === 0 ? <Empty tone="wax">No break habits added yet.</Empty> : null}
          {breaking.map((item) => {
            const clean = daysSince(item.lastSlip);
            const best = Math.max(clean, Number(item.longestStreak) || 1);
            return (
              <div key={item.id} className="ledger-row py-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {item.linkedGoalId ? (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs font-medium text-brass">
                        <NavIcon name="target" className="h-3 w-3" /> {goalTitle(data, String(item.linkedGoalId)) ?? 'Linked goal'}
                      </span>
                    ) : null}
                    {item.whyThisMatters ? (
                      <button
                        type="button"
                        onClick={() => setExpandedHabitId(expandedHabitId === String(item.id) ? '' : String(item.id))}
                        className="mb-1 ml-1 inline-flex items-center gap-1 rounded-full border border-moss/25 bg-moss/10 px-2 py-0.5 text-xs font-medium text-moss"
                      >
                        Standard
                      </button>
                    ) : null}
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-[var(--muted)]">Last slip {item.lastSlip ?? '-'}</div>
                  </div>
                  <strong className="text-moss">{clean}d</strong>
                  <Field
                    list="habit-goal-options"
                    defaultValue={goalLabelFromId(item.linkedGoalId)}
                    onBlur={(event) => action('habit.update', { id: item.id, name: item.name, kind: item.kind, linkedGoalId: goalIdFromLabel(event.target.value) || null })}
                    className="max-w-48 text-xs"
                    aria-label="Link habit to goal"
                    placeholder="Link to a goal (optional)"
                  />
                  <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white" onClick={() => {
                    const name = ask('Habit name', item.name);
                    if (!name) return;
                    const whyThisMatters = ask('Why this is a standard for me', item.whyThisMatters ?? '');
                    if (whyThisMatters == null) return;
                    action('habit.update', { id: item.id, name, kind: item.kind, linkedGoalId: item.linkedGoalId ?? null, whyThisMatters });
                  }}>Edit</button>
                  <button className="btn" onClick={() => action('habit.slip', { id: item.id })}>Log slip</button>
                  <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('habit.delete', { id: item.id, label: 'Habit' })}>Delete</button>
                </div>
                {expandedHabitId === String(item.id) && item.whyThisMatters ? (
                  <div className="mb-4 rounded-2xl border border-moss/20 bg-moss/5 p-3 text-sm leading-6 text-ink">
                    <div className="label-caps mb-1">Standard</div>
                    {String(item.whyThisMatters)}
                  </div>
                ) : null}
                <ProgressBar value={clean} max={best} tone={colors.moss} />
                <div className="mt-1 text-xs text-[var(--muted)]">Personal best: {best}d</div>
              </div>
            );
          })}
        </Parchment>
      </div>
    </div>
  );
}

const routineStepTypes = ['habit', 'daily_goal', 'weekly_goal', 'learning', 'finance', 'journal', 'standalone'] as const;

function defaultRoutineStepName(type: string) {
  const names: Record<string, string> = {
    habit: 'Check habit',
    daily_goal: 'Complete daily goal',
    weekly_goal: 'Complete weekly goal',
    learning: 'Log learning session',
    finance: "Log today's expense",
    journal: 'Write journal entry',
    standalone: '',
  };
  return names[type] ?? '';
}

function Routines({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const [routine, setRoutine] = useState({ name: '', timeAnchor: '', goalQuery: '', protected: false });
  const [selectedRoutineId, setSelectedRoutineId] = useState(() => String(data.routines[0]?.id ?? ''));
  const [step, setStep] = useState({ stepType: 'habit', stepName: defaultRoutineStepName('habit'), linkQuery: '' });
  const goalOptions = data.goals.map((goal) => ({ id: String(goal.id), label: `${goalLevelLabel(String(goal.level))}: ${goal.title}` }));
  const habitOptions = data.habits.map((habit) => ({ id: String(habit.id), label: habit.name }));
  const dailyGoalOptions = data.goals.filter((goal) => goal.level === 'daily').map((goal) => ({ id: String(goal.id), label: goal.title }));
  const weeklyGoalOptions = data.goals.filter((goal) => goal.level === 'weekly').map((goal) => ({ id: String(goal.id), label: goal.title }));
  const skillOptions = data.skills.map((skill) => ({ id: String(skill.id), label: skill.name }));
  const selectedRoutine = data.routines.find((item) => String(item.id) === selectedRoutineId) ?? data.routines[0] ?? null;
  const selectedStatus = data.routineStatuses.find((item) => String(item.id) === String(selectedRoutine?.id));
  const recentLogs = data.routineDayLogs.filter((log) => String(log.routineId) === String(selectedRoutine?.id)).slice(-14).reverse();
  const goalIdFromLabel = (label: string) => goalOptions.find((goal) => goal.label === label)?.id ?? '';
  const optionIdFromLabel = (options: { id: string; label: string }[], label: string) => options.find((item) => item.label === label)?.id ?? '';
  const stepOptions =
    step.stepType === 'habit' ? habitOptions :
    step.stepType === 'daily_goal' ? dailyGoalOptions :
    step.stepType === 'weekly_goal' ? weeklyGoalOptions :
    step.stepType === 'learning' ? skillOptions :
    [];

  const addStepPayload = () => {
    const payload: Row = {
      routineId: selectedRoutine?.id,
      stepType: step.stepType,
      stepName: step.stepName.trim() || step.linkQuery || defaultRoutineStepName(step.stepType),
    };
    if (step.stepType === 'habit') payload.linkedHabitId = optionIdFromLabel(habitOptions, step.linkQuery);
    if (step.stepType === 'daily_goal') payload.linkedDailyGoalId = optionIdFromLabel(dailyGoalOptions, step.linkQuery);
    if (step.stepType === 'weekly_goal') payload.linkedWeeklyGoalId = optionIdFromLabel(weeklyGoalOptions, step.linkQuery);
    if (step.stepType === 'learning') payload.linkedSkillId = optionIdFromLabel(skillOptions, step.linkQuery);
    if (step.stepType === 'finance') payload.linkedFinanceAction = 'expense';
    if (step.stepType === 'journal') payload.linkedJournal = 'today';
    return payload;
  };

  return (
    <div className="space-y-6">
      <datalist id="routine-goal-options">
        {goalOptions.map((goal) => <option key={goal.id} value={goal.label} />)}
      </datalist>
      <datalist id="routine-step-link-options">
        {stepOptions.map((item) => <option key={item.id} value={item.label} />)}
      </datalist>

      <Parchment title="Routines" eyebrow="Ordered checklists">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!routine.name.trim()) return;
            action('routine.add', {
              name: routine.name.trim(),
              timeAnchor: routine.timeAnchor || null,
              linkedGoalId: goalIdFromLabel(routine.goalQuery) || null,
              protected: routine.protected,
            }).then(() => setRoutine({ name: '', timeAnchor: '', goalQuery: '', protected: false }));
          }}
          className="mb-5 grid gap-2 md:grid-cols-[1fr_170px_260px_140px_auto]"
        >
          <Field value={routine.name} onChange={(event) => setRoutine({ ...routine, name: event.target.value })} placeholder="Routine name" />
          <Select value={routine.timeAnchor} onChange={(event) => setRoutine({ ...routine, timeAnchor: event.target.value })}>
            <option value="">Anytime</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
            <option value="night">Night</option>
          </Select>
          <Field list="routine-goal-options" value={routine.goalQuery} onChange={(event) => setRoutine({ ...routine, goalQuery: event.target.value })} placeholder="Link to a goal (optional)" />
          <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={routine.protected}
              onChange={(event) => setRoutine({ ...routine, protected: event.target.checked })}
            />
            Protected
          </label>
          <button className="btn btn-primary">Add routine</button>
        </form>

        {data.routines.length === 0 ? <Empty tone="moss">No routines built yet.</Empty> : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.routines.map((item) => {
            const status = data.routineStatuses.find((routineStatus) => routineStatus.id === item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedRoutineId(String(item.id))}
                className={`rounded-2xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${String(selectedRoutine?.id) === String(item.id) ? 'border-brass ring-4 ring-brass/10' : ''}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{item.name}</span>
                      {item.protected ? <span className="rounded-full border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs font-medium text-brass">Protected</span> : null}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{routineAnchorLabel(item.timeAnchor)} · {(item.steps ?? []).length} steps</div>
                  </div>
                  <span className="rounded-full border px-2 py-1 text-xs tabular-nums text-brass">{status?.streak ?? 0}d</span>
                </div>
                <ProgressBar value={Number(status?.completionPct ?? 0)} max={100} tone={status?.completionPct === 100 ? colors.moss : colors.brass} />
              </button>
            );
          })}
        </div>
      </Parchment>

      {selectedRoutine ? (
        <Parchment
          title={String(selectedRoutine.name)}
          eyebrow={`${routineAnchorLabel(String(selectedRoutine.timeAnchor ?? ''))} routine`}
          action={(
            <div className="flex gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const name = ask('Routine name', selectedRoutine.name);
                  if (!name) return;
                  const timeAnchor = ask('Time anchor: morning, afternoon, evening, night, or blank', selectedRoutine.timeAnchor ?? '');
                  action('routine.update', { id: selectedRoutine.id, name, timeAnchor: timeAnchor || null, linkedGoalId: selectedRoutine.linkedGoalId ?? null, protected: Boolean(selectedRoutine.protected) });
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className={`btn ${selectedRoutine.protected ? 'border-brass bg-brass/10 text-brass' : ''}`}
                onClick={() => action('routine.update', {
                  id: selectedRoutine.id,
                  name: selectedRoutine.name,
                  timeAnchor: selectedRoutine.timeAnchor ?? null,
                  linkedGoalId: selectedRoutine.linkedGoalId ?? null,
                  protected: !selectedRoutine.protected,
                })}
              >
                {selectedRoutine.protected ? 'Protected on' : 'Protect'}
              </button>
              <button className="btn" type="button" onClick={() => action('routine.delete', { id: selectedRoutine.id, label: 'Routine' })}>Delete</button>
            </div>
          )}
        >
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <Stat label="Today" value={`${selectedStatus?.completionPct ?? 0}%`} tone={selectedStatus?.completionPct === 100 ? 'text-moss' : 'text-brass'} />
            <Stat label="Steps" value={`${selectedStatus?.completedSteps ?? 0}/${selectedStatus?.totalSteps ?? (selectedRoutine.steps ?? []).length}`} />
            <Stat label="Streak" value={`${selectedStatus?.streak ?? 0}d`} tone="text-moss" />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedRoutine) return;
              action('routineStep.add', addStepPayload()).then(() => setStep({ stepType: 'habit', stepName: defaultRoutineStepName('habit'), linkQuery: '' }));
            }}
            className="mb-5 grid gap-2 border-t pt-5 md:grid-cols-[170px_1fr_1fr_auto]"
          >
            <Select
              value={step.stepType}
              onChange={(event) => {
                const stepType = event.target.value;
                setStep({ stepType, stepName: defaultRoutineStepName(stepType), linkQuery: '' });
              }}
            >
              {routineStepTypes.map((type) => <option key={type} value={type}>{routineStepTypeLabel(type)}</option>)}
            </Select>
            <Field value={step.stepName} onChange={(event) => setStep({ ...step, stepName: event.target.value })} placeholder="Step label" />
            {stepOptions.length ? (
              <Field list="routine-step-link-options" value={step.linkQuery} onChange={(event) => setStep({ ...step, linkQuery: event.target.value })} placeholder={`Link ${routineStepTypeLabel(step.stepType).toLowerCase()}...`} />
            ) : (
              <div className="rounded-xl border bg-background px-3 py-2 text-sm text-[var(--muted)]">
                {step.stepType === 'finance' ? "Done when today's finance activity exists." : step.stepType === 'journal' ? "Done when today's journal entry has text." : 'Standalone steps are checked inside the routine.'}
              </div>
            )}
            <button className="btn btn-primary">Add step</button>
          </form>

          {(selectedRoutine.steps ?? []).length === 0 ? <Empty tone="ink">No steps in this routine yet.</Empty> : null}
          <div className="space-y-2">
            {[...(selectedRoutine.steps ?? [])].sort((a, b) => Number(a.orderIndex) - Number(b.orderIndex)).map((item: Row, index: number, steps: Row[]) => {
              const targetLabel = routineStepTargetLabel(data, item);
              return (
                <div key={item.id} className="ledger-row flex items-center gap-3 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brass/10 text-xs font-semibold tabular-nums text-brass">{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">{item.stepName}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{routineStepTypeLabel(String(item.stepType))}{targetLabel ? ` · ${targetLabel}` : ''}</div>
                  </div>
                  <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white disabled:opacity-40" disabled={index === 0} onClick={() => action('routineStep.move', { id: item.id, direction: 'up' })} type="button">Up</button>
                  <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white disabled:opacity-40" disabled={index === steps.length - 1} onClick={() => action('routineStep.move', { id: item.id, direction: 'down' })} type="button">Down</button>
                  <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white" onClick={() => {
                    const stepName = ask('Step label', item.stepName);
                    if (stepName) action('routineStep.update', { ...item, stepName });
                  }} type="button">Edit</button>
                  <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('routineStep.delete', { id: item.id, label: 'Routine step' })} type="button">Delete</button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t pt-5">
            <div className="label-caps mb-3">Recent history</div>
            {recentLogs.length === 0 ? <Empty tone="moss">Routine history starts after today&apos;s dashboard evaluates it.</Empty> : null}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {recentLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border bg-background/55 p-3">
                  <div className="text-xs text-[var(--muted)]">{log.logDate}</div>
                  <div className={`mt-1 font-semibold tabular-nums ${log.status === 'done' ? 'text-moss' : log.status === 'partial' ? 'text-brass' : 'text-[var(--muted)]'}`}>{log.completionPct}%</div>
                  <div className="mt-1 text-xs capitalize text-[var(--muted)]">{String(log.status).replace('_', ' ')}</div>
                </div>
              ))}
            </div>
          </div>
        </Parchment>
      ) : null}
    </div>
  );
}

function Review({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const dailyGoals = data.goals.filter((item) => item.level === 'daily');
  const weeklyGoals = data.goals.filter((item) => item.level === 'weekly');
  const completedDaily = dailyGoals.filter((item) => item.completed).length;
  const completedWeekly = weeklyGoals.filter((item) => item.completed).length;
  const learningMinutes = data.sessions.reduce((sum, item) => sum + Number(item.minutes), 0);
  const debtData = debtSeries(data).slice(-12);
  const studyByDay = daysBack(data.today, 7).map((date) => ({
    date,
    minutes: data.sessions.filter((row) => dateKey(row.logDate) === date).reduce((sum, row) => sum + Number(row.minutes), 0),
  }));
  const habitCompletion = data.habits.length ? Math.round((data.habits.filter((row) => row.lastCheckin === data.today || (row.kind === 'break' && row.lastSlip !== data.today)).length / data.habits.length) * 100) : 0;
  const modules = [
    { name: 'Goals', score: dailyGoals.length ? completedDaily / dailyGoals.length : 0 },
    { name: 'Weekly goals', score: weeklyGoals.length ? completedWeekly / weeklyGoals.length : 0 },
    { name: 'Learning', score: learningMinutes > 0 ? 1 : 0 },
    { name: 'Health', score: data.workouts.length || data.weights.length || data.dietLogs.length ? 1 : 0 },
    { name: 'Sleep', score: data.sleep.length ? 1 : 0 },
    { name: 'Finance', score: data.transactions.length || data.debtPayments.length || data.financeMonths.length ? 1 : 0 },
    { name: 'Habits', score: habitCompletion / 100 },
  ];
  const biggestWin = [...modules].sort((a, b) => b.score - a.score)[0];
  const areaSlipped = [...modules].sort((a, b) => a.score - b.score)[0];
  const [thieves, setThieves] = useState<string[]>(() => Array.isArray(data.weeklyReflection?.oneThingThieves) ? data.weeklyReflection.oneThingThieves.map(String) : []);
  const [oneThingReflection, setOneThingReflection] = useState(String(data.weeklyReflection?.oneThingReflection ?? ''));
  const toggleThief = (tag: string) => {
    setThieves((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Parchment title="Biggest Win" eyebrow={`Week of ${data.weekStart}`}>
          <Stat label={biggestWin?.name ?? 'No activity'} value={`${Math.round((biggestWin?.score ?? 0) * 100)}%`} tone="text-moss" />
        </Parchment>
        <Parchment title="Area That Slipped" eyebrow="Lowest completion">
          <Stat label={areaSlipped?.name ?? 'No activity'} value={`${Math.round((areaSlipped?.score ?? 0) * 100)}%`} tone="text-wax" />
        </Parchment>
      </div>
      <Parchment title="One Thing Reflection" eyebrow="Four thieves">
        <p className="mb-4 text-base font-semibold leading-6 text-ink">What pulled you off your One Thing this week?</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {fourThieves.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleThief(tag)}
              className={`rounded-full border px-3 py-1.5 text-sm transition active:scale-95 ${thieves.includes(tag) ? 'border-brass bg-brass text-white' : 'bg-card text-[var(--muted)] hover:border-brass hover:text-brass'}`}
            >
              {tag}
            </button>
          ))}
        </div>
        <TextArea
          className="min-h-24"
          value={oneThingReflection}
          onChange={(event) => setOneThingReflection(event.target.value)}
          placeholder="Optional note. What would make the One Thing easier to protect next week?"
        />
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => action('weeklyReflection.save', {
              weekStart: data.weekStart,
              oneThingThieves: thieves,
              oneThingReflection,
            })}
          >
            Save reflection
          </button>
        </div>
      </Parchment>
      <PatternsPanel patterns={data.patterns} />
      <div className="grid gap-6 md:grid-cols-2">
        <Parchment title="Weight Trend" eyebrow="Mini sparkline">
          <SparkBox>
            {data.weights.length ? (
              <ResponsiveContainer>
                <LineChart data={data.weights.slice(-14).map((row) => ({ date: row.logDate, weight: Number(row.weight) }))}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="weight" name="Weight" stroke={colors.brass} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <ChartPlaceholder>Log weight to see this trend.</ChartPlaceholder>}
          </SparkBox>
        </Parchment>
        <Parchment title="Debt Trend" eyebrow="Toward zero">
          <SparkBox>
            {debtData.length ? (
              <ResponsiveContainer>
                <AreaChart data={debtData}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="debt" name="Debt" stroke={colors.wax} fill={colors.wax} fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <ChartPlaceholder>Add debt data to see this trend.</ChartPlaceholder>}
          </SparkBox>
        </Parchment>
        <Parchment title="Study Hours" eyebrow="This week">
          <SparkBox>
            {data.sessions.length ? (
              <ResponsiveContainer>
                <BarChart data={studyByDay}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="minutes" name="Minutes" fill={colors.brass} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <ChartPlaceholder>Log study time to see this trend.</ChartPlaceholder>}
          </SparkBox>
        </Parchment>
        <Parchment title="Habit Completion" eyebrow="Known active habits">
          <Stat label="Completion" value={`${habitCompletion}%`} tone="text-moss" />
          <div className="mt-5"><ProgressBar value={habitCompletion} max={100} tone={colors.moss} /></div>
        </Parchment>
      </div>
      <Parchment title="Weekly Totals" eyebrow="Quick scan">
        <div className="grid gap-6 md:grid-cols-4">
          <Stat label="Daily goals" value={`${completedDaily}/${dailyGoals.length}`} tone="text-moss" />
          <Stat label="Weekly goals" value={`${completedWeekly}/${weeklyGoals.length}`} tone="text-brass" />
          <Stat label="Workouts" value={data.workouts.length} />
          <Stat label="Learning min" value={learningMinutes} />
        </div>
      </Parchment>
    </div>
  );
}

function PatternsPanel({ patterns = [] }: { patterns?: Row[] }) {
  const visiblePatterns = Array.isArray(patterns) ? patterns : [];

  return (
    <Parchment title="Patterns" eyebrow="Computed weekly">
      {visiblePatterns.length === 0 ? (
        <Empty tone="wax">No reliable patterns yet. Patterns appear after at least 14 matching data points and a meaningful correlation.</Empty>
      ) : (
        <div className="space-y-3">
          {visiblePatterns.slice(0, 3).map((pattern) => (
            <div key={String(pattern.id)} className="rounded-2xl border bg-background/45 p-4">
              <div className="label-caps mb-2">{pattern.pair ? String(pattern.pair) : `${pattern.windowDays} day window`}</div>
              <p className="text-sm leading-6 text-ink">{String(pattern.sentence)}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                <span className="rounded-full border px-2 py-1 tabular-nums">{pattern.windowDays}d window</span>
                <span className="rounded-full border px-2 py-1 tabular-nums">{pattern.sampleSize} matching days</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Parchment>
  );
}

function CycleSettings({ data, action }: { data: Dashboard; action: (type: string, payload?: Row) => Promise<void> }) {
  const lifeGoals = data.goals.filter((goal) => goal.level === 'life');
  const [focusGoalId, setFocusGoalId] = useState(String(data.focusCycle?.focusGoalId ?? lifeGoals[0]?.id ?? ''));
  const [focusGoalQuery, setFocusGoalQuery] = useState(() => lifeGoals.find((goal) => goal.id === String(data.focusCycle?.focusGoalId ?? lifeGoals[0]?.id ?? ''))?.title ?? '');
  const [cycleLengthDays, setCycleLengthDays] = useState(String(data.focusCycle?.cycleLengthDays ?? 90));
  const daysLeft = data.focusCycle?.endDate ? daysUntil(String(data.focusCycle.endDate), data.today) : null;
  const focusedGoal = lifeGoals.find((goal) => goal.id === focusGoalId) ?? null;
  const canSave = Boolean(focusGoalId);
  const focusGoalFromTitle = (title: string) => lifeGoals.find((goal) => goal.title === title)?.id ?? '';

  return (
    <div className="space-y-6">
      <Parchment title="Cycle Settings" eyebrow="Focus mode">
        <div className="mb-6 grid gap-6 md:grid-cols-3">
          <Stat label="Start" value={data.focusCycle?.startDate ? String(data.focusCycle.startDate) : '-'} tone="text-brass" />
          <Stat label="End" value={data.focusCycle?.endDate ? String(data.focusCycle.endDate) : '-'} tone={daysLeft != null && daysLeft <= 5 ? 'text-wax' : 'text-brass'} />
          <Stat label="Days left" value={daysLeft == null ? '-' : Math.max(daysLeft, 0)} tone={daysLeft != null && daysLeft <= 5 ? 'text-wax' : 'text-moss'} />
        </div>

        {daysLeft != null && daysLeft <= 5 ? (
          <div className="mb-5 rounded-2xl border border-wax/30 bg-wax/10 px-4 py-3 text-sm text-ink">
            This cycle is almost complete. Start a new cycle only after choosing the next North Star below.
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 md:grid-cols-[180px_1fr]">
          <div>
            <div className="label-caps mb-2">Cycle length</div>
            <Field type="number" min={1} value={cycleLengthDays} onChange={(event) => setCycleLengthDays(event.target.value)} />
          </div>
          <div>
            <div className="mb-3 rounded-2xl border border-brass/20 bg-brass/5 p-4">
              <div className="label-caps mb-2">Focusing question</div>
              <p className="text-base font-semibold leading-6 text-ink">
                What&apos;s the ONE thing you can do such that by doing it, everything else becomes easier or unnecessary?
              </p>
            </div>
            <div className="label-caps mb-2">Focus North Star</div>
            <Field
              list="cycle-life-goals"
              value={focusGoalQuery}
              placeholder="Choose the North Star that answers the question"
              onChange={(event) => {
                const query = event.target.value;
                setFocusGoalQuery(query);
                setFocusGoalId(focusGoalFromTitle(query));
              }}
            />
            <datalist id="cycle-life-goals">
              {lifeGoals.map((goal) => <option key={goal.id} value={goal.title} />)}
            </datalist>
            <div className="mt-2 text-xs text-[var(--muted)]">
              This controls the Current Focus thread on Today. Module visibility stays separate.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary"
            disabled={!canSave}
            onClick={() => action('focusCycle.save', { focusGoalId, cycleLengthDays })}
            type="button"
          >
            Save cycle
          </button>
          <button
            className="btn"
            disabled={!canSave}
            onClick={() => {
              const ok = window.confirm('Start a new focus cycle with this North Star? This will close the current cycle.');
              if (ok) action('focusCycle.start', { focusGoalId, cycleLengthDays });
            }}
            type="button"
          >
            Start new cycle
          </button>
        </div>
      </Parchment>

      <Parchment title="Current Focus Goal" eyebrow="Goal-based focus">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="label-caps mb-2">Focus</div>
            {focusedGoal ? (
              <div className="rounded-2xl border border-brass/25 bg-brass/10 p-4">
                <div className="font-semibold text-brass">{focusedGoal.title}</div>
                {focusedGoal.targetDescription ? <div className="mt-2 text-sm text-[var(--muted)]">{focusedGoal.targetDescription}</div> : null}
              </div>
            ) : <Empty tone="brass">Create a North Star on the Goals page, then choose it here.</Empty>}
          </div>
          <div>
            <div className="label-caps mb-2">Other North Stars</div>
            <div className="flex flex-wrap gap-2">
              {lifeGoals.filter((goal) => goal.id !== focusGoalId).map((goal) => (
                <span key={goal.id} className="rounded-full border px-3 py-1 text-sm text-[var(--muted)]">{goal.title}</span>
              ))}
              {lifeGoals.filter((goal) => goal.id !== focusGoalId).length === 0 ? <span className="text-sm text-[var(--muted)]">No other North Stars yet.</span> : null}
            </div>
          </div>
        </div>
      </Parchment>
    </div>
  );
}

function InlineForm({
  value,
  setValue,
  onAdd,
  placeholder,
  button = 'Add',
  type = 'text',
}: {
  value: string;
  setValue: (value: string) => void;
  onAdd: (value: string) => Promise<void>;
  placeholder: string;
  button?: string;
  type?: string;
}) {
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (value.trim()) onAdd(value.trim()).then(() => setValue(''));
    }} className="mb-4 flex gap-2">
      <Field type={type} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />
        <button className="btn btn-primary">{button}</button>
    </form>
  );
}

function ListItem({
  title,
  note,
  muted,
  right,
  onEdit,
  onDelete,
}: {
  title: string;
  note?: string;
  muted?: boolean;
  right?: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="ledger-row flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className={`truncate text-base font-medium ${muted ? 'text-[var(--muted)] line-through' : ''}`}>{title}</div>
        {note ? <div className="mt-1 text-xs text-[var(--muted)]">{note}</div> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
      {onEdit ? <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white" onClick={onEdit}>Edit</button> : null}
      {onDelete ? <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={onDelete}>Delete</button> : null}
    </div>
  );
}

function Empty({ children, tone = 'brass' }: { children: React.ReactNode; tone?: 'brass' | 'moss' | 'wax' | 'ink' }) {
  return (
    <div className={`empty-state empty-state-${tone}`}>
      <span className="empty-state-icon"><NavIcon name="inbox" className="h-4 w-4" /></span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function submit(event: FormEvent, callback: () => void) {
  event.preventDefault();
  callback();
}

function ask(label: string, current: string | number | null | undefined) {
  return window.prompt(label, current == null ? '' : String(current));
}
