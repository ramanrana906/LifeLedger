import { Dashboard, Row } from './types';

// ── Date helpers ──────────────────────────────────────────────────────────────

export function dateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export function monthKey(value: string | Date) {
  return dateKey(value).slice(0, 7);
}

export function daysBack(todayIso: string, days: number) {
  const end = new Date(todayIso);
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - i);
    result.push(dateKey(date));
  }
  return result;
}

export function filterRange<T extends Row>(rows: T[], key: string, days: number, todayIso: string) {
  if (days === 9999) return rows;
  const min = new Date(todayIso);
  min.setUTCDate(min.getUTCDate() - days + 1);
  return rows.filter((row) => new Date(row[key]).getTime() >= min.getTime());
}

export function daysUntil(dateIso: string, todayIso: string) {
  const end = new Date(dateIso).getTime();
  const now = new Date(todayIso).getTime();
  return Math.ceil((end - now) / 86400000);
}

export function monthEndDate(todayIso: string) {
  const date = new Date(todayIso);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

// ── Navigation helper ──────────────────────────────────────────────────────────

export function navigateTo(tab: string, options?: string | { healthTab?: string; financeTab?: string; learningTab?: string }) {
  if (typeof window !== 'undefined') {
    const next = typeof options === 'string' ? { healthTab: options } : options;
    if (next?.healthTab) window.sessionStorage.setItem('life-ledger-health-tab', next.healthTab);
    if (next?.financeTab) window.sessionStorage.setItem('life-ledger-finance-tab', next.financeTab);
    if (next?.learningTab) window.sessionStorage.setItem('life-ledger-learning-tab', next.learningTab);
  }
  setTimeout(() => document.querySelector<HTMLButtonElement>(`button[data-tab="${tab}"]`)?.click());
}

export type EntityType = 'goal' | 'habit' | 'routine' | 'routine_step' | 'learning_skill' | 'finance_debt' | 'finance_savings' | 'finance_transaction' | 'journal_entry';

export type EntityNavigationTarget = {
  entityType: EntityType;
  entityId: string;
};

const entityNavigationKey = 'life-ledger-entity-target';
const entityNavigationEvent = 'life-ledger:navigate-entity';
const dismissedLinkSuggestionsKey = 'life-ledger-dismissed-link-suggestions';

const entityNavigationMap: Record<
  EntityType,
  {
    tab: string;
    options?: { financeTab?: string; learningTab?: string };
  }
> = {
  goal: { tab: 'Goals' },
  habit: { tab: 'Habits' },
  routine: { tab: 'Routines' },
  routine_step: { tab: 'Routines' },
  learning_skill: {
    tab: 'Learning',
    options: { learningTab: 'Subjects & Skills' },
  },
  finance_debt: { tab: 'Finance', options: { financeTab: 'Debts' } },
  finance_savings: { tab: 'Finance', options: { financeTab: 'Savings' } },
  finance_transaction: {
    tab: 'Finance',
    options: { financeTab: 'Transactions' },
  },
  journal_entry: { tab: 'Today' },
};

export function entityDomId(entityType: string, entityId: string) {
  return `entity-${entityType}-${entityId}`;
}

export function readEntityNavigationTarget(): EntityNavigationTarget | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(entityNavigationKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EntityNavigationTarget>;
    if (!parsed.entityType || !parsed.entityId || !(parsed.entityType in entityNavigationMap)) return null;
    return {
      entityType: parsed.entityType as EntityType,
      entityId: String(parsed.entityId),
    };
  } catch {
    window.sessionStorage.removeItem(entityNavigationKey);
    return null;
  }
}

export function listenForEntityNavigation(callback: (target: EntityNavigationTarget) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handleNavigation = (event?: Event) => {
    const detail = event instanceof CustomEvent ? (event.detail as EntityNavigationTarget | undefined) : undefined;
    const target = detail ?? readEntityNavigationTarget();
    if (target) callback(target);
  };
  window.addEventListener(entityNavigationEvent, handleNavigation);
  const pending = readEntityNavigationTarget();
  if (pending) callback(pending);
  return () => window.removeEventListener(entityNavigationEvent, handleNavigation);
}

export function focusEntityInView(target: EntityNavigationTarget) {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    setTimeout(() => {
      const element = document.getElementById(entityDomId(target.entityType, target.entityId));
      if (!element) return;
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-4', 'ring-brass/20');
      setTimeout(() => element.classList.remove('ring-4', 'ring-brass/20'), 1800);
      const pending = readEntityNavigationTarget();
      if (pending?.entityType === target.entityType && pending.entityId === target.entityId) {
        window.sessionStorage.removeItem(entityNavigationKey);
      }
    }, 80);
  });
}

export function navigateToEntity(entityType: EntityType, entityId: string) {
  if (typeof window !== 'undefined') {
    const target = { entityType, entityId: String(entityId) };
    window.sessionStorage.setItem(entityNavigationKey, JSON.stringify(target));
    window.dispatchEvent(new CustomEvent(entityNavigationEvent, { detail: target }));
  }
  const destination = entityNavigationMap[entityType];
  navigateTo(destination.tab, destination.options);
}

export function dismissedLinkSuggestionKeys() {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(dismissedLinkSuggestionsKey) ?? '[]');
    return new Set<string>(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    window.sessionStorage.removeItem(dismissedLinkSuggestionsKey);
    return new Set<string>();
  }
}

export function rememberDismissedLinkSuggestion(suggestionKey: string) {
  if (typeof window === 'undefined') return;
  const dismissed = dismissedLinkSuggestionKeys();
  dismissed.add(suggestionKey);
  window.sessionStorage.setItem(dismissedLinkSuggestionsKey, JSON.stringify([...dismissed]));
}

// ── Finance utilities ──────────────────────────────────────────────────────────

export function financeTransactionsForMonth(data: Dashboard, month = monthKey(data.today)) {
  return data.transactions.filter((row) => monthKey(row.transactionDate ?? row.date ?? row.createdAt) === month);
}

export function financeTotalsForMonth(data: Dashboard, month = monthKey(data.today)) {
  return financeTransactionsForMonth(data, month).reduce(
    (totals, row) => {
      const amount = Number(row.amount ?? 0);
      if (row.type === 'income') {
        if (row.status === 'predicted') {
          totals.pendingIncome += amount;
          totals.hasPendingIncome = true;
        } else if (row.status === 'confirmed') {
          totals.income += amount;
          totals.confirmedIncome += amount;
        }
      }
      if (row.status === 'confirmed' && row.type === 'expense') totals.expenses += amount;
      if (row.status === 'confirmed' && row.type === 'debt_payment') totals.debtPaid += amount;
      return totals;
    },
    {
      income: 0,
      confirmedIncome: 0,
      pendingIncome: 0,
      hasPendingIncome: false,
      expenses: 0,
      debtPaid: 0,
    },
  );
}

export function expenseBreakdownForMonth(data: Dashboard, month = monthKey(data.today)) {
  const totals = new Map<string, number>();
  financeTransactionsForMonth(data, month)
    .filter((row) => row.type === 'expense' && row.status === 'confirmed')
    .forEach((row) => {
      const category = String(row.category ?? 'Other');
      totals.set(category, (totals.get(category) ?? 0) + Number(row.amount ?? 0));
    });
  return [...totals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function transactionTypeLabel(type?: string) {
  if (type === 'income') return 'Income';
  if (type === 'debt_payment') return 'Debt payment';
  return 'Expense';
}

export function totalAssets(data: Dashboard) {
  const manualAssets = data.assets.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
  const savingsBalance = Number(data.savings?.balance ?? 0);
  return manualAssets + savingsBalance;
}

export function totalLiabilities(data: Dashboard) {
  return data.debts.reduce((sum, item) => sum + Number(item.balance ?? 0), 0);
}

export function debtSeries(data: Dashboard) {
  const payments = [...data.debtPayments].sort((a, b) => String(a.paidOn).localeCompare(String(b.paidOn)));
  const initialDebt = data.debts.reduce((sum, item) => sum + Number(item.principal ?? item.balance), 0);
  let running = initialDebt;
  const points = [
    {
      date: payments[0]?.paidOn ? dateKey(payments[0].paidOn) : data.today,
      debt: Number(initialDebt.toFixed(2)),
    },
  ];
  payments.forEach((payment) => {
    running = Math.max(0, running - Number(payment.principalPortion ?? payment.amount));
    points.push({
      date: dateKey(payment.paidOn),
      debt: Number(running.toFixed(2)),
    });
  });
  const currentDebt = data.debts.reduce((sum, item) => sum + Number(item.balance), 0);
  if (!points.length || points.at(-1)?.date !== data.today) points.push({ date: data.today, debt: Number(currentDebt.toFixed(2)) });
  return points;
}

export function assetSeries(data: Dashboard) {
  const rows = data.netWorthSnapshots.map((row) => ({
    date: dateKey(row.snapshotDate),
    assets: Number(row.totalAssets ?? 0),
  }));
  if (!rows.length && !data.assets.length) return [];
  if (!rows.length) rows.push({ date: data.today, assets: totalAssets(data) });
  return rows;
}

export function netWorthSeries(data: Dashboard) {
  const rows = data.netWorthSnapshots.map((row) => ({
    date: dateKey(row.snapshotDate),
    netWorth: Number(row.netWorth ?? 0),
  }));
  if (!rows.length && !data.assets.length && !data.debts.length) return [];
  if (!rows.length)
    rows.push({
      date: data.today,
      netWorth: totalAssets(data) - totalLiabilities(data),
    });
  return rows;
}

export function monthlyPaymentRate(data: Dashboard) {
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

export function projectedPayoff(data: Dashboard) {
  const payoffDates = data.loanSummaries
    .map((item) => (item.projectedPayoffDate ? new Date(item.projectedPayoffDate).getTime() : null))
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (payoffDates.length) {
    return new Date(Math.max(...payoffDates)).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
    });
  }
  const debt = data.debts.reduce((sum, item) => sum + Number(item.balance), 0);
  const monthly = monthlyPaymentRate(data);
  if (!debt || !monthly) return 'No projection yet';
  const date = new Date(data.today);
  date.setUTCMonth(date.getUTCMonth() + Math.ceil(debt / monthly));
  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

// ── Goal utilities ──────────────────────────────────────────────────────────────

export function activeGoals(data: Dashboard) {
  const activeSet = new Set(data.goals.filter((g) => !g.deletedAt).map((g) => String(g.id)));
  return data.goals.filter((goal) => {
    if (goal.deletedAt) return false;
    let current = goal;
    const seen = new Set<string>();
    while (current?.parentGoalId) {
      if (seen.has(String(current.id))) return false;
      seen.add(String(current.id));
      if (!activeSet.has(String(current.parentGoalId))) return false;
      current = data.goals.find((item) => String(item.id) === String(current.parentGoalId))!;
    }
    return true;
  });
}

export function goalChildren(data: Dashboard, parentGoalId: string | null) {
  return activeGoals(data)
    .filter((goal) => (goal.parentGoalId ?? null) === parentGoalId)
    .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
}

export function childGoalLevel(level: string) {
  if (['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(level)) return 'monthly';
  if (level === 'monthly') return 'weekly';
  if (level === 'weekly') return 'daily';
  return null;
}

export function goalLevelLabel(level: string) {
  if (['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(level)) return 'North Star';
  if (level === 'monthly') return 'Monthly Goal';
  if (level === 'weekly') return 'Weekly Goal';
  if (level === 'daily') return 'Daily Goal';
  return 'Goal';
}

export function goalPrompt(level: string) {
  if (['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(level)) return "What's the ONE Thing I want to achieve as my North Star?";
  if (level === 'monthly') return "Based on my North Star Goal, what's the ONE Thing I can do this month?";
  if (level === 'weekly') return "Based on my Monthly Goal, what's the ONE Thing I can do this week?";
  if (level === 'daily') return "Based on my Weekly Goal, what's the ONE Thing I can do today?";
  return 'What is the next clear goal?';
}

export function addGoalLabel(level: string) {
  if (['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(level)) return '+ Add North Star goal';
  if (level === 'monthly') return '+ Add monthly goal';
  if (level === 'weekly') return '+ Add weekly goal';
  if (level === 'daily') return '+ Add daily goal';
  return '+ Add child goal';
}

export function goalTitle(data: Dashboard, goalId?: string | null) {
  if (!goalId) return null;
  return data.goals.find((goal) => goal.id === goalId)?.title ?? null;
}

export function goalDefinition(goal: Row) {
  return String(goal.definitionOfDone ?? goal.targetDescription ?? '');
}

export function northStarForGoal(data: Dashboard, goal: Row | null | undefined) {
  let current = goal;
  const seen = new Set<string>();
  while (current?.parentGoalId && !seen.has(String(current.id))) {
    seen.add(String(current.id));
    current = data.goals.find((item) => item.id === current?.parentGoalId);
  }
  return current && ['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(String(current?.level)) ? current : null;
}

export function northStarWhyLine(data: Dashboard, goal: Row | null | undefined) {
  const northStar = northStarForGoal(data, goal);
  if (!northStar?.whyThisMatters) return null;
  return `Part of: ${northStar.title} - because ${northStar.whyThisMatters}`;
}

export function currentFocusGoal(data: Dashboard) {
  const focusGoalId = data.focusCycle?.focusGoalId;
  return focusGoalId ? (data.goals.find((goal) => goal.id === focusGoalId) ?? null) : null;
}

export function descendantGoalIds(data: Dashboard, goalId: string) {
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

export function goalProgress(data: Dashboard, goalId: string) {
  const ids = descendantGoalIds(data, goalId);
  const completable = data.goals.filter((goal) => ids.has(goal.id) && goal.id !== goalId && (goal.level === 'weekly' || goal.level === 'daily'));
  const complete = completable.filter((goal) => goal.completed).length;
  return { complete, total: completable.length };
}

export function parseTargetAmount(value?: string | number | null) {
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

export function financeGoalProgress(data: Dashboard, goal: Row) {
  const connections = getLinkedEntities(data, 'goal', String(goal.id));
  const debtIds = new Set(connections.filter((connection) => connection.entityType === 'finance_debt').map((connection) => connection.entityId));
  const savingsIds = new Set(connections.filter((connection) => connection.entityType === 'finance_savings').map((connection) => connection.entityId));
  const linkedDebts = data.debts.filter((debt) => debtIds.has(String(debt.id)));
  const savingsId = data.savings ? String(data.savings.userId ?? 'savings') : '';
  const linkedSavings = data.savings && savingsIds.has(savingsId) ? data.savings : null;
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

export function goalLevelClasses(level: string) {
  if (level === 'life')
    return {
      card: 'border-l-4 border-l-brass bg-card shadow-sm',
      title: 'text-lg font-semibold text-ink',
      meta: 'text-xs',
      pad: 'p-4',
    };
  if (level === 'monthly')
    return {
      card: 'border-l-4 border-l-moss/70 bg-background/60',
      title: 'text-base font-semibold text-ink',
      meta: 'text-xs',
      pad: 'p-3',
    };
  if (level === 'weekly')
    return {
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

// ── Activity / Heatmap utilities ───────────────────────────────────────────────

export function moduleCountsByDay(data: Dashboard, days = 90) {
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

  return daysBack(data.today, days).map((date) => ({
    date,
    count: counts.get(date)?.size ?? 0,
  }));
}

export function daysLoggedThisWeek(data: Dashboard) {
  const week = new Set(daysBack(data.today, 7));
  return moduleCountsByDay(data, 7).filter((day) => week.has(day.date) && day.count > 0).length;
}

// ── Learning utilities ────────────────────────────────────────────────────────

export function studyStreak(data: Dashboard) {
  const studied = new Set(data.sessions.map((row) => dateKey(row.logDate)));
  let streak = 0;
  for (const date of [...daysBack(data.today, 365)].reverse()) {
    if (!studied.has(date)) break;
    streak += 1;
  }
  return streak;
}

// ── Skill stage utilities ─────────────────────────────────────────────────────

import { skillStages } from './constants';

export function skillStageIndex(stage?: string) {
  const index = skillStages.findIndex((item) => item.value === stage);
  return index >= 0 ? index : 0;
}

export function skillStageLabel(stage?: string) {
  return skillStages[skillStageIndex(stage)].label;
}

// ── Routine utilities ─────────────────────────────────────────────────────────

export function routineAppliesNow(anchor?: string | null) {
  if (!anchor || anchor === 'anytime') return true;
  const hour = new Date().getHours();
  if (anchor === 'morning') return hour >= 4 && hour < 12;
  if (anchor === 'afternoon') return hour >= 12 && hour < 17;
  if (anchor === 'evening') return hour >= 17 && hour < 22;
  if (anchor === 'night') return hour >= 22 || hour < 4;
  return true;
}

export function routineAnchorLabel(anchor?: string | null) {
  if (!anchor || anchor === 'anytime') return 'Anytime';
  return anchor[0].toUpperCase() + anchor.slice(1);
}

export function routineStepTypeLabel(type?: string | null) {
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

export function routineStepTargetLabel(data: Dashboard, step: Row) {
  const directType = step.targetType ? String(step.targetType) : null;
  const directId = step.targetId ? String(step.targetId) : null;
  const linkedTarget =
    directType && directId
      ? allLinkableEntities(data).find((item) => item.entityType === directType && item.entityId === directId)
      : getLinkedEntities(data, 'routine_step', String(step.id)).find((item) => item.relationshipType === 'triggered_by');
  if (linkedTarget) return linkedTarget.title;
  if (step.stepType === 'finance') return 'Finance activity today';
  if (step.stepType === 'journal') return 'Today journal entry';
  return null;
}

// ── Form helpers ──────────────────────────────────────────────────────────────

import { FormEvent } from 'react';

export function submit(event: FormEvent, callback: () => void) {
  event.preventDefault();
  callback();
}

export function ask(label: string, current: string | number | null | undefined) {
  return window.prompt(label, current == null ? '' : String(current));
}

export type LinkableEntity = {
  entityType: EntityType;
  entityId: string;
  title: string;
  subtitle: string;
  level?: string;
  selectable?: boolean;
};

export function allLinkableEntities(data: Dashboard): LinkableEntity[] {
  const result: LinkableEntity[] = [];

  (data.goals ?? [])
    .filter((g) => !g.deletedAt)
    .forEach((g) => {
      result.push({
        entityType: 'goal',
        entityId: String(g.id),
        title: String(g.title ?? 'Untitled goal'),
        subtitle: `Goal (${g.level ?? 'North Star'})`,
        level: String(g.level ?? ''),
      });
    });

  (data.habits ?? [])
    .filter((h) => !h.deletedAt)
    .forEach((h) => {
      result.push({
        entityType: 'habit',
        entityId: String(h.id),
        title: String(h.name ?? 'Untitled habit'),
        subtitle: `Habit (${h.kind ?? 'build'})`,
      });
    });

  (data.skills ?? [])
    .filter((s) => !s.deletedAt)
    .forEach((s) => {
      result.push({
        entityType: 'learning_skill',
        entityId: String(s.id),
        title: String(s.name ?? 'Untitled skill'),
        subtitle: 'Learning Skill',
      });
    });

  (data.routines ?? [])
    .filter((r) => !r.deletedAt)
    .forEach((r) => {
      result.push({
        entityType: 'routine',
        entityId: String(r.id),
        title: String(r.name ?? 'Untitled routine'),
        subtitle: `Routine (${r.timeAnchor ?? 'anytime'})`,
      });
      (r.steps ?? [])
        .filter((step: Row) => !step.deletedAt)
        .forEach((step: Row) => {
          result.push({
            entityType: 'routine_step',
            entityId: String(step.id),
            title: String(step.stepName ?? 'Untitled routine step'),
            subtitle: `Step in ${r.name ?? 'routine'}`,
          });
        });
    });

  (data.debts ?? [])
    .filter((d) => !d.deletedAt)
    .forEach((d) => {
      result.push({
        entityType: 'finance_debt',
        entityId: String(d.id),
        title: String(d.name ?? 'Untitled debt'),
        subtitle: `Debt (₹${Number(d.balance ?? 0).toLocaleString('en-IN')})`,
      });
    });

  if (data.savings) {
    result.push({
      entityType: 'finance_savings',
      entityId: String(data.savings.userId ?? 'savings'),
      title: 'Savings Account',
      subtitle: `Liquid Savings (₹${Number(data.savings.balance ?? 0).toLocaleString('en-IN')})`,
    });
  }

  (data.transactions ?? [])
    .filter((t) => !t.deletedAt)
    .forEach((t) => {
      result.push({
        entityType: 'finance_transaction',
        entityId: String(t.id),
        title: `${t.category ?? 'Transaction'} ₹${Number(t.amount ?? 0).toFixed(2)}`,
        subtitle: `Transaction (${dateKey(t.transactionDate)})`,
      });
    });

  (data.journalEntries ?? [])
    .filter((j) => !j.deletedAt)
    .forEach((j) => {
      result.push({
        entityType: 'journal_entry',
        entityId: String(j.id),
        title: `Journal (${dateKey(j.entryDate)}) - ${j.mood ?? 'Entry'}`,
        subtitle: j.body ? j.body.substring(0, 40) + '...' : 'Journal Entry',
      });
    });

  return result;
}

export type LinkedEntityResult = {
  linkId: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  subtitle: string;
  relationshipType: string;
  direction: 'source' | 'target';
};

export function getLinkedEntities(data: Dashboard, entityType: EntityType, entityId: string): LinkedEntityResult[] {
  const links = data.entityLinks ?? [];
  const allEntities = allLinkableEntities(data);
  const entityMap = new Map<string, LinkableEntity>();
  allEntities.forEach((e) => entityMap.set(`${e.entityType}:${e.entityId}`, e));

  const results: LinkedEntityResult[] = [];

  links.forEach((l) => {
    if (l.sourceType === entityType && String(l.sourceId) === String(entityId)) {
      const match = entityMap.get(`${l.targetType}:${l.targetId}`);
      results.push({
        linkId: String(l.id),
        entityType: l.targetType as EntityType,
        entityId: String(l.targetId),
        title: match?.title ?? `${l.targetType} (${String(l.targetId).substring(0, 6)})`,
        subtitle: match?.subtitle ?? l.targetType,
        relationshipType: l.relationshipType ?? 'linked',
        direction: 'source',
      });
    } else if (l.targetType === entityType && String(l.targetId) === String(entityId)) {
      const match = entityMap.get(`${l.sourceType}:${l.sourceId}`);
      results.push({
        linkId: String(l.id),
        entityType: l.sourceType as EntityType,
        entityId: String(l.sourceId),
        title: match?.title ?? `${l.sourceType} (${String(l.sourceId).substring(0, 6)})`,
        subtitle: match?.subtitle ?? l.sourceType,
        relationshipType: l.relationshipType ?? 'linked',
        direction: 'target',
      });
    }
  });

  return results;
}
