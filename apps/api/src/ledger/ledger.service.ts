import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  amortizePayment,
  applyPrincipalPayment,
  emiWarning,
  projectedPayoffMonths,
} from './amortization';
import {
  computeCorrelationPatterns,
  type CorrelationPattern,
} from './correlation-engine';
import {
  evaluateRoutineStatuses,
  routineStepType,
  sameDate,
  type RoutineStatus,
  type RoutineStepTypeValue,
} from './routine-engine';

const MODULES = [
  'journal',
  'goals',
  'finance',
  'health',
  'sleep',
  'relationships',
  'learning',
  'habits',
  'routines',
];
const DEFAULT_FOCUS_AREAS = ['journal', 'goals', 'habits'];
const DEFAULT_CYCLE_LENGTH_DAYS = 90;
const TRANSACTION_TYPES = ['income', 'expense', 'debt_payment'] as const;
const SKILL_STAGES = [
  'DONT_KNOW_HOW',
  'KNOW_HOW_NOT_DONE',
  'CAN_DO_IT',
  'DO_IT_WELL',
  'COACH_IT',
] as const;
type SkillStageValue = (typeof SKILL_STAGES)[number];

function dateOnly(value: string | Date = new Date()) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function today() {
  return dateOnly();
}

function weekStart() {
  const now = today();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  now.setUTCDate(now.getUTCDate() + diff);
  return now;
}

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function cycleEnd(startDate: Date, cycleLengthDays: number) {
  return addDays(startDate, Math.max(1, cycleLengthDays) - 1);
}

function nextDueDate(after: Date, dueDay: number) {
  const clampedDay = Math.min(Math.max(dueDay, 1), 28);
  const candidate = new Date(
    Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), clampedDay),
  );
  if (candidate <= after) return addMonths(candidate, 1);
  return candidate;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return fallback;
}

function active<T extends Record<string, unknown>>(where: T) {
  return { ...where, deletedAt: null };
}

function checkedRoutineStepType(value: unknown) {
  try {
    return routineStepType(value);
  } catch {
    throw new BadRequestException('Unknown routine step type.');
  }
}

function checkedTransactionType(value: unknown) {
  const type = asString(value, 'expense');
  if (!TRANSACTION_TYPES.includes(type as (typeof TRANSACTION_TYPES)[number])) {
    throw new BadRequestException('Unknown transaction type.');
  }
  return type as (typeof TRANSACTION_TYPES)[number];
}

function checkedSkillStage(value: unknown): SkillStageValue {
  const raw = asString(value, 'DONT_KNOW_HOW');
  if (SKILL_STAGES.includes(raw as SkillStageValue))
    return raw as SkillStageValue;

  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const fallbackMap: Record<string, SkillStageValue> = {
    coach: 'COACH_IT',
    coach_it: 'COACH_IT',
    teach: 'COACH_IT',
    expert: 'COACH_IT',
    mastered: 'COACH_IT',
    do_it_well: 'DO_IT_WELL',
    done_well: 'DO_IT_WELL',
    advanced: 'DO_IT_WELL',
    complete: 'DO_IT_WELL',
    completed: 'DO_IT_WELL',
    can_do_it: 'CAN_DO_IT',
    active: 'CAN_DO_IT',
    doing: 'CAN_DO_IT',
    practice: 'CAN_DO_IT',
    practicing: 'CAN_DO_IT',
    know_how: 'KNOW_HOW_NOT_DONE',
    know_how_not_done: 'KNOW_HOW_NOT_DONE',
    learning: 'KNOW_HOW_NOT_DONE',
    studying: 'KNOW_HOW_NOT_DONE',
  };
  return fallbackMap[normalized] ?? 'DONT_KNOW_HOW';
}

function toJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toJson);
  if (value && typeof value === 'object') {
    if (
      'toNumber' in value &&
      typeof (value as { toNumber?: unknown }).toNumber === 'function'
    ) {
      return (value as { toNumber: () => number }).toNumber();
    }
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJson(item)]),
    );
  }
  return value;
}

@Injectable()
export class LedgerService {
  private readonly patternCache = new Map<
    string,
    { computedAt: Date; patterns: CorrelationPattern[] }
  >();

  constructor(private readonly prisma: PrismaService) {}

  private async applyDueEmis(userId: string, currentDate: Date) {
    const loans = await this.prisma.debt.findMany({
      where: {
        userId,
        deletedAt: null,
        emiAmount: { not: null },
        dueDay: { not: null },
        balance: { gt: 0 },
      },
    });

    let applied = false;

    for (const loan of loans) {
      let balance = Number(loan.balance);
      const emiAmount = Number(loan.emiAmount);
      const dueDay = loan.dueDay ?? 1;
      let dueDate = nextDueDate(
        loan.lastEmiAppliedOn ?? loan.createdAt,
        dueDay,
      );

      while (dueDate <= currentDate && balance > 0) {
        const alreadyApplied = await this.prisma.debtPayment.findFirst({
          where: {
            debtId: loan.id,
            paidOn: dueDate,
            kind: 'emi',
            deletedAt: null,
          },
        });

        if (!alreadyApplied) {
          const payment = amortizePayment(
            balance,
            Number(loan.interestRate),
            emiAmount,
          );
          await this.prisma.$transaction([
            this.prisma.debtPayment.create({
              data: {
                userId,
                debtId: loan.id,
                amount: payment.amount,
                kind: 'emi',
                interestPortion: payment.interestPortion,
                principalPortion: payment.principalPortion,
                resultingBalance: payment.resultingBalance,
                paidOn: dueDate,
              },
            }),
            this.prisma.debt.update({
              where: { id: loan.id },
              data: {
                balance: payment.resultingBalance,
                lastEmiAppliedOn: dueDate,
              },
            }),
          ]);
          balance = payment.resultingBalance;
          applied = true;
        }

        dueDate = addMonths(dueDate, 1);
      }
    }

    return applied;
  }

  async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Unknown user.');

    await this.prisma.profile.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, displayName: user.name },
    });
    await this.prisma.userStats.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    await this.prisma.savings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    await Promise.all(
      MODULES.map((module) =>
        this.prisma.enabledModule.upsert({
          where: { userId_module: { userId, module } },
          update: {},
          create: { userId, module, enabled: true },
        }),
      ),
    );
    await this.currentFocusCycle(userId, today());

    return user;
  }

  private normalizeFocusAreas(value: unknown) {
    const list = Array.isArray(value) ? value.map(String) : [];
    const unique = [...new Set(list.filter((item) => MODULES.includes(item)))];
    return unique.slice(0, 3);
  }

  private normalizeIdList(value: unknown) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(String).filter(Boolean))];
  }

  private nextGoalLevel(parentLevel: string) {
    if (parentLevel === 'life') return 'monthly';
    if (parentLevel === 'monthly') return 'weekly';
    if (parentLevel === 'weekly') return 'daily';
    return 'daily';
  }

  private async firstLifeGoal(userId: string) {
    return this.prisma.goal.findFirst({
      where: active({ userId, level: 'life' }),
      orderBy: { createdAt: 'asc' },
    });
  }

  private async currentFocusCycle(userId: string, currentDate: Date) {
    const cycle = await this.prisma.focusCycle.findFirst({
      where: { userId, completedAt: null },
      orderBy: { startDate: 'desc' },
    });
    if (cycle) return cycle;
    const firstGoal = await this.firstLifeGoal(userId);

    return this.prisma.focusCycle.create({
      data: {
        userId,
        startDate: currentDate,
        endDate: cycleEnd(currentDate, DEFAULT_CYCLE_LENGTH_DAYS),
        cycleLengthDays: DEFAULT_CYCLE_LENGTH_DAYS,
        focusAreas: DEFAULT_FOCUS_AREAS,
        focusGoalId: firstGoal?.id ?? null,
      },
    });
  }

  private async routineStepLinkData(
    userId: string,
    stepType: RoutineStepTypeValue,
    body: Record<string, unknown>,
  ) {
    const data = {
      linkedHabitId: null as string | null,
      linkedDailyGoalId: null as string | null,
      linkedWeeklyGoalId: null as string | null,
      linkedSkillId: null as string | null,
      linkedFinanceAction: null as string | null,
      linkedJournal: null as string | null,
    };

    if (stepType === 'habit' && body.linkedHabitId) {
      const linkedHabitId = asString(body.linkedHabitId);
      await this.prisma.habit.findFirstOrThrow({
        where: active({ id: linkedHabitId, userId }),
      });
      data.linkedHabitId = linkedHabitId;
    }

    if (stepType === 'daily_goal' && body.linkedDailyGoalId) {
      const linkedDailyGoalId = asString(body.linkedDailyGoalId);
      await this.prisma.goal.findFirstOrThrow({
        where: active({ id: linkedDailyGoalId, userId, level: 'daily' }),
      });
      data.linkedDailyGoalId = linkedDailyGoalId;
    }

    if (stepType === 'weekly_goal' && body.linkedWeeklyGoalId) {
      const linkedWeeklyGoalId = asString(body.linkedWeeklyGoalId);
      await this.prisma.goal.findFirstOrThrow({
        where: active({ id: linkedWeeklyGoalId, userId, level: 'weekly' }),
      });
      data.linkedWeeklyGoalId = linkedWeeklyGoalId;
    }

    if (stepType === 'learning' && body.linkedSkillId) {
      const linkedSkillId = asString(body.linkedSkillId);
      await this.prisma.skill.findFirstOrThrow({
        where: active({ id: linkedSkillId, userId }),
      });
      data.linkedSkillId = linkedSkillId;
    }

    if (stepType === 'finance') {
      data.linkedFinanceAction = asString(body.linkedFinanceAction, 'expense');
    }

    if (stepType === 'journal') {
      data.linkedJournal = asString(body.linkedJournal, 'today');
    }

    return data;
  }

  private async persistRoutineDayLogs(
    userId: string,
    currentDate: Date,
    statuses: RoutineStatus[],
  ) {
    await Promise.all(
      statuses.map((routine) =>
        this.prisma.routineDayLog.upsert({
          where: {
            routineId_logDate: {
              routineId: routine.routineId,
              logDate: currentDate,
            },
          },
          update: {
            linkedGoalId: routine.linkedGoalId,
            completionPct: routine.completionPct,
            status: routine.status,
          },
          create: {
            userId,
            routineId: routine.routineId,
            linkedGoalId: routine.linkedGoalId,
            logDate: currentDate,
            completionPct: routine.completionPct,
            status: routine.status,
          },
        }),
      ),
    );
  }

  async dashboard(userId: string) {
    await this.ensureUser(userId);
    const t = today();
    const appliedEmis = await this.applyDueEmis(userId, t);
    if (appliedEmis) await this.recordNetWorthSnapshot(userId, t);
    const ws = weekStart();
    const [
      stats,
      profile,
      focusCycle,
      journal,
      goals,
      dailyGoals,
      lifeGoals,
      weeklyGoals,
      debts,
      incomeSources,
      savings,
      financeMonths,
      financeTransactions,
      weights,
      diet,
      workouts,
      sleep,
      habits,
      checkins,
      dates,
      skills,
      sessions,
      debtPayments,
      assets,
      assetSnapshots,
      netWorthSnapshots,
      dietLogs,
      journalEntries,
      xpEvents,
      patterns,
      weeklyReflection,
      journalGoalTags,
      journalHabitTags,
      routines,
      routineStepCompletions,
      routineDayLogsForStreaks,
    ] = await Promise.all([
      this.prisma.userStats.findUnique({ where: { userId } }),
      this.prisma.profile.findUnique({ where: { id: userId } }),
      this.currentFocusCycle(userId, t),
      this.prisma.journalEntry.findFirst({
        where: active({ userId, entryDate: t }),
        include: { goalTags: true, habitTags: true },
      }),
      this.prisma.goal.findMany({
        where: active({ userId }),
        orderBy: [{ level: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.dailyGoal.findMany({
        where: active({ userId, entryDate: t }),
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.lifeGoal.findMany({
        where: active({ userId }),
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.weeklyGoal.findMany({
        where: active({ userId, weekStart: ws }),
        include: { lifeGoal: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.debt.findMany({
        where: active({ userId }),
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.incomeSource.findMany({
        where: active({ userId }),
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.savings.findUnique({ where: { userId } }),
      this.prisma.financeMonth.findMany({
        where: active({ userId }),
        orderBy: { month: 'desc' },
      }),
      this.prisma.financeTransaction.findMany({
        where: active({ userId }),
        include: { linkedDebt: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        take: 500,
      }),
      this.prisma.weightLog.findMany({
        where: active({ userId }),
        orderBy: { logDate: 'asc' },
      }),
      this.prisma.dietLog.findFirst({ where: active({ userId, logDate: t }) }),
      this.prisma.workoutLog.findMany({
        where: active({ userId }),
        orderBy: { logDate: 'desc' },
        take: 30,
      }),
      this.prisma.sleepLog.findMany({
        where: active({ userId }),
        orderBy: { logDate: 'desc' },
        take: 30,
      }),
      this.prisma.habit.findMany({
        where: active({ userId }),
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.relationshipCheckin.findMany({
        where: active({ userId, weekStart: ws }),
        orderBy: { personName: 'asc' },
      }),
      this.prisma.importantDate.findMany({
        where: active({ userId }),
        orderBy: { date: 'asc' },
      }),
      this.prisma.skill.findMany({
        where: active({ userId }),
        orderBy: { name: 'asc' },
      }),
      this.prisma.learningSession.findMany({
        where: active({ userId }),
        include: { skill: true },
        orderBy: { logDate: 'desc' },
        take: 120,
      }),
      this.prisma.debtPayment.findMany({
        where: active({ userId }),
        orderBy: { paidOn: 'asc' },
      }),
      this.prisma.asset.findMany({
        where: active({ userId }),
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.assetSnapshot.findMany({
        where: { userId },
        orderBy: { snapshotDate: 'asc' },
        take: 180,
      }),
      this.prisma.netWorthSnapshot.findMany({
        where: { userId },
        orderBy: { snapshotDate: 'asc' },
        take: 180,
      }),
      this.prisma.dietLog.findMany({
        where: active({ userId }),
        orderBy: { logDate: 'asc' },
        take: 90,
      }),
      this.prisma.journalEntry.findMany({
        where: active({ userId }),
        orderBy: { entryDate: 'asc' },
        take: 120,
      }),
      this.prisma.xpEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: 240,
      }),
      this.correlationPatterns(userId, t, ws),
      this.prisma.weeklyReflection.findUnique({
        where: { userId_weekStart: { userId, weekStart: ws } },
      }),
      this.prisma.journalGoalTag.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: 240,
      }),
      this.prisma.journalHabitTag.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: 240,
      }),
      this.prisma.routine.findMany({
        where: active({ userId }),
        include: {
          steps: { where: { deletedAt: null }, orderBy: { orderIndex: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.routineStepCompletion.findMany({
        where: { userId, completedOn: t },
      }),
      this.prisma.routineDayLog.findMany({
        where: { userId },
        orderBy: { logDate: 'asc' },
        take: 365,
      }),
    ]);

    const loanSummaries = debts.map((debt) => {
      const balance = Number(debt.balance);
      const emiAmount = debt.emiAmount == null ? null : Number(debt.emiAmount);
      const payoffMonths = emiAmount
        ? projectedPayoffMonths(balance, Number(debt.interestRate), emiAmount)
        : null;
      const payoffDate =
        payoffMonths == null ? null : addMonths(t, payoffMonths);
      const paymentsForLoan = debtPayments.filter(
        (payment) => payment.debtId === debt.id,
      );
      return {
        debtId: debt.id,
        totalInterestPaid: paymentsForLoan.reduce(
          (sum, payment) => sum + Number(payment.interestPortion ?? 0),
          0,
        ),
        totalPrincipalPaid: paymentsForLoan.reduce(
          (sum, payment) =>
            sum + Number(payment.principalPortion ?? payment.amount ?? 0),
          0,
        ),
        projectedPayoffDate: payoffDate,
        emiWarning: emiWarning(
          Number(debt.principal),
          Number(debt.interestRate),
          debt.tenureMonths,
          emiAmount,
        ),
      };
    });

    const routineStatuses = evaluateRoutineStatuses({
      routines,
      currentDate: t,
      goals,
      habits,
      sessions,
      financeMonths,
      transactions: financeTransactions,
      debtPayments,
      journal,
      standaloneCompletions: routineStepCompletions,
      routineDayLogs: routineDayLogsForStreaks,
    });
    await this.persistRoutineDayLogs(userId, t, routineStatuses);
    const routineDayLogs = await this.prisma.routineDayLog.findMany({
      where: { userId },
      orderBy: { logDate: 'asc' },
      take: 365,
    });

    return toJson({
      stats,
      profile,
      focusCycle,
      today: t,
      weekStart: ws,
      journal,
      goals,
      dailyGoals,
      lifeGoals,
      weeklyGoals,
      debts,
      incomeSources,
      savings,
      financeMonths,
      transactions: financeTransactions,
      weights,
      diet,
      workouts,
      sleep,
      habits,
      checkins,
      dates,
      skills,
      sessions,
      debtPayments,
      assets,
      assetSnapshots,
      netWorthSnapshots,
      loanSummaries,
      dietLogs,
      journalEntries,
      xpEvents,
      patterns,
      weeklyReflection,
      journalGoalTags,
      journalHabitTags,
      routines,
      routineStatuses,
      routineDayLogs,
    });
  }

  private async correlationPatterns(
    userId: string,
    currentDate: Date,
    currentWeekStart: Date,
  ) {
    const cacheKey = `${userId}:${currentWeekStart.toISOString().slice(0, 10)}`;
    const cached = this.patternCache.get(cacheKey);
    if (cached) return cached.patterns;

    const start = addDays(currentDate, -100);
    const [
      journals,
      sleep,
      diet,
      weights,
      sessions,
      dailyGoals,
      habits,
      routineDayLogs,
    ] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where: active({ userId, entryDate: { gte: start } }),
        orderBy: { entryDate: 'asc' },
      }),
      this.prisma.sleepLog.findMany({
        where: active({ userId, logDate: { gte: start } }),
        orderBy: { logDate: 'asc' },
      }),
      this.prisma.dietLog.findMany({
        where: active({ userId, logDate: { gte: start } }),
        orderBy: { logDate: 'asc' },
      }),
      this.prisma.weightLog.findMany({
        where: active({ userId, logDate: { gte: start } }),
        orderBy: { logDate: 'asc' },
      }),
      this.prisma.learningSession.findMany({
        where: active({ userId, logDate: { gte: start } }),
        orderBy: { logDate: 'asc' },
      }),
      this.prisma.goal.findMany({
        where: active({ userId, level: 'daily', targetDate: { gte: start } }),
        orderBy: { targetDate: 'asc' },
      }),
      this.prisma.habit.findMany({
        where: active({ userId }),
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.routineDayLog.findMany({
        where: { userId, linkedGoalId: { not: null }, logDate: { gte: start } },
        orderBy: { logDate: 'asc' },
      }),
    ]);

    const patterns = computeCorrelationPatterns({
      today: currentDate,
      journals,
      sleep,
      diet,
      weights,
      sessions,
      dailyGoals,
      habits,
      routineDayLogs,
    });

    this.patternCache.set(cacheKey, { computedAt: new Date(), patterns });
    return patterns;
  }

  private async recordAssetSnapshot(
    userId: string,
    assetId: string,
    value: number,
    snapshotDate = today(),
  ) {
    return this.prisma.assetSnapshot.create({
      data: {
        userId,
        assetId,
        value,
        snapshotDate,
      },
    });
  }

  private async recordNetWorthSnapshot(userId: string, snapshotDate = today()) {
    const [assets, debts] = await Promise.all([
      this.prisma.asset.findMany({ where: active({ userId }) }),
      this.prisma.debt.findMany({ where: active({ userId }) }),
    ]);
    const totalAssets = assets.reduce(
      (sum, asset) => sum + Number(asset.currentValue),
      0,
    );
    const liabilities = debts.reduce(
      (sum, debt) => sum + Number(debt.balance),
      0,
    );
    return this.prisma.netWorthSnapshot.create({
      data: {
        userId,
        totalAssets,
        liabilities,
        netWorth: totalAssets - liabilities,
        snapshotDate,
      },
    });
  }

  async awardXp(userId: string, source: string, amount: number) {
    await this.prisma.xpEvent.create({ data: { userId, source, amount } });
    const current = await this.prisma.userStats.upsert({
      where: { userId },
      update: { xp: { increment: amount }, lastActiveDate: today() },
      create: { userId, xp: amount, lastActiveDate: today() },
    });
    let level = current.level;
    let xp = current.xp;
    let leveledUp = false;

    while (xp >= level * 100) {
      xp -= level * 100;
      level += 1;
      leveledUp = true;
    }

    if (leveledUp) {
      await this.prisma.userStats.update({
        where: { userId },
        data: { level, xp },
      });
    }
  }

  async action(userId: string, type: string, body: Record<string, unknown>) {
    await this.ensureUser(userId);
    const t = today();
    const ws = weekStart();

    switch (type) {
      case 'journal.save': {
        const existing = await this.prisma.journalEntry.findUnique({
          where: { userId_entryDate: { userId, entryDate: t } },
        });
        const entry = await this.prisma.journalEntry.upsert({
          where: { userId_entryDate: { userId, entryDate: t } },
          update: {
            mood: String(body.mood ?? 'Steady'),
            body: String(body.body ?? ''),
            deletedAt: null,
          },
          create: {
            userId,
            entryDate: t,
            mood: String(body.mood ?? 'Steady'),
            body: String(body.body ?? ''),
          },
        });
        const goalIds = this.normalizeIdList(body.goalIds);
        const habitIds = this.normalizeIdList(body.habitIds);
        await this.prisma.$transaction([
          this.prisma.journalGoalTag.deleteMany({
            where: { journalEntryId: entry.id },
          }),
          this.prisma.journalHabitTag.deleteMany({
            where: { journalEntryId: entry.id },
          }),
          ...goalIds.map((goalId) =>
            this.prisma.journalGoalTag.create({
              data: { userId, journalEntryId: entry.id, goalId },
            }),
          ),
          ...habitIds.map((habitId) =>
            this.prisma.journalHabitTag.create({
              data: { userId, journalEntryId: entry.id, habitId },
            }),
          ),
        ]);
        if (!existing) await this.awardXp(userId, 'journal', 10);
        return toJson(entry);
      }
      case 'journal.update':
        return toJson(
          await this.prisma.journalEntry.update({
            where: { id: String(body.id) },
            data: {
              mood: String(body.mood ?? 'Steady'),
              body: String(body.body ?? ''),
            },
          }),
        );
      case 'journal.delete':
        return toJson(
          await this.prisma.journalEntry.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'journal.restore':
        return toJson(
          await this.prisma.journalEntry.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'dailyGoal.add':
        return toJson(
          await this.prisma.dailyGoal.create({
            data: { userId, entryDate: t, title: String(body.title ?? '') },
          }),
        );
      case 'dailyGoal.update':
        return toJson(
          await this.prisma.dailyGoal.update({
            where: { id: String(body.id) },
            data: { title: String(body.title ?? '') },
          }),
        );
      case 'dailyGoal.toggle': {
        const goal = await this.prisma.dailyGoal.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        if (!goal.completed) await this.awardXp(userId, 'goal', 5);
        return toJson(
          await this.prisma.dailyGoal.update({
            where: { id: goal.id },
            data: { completed: !goal.completed },
          }),
        );
      }
      case 'dailyGoal.delete':
        return toJson(
          await this.prisma.dailyGoal.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'dailyGoal.restore':
        return toJson(
          await this.prisma.dailyGoal.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'lifeGoal.add':
        return toJson(
          await this.prisma.lifeGoal.create({
            data: { userId, title: String(body.title ?? '') },
          }),
        );
      case 'lifeGoal.update':
        return toJson(
          await this.prisma.lifeGoal.update({
            where: { id: String(body.id) },
            data: { title: String(body.title ?? '') },
          }),
        );
      case 'lifeGoal.toggle': {
        const goal = await this.prisma.lifeGoal.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        if (!goal.completed) await this.awardXp(userId, 'life_goal', 20);
        return toJson(
          await this.prisma.lifeGoal.update({
            where: { id: goal.id },
            data: { completed: !goal.completed },
          }),
        );
      }
      case 'lifeGoal.delete':
        return toJson(
          await this.prisma.lifeGoal.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'lifeGoal.restore':
        return toJson(
          await this.prisma.lifeGoal.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'weeklyGoal.add':
        return toJson(
          await this.prisma.weeklyGoal.create({
            data: {
              userId,
              weekStart: ws,
              title: String(body.title ?? ''),
              lifeGoalId: body.lifeGoalId ? String(body.lifeGoalId) : null,
            },
          }),
        );
      case 'weeklyGoal.toggle': {
        const goal = await this.prisma.weeklyGoal.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        if (!goal.completed) await this.awardXp(userId, 'weekly_goal', 10);
        return toJson(
          await this.prisma.weeklyGoal.update({
            where: { id: goal.id },
            data: { completed: !goal.completed },
          }),
        );
      }
      case 'weeklyGoal.update':
        return toJson(
          await this.prisma.weeklyGoal.update({
            where: { id: String(body.id) },
            data: {
              title: String(body.title ?? ''),
              lifeGoalId: body.lifeGoalId ? String(body.lifeGoalId) : null,
            },
          }),
        );
      case 'weeklyGoal.delete':
        return toJson(
          await this.prisma.weeklyGoal.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'weeklyGoal.restore':
        return toJson(
          await this.prisma.weeklyGoal.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'goal.add': {
        const parentGoalId = body.parentGoalId
          ? String(body.parentGoalId)
          : null;
        const parent = parentGoalId
          ? await this.prisma.goal.findFirstOrThrow({
              where: active({ id: parentGoalId, userId }),
            })
          : null;
        const level = parent
          ? this.nextGoalLevel(parent.level)
          : String(body.level ?? 'life');
        if (!['life', 'monthly', 'weekly', 'daily'].includes(level)) {
          throw new BadRequestException('Unknown goal level.');
        }
        return toJson(
          await this.prisma.goal.create({
            data: {
              userId,
              parentGoalId,
              level,
              title: String(body.title ?? ''),
              targetMetric:
                ['life', 'monthly', 'weekly'].includes(level) &&
                body.targetMetric
                  ? String(body.targetMetric)
                  : null,
              targetDescription:
                ['life', 'monthly'].includes(level) &&
                (body.definitionOfDone ?? body.targetDescription)
                  ? String(body.definitionOfDone ?? body.targetDescription)
                  : null,
              definitionOfDone:
                ['life', 'monthly'].includes(level) &&
                (body.definitionOfDone ?? body.targetDescription)
                  ? String(body.definitionOfDone ?? body.targetDescription)
                  : null,
              whyThisMatters:
                level === 'life' && body.whyThisMatters
                  ? String(body.whyThisMatters)
                  : null,
              targetDate: body.targetDate
                ? dateOnly(String(body.targetDate))
                : level === 'daily'
                  ? t
                  : level === 'weekly'
                    ? ws
                    : null,
            },
          }),
        );
      }
      case 'goal.update': {
        const existing = await this.prisma.goal.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        return toJson(
          await this.prisma.goal.update({
            where: { id: existing.id },
            data: {
              title: String(body.title ?? ''),
              targetMetric:
                ['life', 'monthly', 'weekly'].includes(existing.level) &&
                body.targetMetric
                  ? String(body.targetMetric)
                  : null,
              targetDescription:
                ['life', 'monthly'].includes(existing.level) &&
                (body.definitionOfDone ?? body.targetDescription)
                  ? String(body.definitionOfDone ?? body.targetDescription)
                  : null,
              definitionOfDone:
                ['life', 'monthly'].includes(existing.level) &&
                (body.definitionOfDone ?? body.targetDescription)
                  ? String(body.definitionOfDone ?? body.targetDescription)
                  : null,
              whyThisMatters:
                existing.level === 'life' && body.whyThisMatters
                  ? String(body.whyThisMatters)
                  : null,
              targetDate:
                ['life', 'monthly', 'daily'].includes(existing.level) &&
                body.targetDate
                  ? dateOnly(String(body.targetDate))
                  : existing.level === 'daily'
                    ? existing.targetDate
                    : existing.level === 'weekly'
                      ? existing.targetDate
                      : null,
            },
          }),
        );
      }
      case 'goal.toggle': {
        const goal = await this.prisma.goal.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        if (!['daily', 'weekly'].includes(goal.level)) return toJson(goal);
        if (!goal.completed)
          await this.awardXp(
            userId,
            goal.level === 'daily' ? 'goal' : 'weekly_goal',
            goal.level === 'daily' ? 5 : 10,
          );
        return toJson(
          await this.prisma.goal.update({
            where: { id: goal.id },
            data: { completed: !goal.completed },
          }),
        );
      }
      case 'goal.delete':
        return toJson(
          await this.prisma.goal.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'goal.restore':
        return toJson(
          await this.prisma.goal.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'focusCycle.save': {
        const cycleLengthDays = Math.max(
          1,
          asNumber(body.cycleLengthDays, DEFAULT_CYCLE_LENGTH_DAYS),
        );
        const focusAreas = this.normalizeFocusAreas(body.focusAreas);
        const focusGoalId = body.focusGoalId ? String(body.focusGoalId) : null;
        if (focusGoalId) {
          await this.prisma.goal.findFirstOrThrow({
            where: active({ id: focusGoalId, userId, level: 'life' }),
          });
        }
        const cycle = await this.currentFocusCycle(userId, t);
        return toJson(
          await this.prisma.focusCycle.update({
            where: { id: cycle.id },
            data: {
              cycleLengthDays,
              focusAreas: focusAreas.length ? focusAreas : cycle.focusAreas,
              focusGoalId,
              endDate: cycleEnd(cycle.startDate, cycleLengthDays),
            },
          }),
        );
      }
      case 'focusCycle.start': {
        const cycleLengthDays = Math.max(
          1,
          asNumber(body.cycleLengthDays, DEFAULT_CYCLE_LENGTH_DAYS),
        );
        const focusAreas = this.normalizeFocusAreas(body.focusAreas);
        const focusGoalId = body.focusGoalId ? String(body.focusGoalId) : null;
        if (focusGoalId) {
          await this.prisma.goal.findFirstOrThrow({
            where: active({ id: focusGoalId, userId, level: 'life' }),
          });
        }
        await this.prisma.focusCycle.updateMany({
          where: { userId, completedAt: null },
          data: { completedAt: new Date() },
        });
        return toJson(
          await this.prisma.focusCycle.create({
            data: {
              userId,
              startDate: t,
              endDate: cycleEnd(t, cycleLengthDays),
              cycleLengthDays,
              focusAreas: focusAreas.length ? focusAreas : DEFAULT_FOCUS_AREAS,
              focusGoalId,
            },
          }),
        );
      }
      case 'weeklyReflection.save': {
        const reflectionWeekStart = body.weekStart
          ? dateOnly(String(body.weekStart))
          : ws;
        const thieves = Array.isArray(body.oneThingThieves)
          ? body.oneThingThieves.map((item) => String(item)).filter(Boolean)
          : [];
        return toJson(
          await this.prisma.weeklyReflection.upsert({
            where: {
              userId_weekStart: { userId, weekStart: reflectionWeekStart },
            },
            update: {
              oneThingThieves: thieves,
              oneThingReflection: body.oneThingReflection
                ? String(body.oneThingReflection)
                : null,
            },
            create: {
              userId,
              weekStart: reflectionWeekStart,
              oneThingThieves: thieves,
              oneThingReflection: body.oneThingReflection
                ? String(body.oneThingReflection)
                : null,
            },
          }),
        );
      }
      case 'routine.add': {
        const linkedGoalId = body.linkedGoalId
          ? String(body.linkedGoalId)
          : null;
        if (linkedGoalId) {
          await this.prisma.goal.findFirstOrThrow({
            where: active({ id: linkedGoalId, userId }),
          });
        }
        return toJson(
          await this.prisma.routine.create({
            data: {
              userId,
              name: String(body.name ?? ''),
              timeAnchor: body.timeAnchor ? String(body.timeAnchor) : null,
              linkedGoalId,
              protected: body.protected === true || body.protected === 'true',
            },
          }),
        );
      }
      case 'routine.update': {
        const linkedGoalId = body.linkedGoalId
          ? String(body.linkedGoalId)
          : null;
        if (linkedGoalId) {
          await this.prisma.goal.findFirstOrThrow({
            where: active({ id: linkedGoalId, userId }),
          });
        }
        return toJson(
          await this.prisma.routine.update({
            where: { id: String(body.id) },
            data: {
              name: String(body.name ?? ''),
              timeAnchor: body.timeAnchor ? String(body.timeAnchor) : null,
              linkedGoalId,
              protected:
                body.protected === undefined
                  ? undefined
                  : body.protected === true || body.protected === 'true',
            },
          }),
        );
      }
      case 'routine.delete':
        return toJson(
          await this.prisma.routine.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'routine.restore':
        return toJson(
          await this.prisma.routine.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'routineStep.add': {
        const routineId = String(body.routineId);
        await this.prisma.routine.findFirstOrThrow({
          where: active({ id: routineId, userId }),
        });
        const stepType = checkedRoutineStepType(body.stepType);
        const maxStep = await this.prisma.routineStep.findFirst({
          where: active({ routineId, userId }),
          orderBy: { orderIndex: 'desc' },
        });
        const linkData = await this.routineStepLinkData(userId, stepType, body);
        return toJson(
          await this.prisma.routineStep.create({
            data: {
              userId,
              routineId,
              orderIndex: maxStep ? maxStep.orderIndex + 1 : 0,
              stepName: String(body.stepName ?? ''),
              stepType,
              ...linkData,
            },
          }),
        );
      }
      case 'routineStep.update': {
        const existing = await this.prisma.routineStep.findFirstOrThrow({
          where: active({ id: String(body.id), userId }),
        });
        const stepType = checkedRoutineStepType(
          body.stepType ?? existing.stepType,
        );
        const linkData = await this.routineStepLinkData(userId, stepType, body);
        return toJson(
          await this.prisma.routineStep.update({
            where: { id: existing.id },
            data: {
              stepName: String(body.stepName ?? existing.stepName),
              stepType,
              ...linkData,
            },
          }),
        );
      }
      case 'routineStep.delete':
        return toJson(
          await this.prisma.routineStep.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'routineStep.restore':
        return toJson(
          await this.prisma.routineStep.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'routineStep.move': {
        const step = await this.prisma.routineStep.findFirstOrThrow({
          where: active({ id: String(body.id), userId }),
        });
        const direction =
          String(body.direction ?? 'down') === 'up' ? 'up' : 'down';
        const sibling = await this.prisma.routineStep.findFirst({
          where: active({
            userId,
            routineId: step.routineId,
            orderIndex:
              direction === 'up'
                ? { lt: step.orderIndex }
                : { gt: step.orderIndex },
          }),
          orderBy: { orderIndex: direction === 'up' ? 'desc' : 'asc' },
        });
        if (!sibling) return toJson(step);
        await this.prisma.$transaction([
          this.prisma.routineStep.update({
            where: { id: step.id },
            data: { orderIndex: sibling.orderIndex },
          }),
          this.prisma.routineStep.update({
            where: { id: sibling.id },
            data: { orderIndex: step.orderIndex },
          }),
        ]);
        return { ok: true };
      }
      case 'routineStep.toggle': {
        const step = await this.prisma.routineStep.findFirstOrThrow({
          where: active({ id: String(body.id), userId }),
        });
        const stepType = checkedRoutineStepType(step.stepType);
        if (stepType === 'standalone') {
          const existing = await this.prisma.routineStepCompletion.findUnique({
            where: {
              routineStepId_completedOn: {
                routineStepId: step.id,
                completedOn: t,
              },
            },
          });
          if (existing) {
            await this.prisma.routineStepCompletion.delete({
              where: { id: existing.id },
            });
            return { ok: true, completed: false };
          }
          await this.prisma.routineStepCompletion.create({
            data: { userId, routineStepId: step.id, completedOn: t },
          });
          return { ok: true, completed: true };
        }
        if (stepType === 'habit' && step.linkedHabitId) {
          const habit = await this.prisma.habit.findFirstOrThrow({
            where: { id: step.linkedHabitId, userId },
          });
          if (habit.lastCheckin && sameDate(habit.lastCheckin, t))
            return toJson(habit);
          const last = habit.lastCheckin ? dateOnly(habit.lastCheckin) : null;
          const diff = last
            ? Math.round((t.getTime() - last.getTime()) / 86400000)
            : 999;
          const streak = diff === 1 ? habit.currentStreak + 1 : 1;
          await this.awardXp(userId, 'habit', 5);
          return toJson(
            await this.prisma.habit.update({
              where: { id: habit.id },
              data: {
                currentStreak: streak,
                longestStreak: Math.max(habit.longestStreak, streak),
                lastCheckin: t,
              },
            }),
          );
        }
        if (
          (stepType === 'daily_goal' || stepType === 'weekly_goal') &&
          (step.linkedDailyGoalId || step.linkedWeeklyGoalId)
        ) {
          const goalId =
            stepType === 'daily_goal'
              ? step.linkedDailyGoalId
              : step.linkedWeeklyGoalId;
          const goal = await this.prisma.goal.findFirstOrThrow({
            where: { id: goalId ?? '', userId },
          });
          if (!goal.completed)
            await this.awardXp(
              userId,
              stepType === 'daily_goal' ? 'goal' : 'weekly_goal',
              stepType === 'daily_goal' ? 5 : 10,
            );
          return toJson(
            await this.prisma.goal.update({
              where: { id: goal.id },
              data: { completed: !goal.completed },
            }),
          );
        }
        return { ok: false, readOnly: true };
      }
      case 'debt.add': {
        const amount = asNumber(body.amount);
        const debt = await this.prisma.debt.create({
          data: {
            userId,
            linkedGoalId: body.linkedGoalId ? String(body.linkedGoalId) : null,
            name: String(body.name ?? ''),
            type: String(body.loanType ?? body.type ?? 'other'),
            principal: amount,
            balance: amount,
            interestRate: asNumber(body.interestRate),
            tenureMonths: body.tenureMonths
              ? asNumber(body.tenureMonths)
              : null,
            emiAmount: body.emiAmount ? asNumber(body.emiAmount) : null,
            dueDay: body.dueDay ? asNumber(body.dueDay, 1) : null,
          },
        });
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(debt);
      }
      case 'debt.delete': {
        const debt = await this.prisma.debt.update({
          where: { id: String(body.id) },
          data: { deletedAt: new Date() },
        });
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(debt);
      }
      case 'debt.update': {
        const debt = await this.prisma.debt.update({
          where: { id: String(body.id) },
          data: {
            name: String(body.name ?? ''),
            linkedGoalId: body.linkedGoalId ? String(body.linkedGoalId) : null,
            type: String(body.loanType ?? body.type ?? 'other'),
            principal:
              body.principal == null ? undefined : asNumber(body.principal),
            balance: body.balance == null ? undefined : asNumber(body.balance),
            interestRate: asNumber(body.interestRate),
            tenureMonths: body.tenureMonths
              ? asNumber(body.tenureMonths)
              : null,
            emiAmount: body.emiAmount ? asNumber(body.emiAmount) : null,
            dueDay: body.dueDay ? asNumber(body.dueDay, 1) : null,
          },
        });
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(debt);
      }
      case 'debt.restore': {
        const debt = await this.prisma.debt.update({
          where: { id: String(body.id) },
          data: { deletedAt: null },
        });
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(debt);
      }
      case 'debt.pay': {
        const debtId = String(body.debtId);
        const amount = asNumber(body.amount);
        const debt = await this.prisma.debt.findFirstOrThrow({
          where: { id: debtId, userId, deletedAt: null },
        });
        const payment = applyPrincipalPayment(Number(debt.balance), amount);
        await this.prisma.$transaction(async (tx) => {
          const debtPayment = await tx.debtPayment.create({
            data: {
              userId,
              debtId,
              amount: payment.amount,
              kind: 'extra',
              interestPortion: payment.interestPortion,
              principalPortion: payment.principalPortion,
              resultingBalance: payment.resultingBalance,
            },
          });
          await tx.debt.update({
            where: { id: debtId },
            data: { balance: payment.resultingBalance },
          });
          await tx.financeTransaction.create({
            data: {
              userId,
              transactionDate: t,
              type: 'debt_payment',
              amount: payment.amount,
              category: 'Debt',
              note: 'Logged from debt payment form',
              linkedDebtId: debtId,
              debtPaymentId: debtPayment.id,
            },
          });
        });
        await this.awardXp(userId, 'debt_payment', 15);
        await this.recordNetWorthSnapshot(userId, t);
        return { ok: true };
      }
      case 'debtPayment.delete': {
        const payment = await this.prisma.debtPayment.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        await this.prisma.$transaction([
          this.prisma.debtPayment.update({
            where: { id: payment.id },
            data: { deletedAt: new Date() },
          }),
          this.prisma.debt.update({
            where: { id: payment.debtId },
            data: { balance: { increment: payment.principalPortion } },
          }),
          this.prisma.financeTransaction.updateMany({
            where: { userId, debtPaymentId: payment.id },
            data: { deletedAt: new Date() },
          }),
        ]);
        await this.recordNetWorthSnapshot(userId, t);
        return { ok: true };
      }
      case 'debtPayment.restore': {
        const payment = await this.prisma.debtPayment.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        await this.prisma.$transaction([
          this.prisma.debtPayment.update({
            where: { id: payment.id },
            data: { deletedAt: null },
          }),
          this.prisma.debt.update({
            where: { id: payment.debtId },
            data: { balance: { decrement: payment.principalPortion } },
          }),
          this.prisma.financeTransaction.updateMany({
            where: { userId, debtPaymentId: payment.id },
            data: { deletedAt: null },
          }),
        ]);
        await this.recordNetWorthSnapshot(userId, t);
        return { ok: true };
      }
      case 'income.add':
        return toJson(
          await this.prisma.incomeSource.create({
            data: {
              userId,
              name: String(body.name ?? ''),
              amount: asNumber(body.amount),
              frequency: String(body.frequency ?? 'monthly'),
            },
          }),
        );
      case 'income.update':
        return toJson(
          await this.prisma.incomeSource.update({
            where: { id: String(body.id) },
            data: {
              name: String(body.name ?? ''),
              amount: asNumber(body.amount),
              frequency: String(body.frequency ?? 'monthly'),
            },
          }),
        );
      case 'income.delete':
        return toJson(
          await this.prisma.incomeSource.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'income.restore':
        return toJson(
          await this.prisma.incomeSource.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'asset.add': {
        const asset = await this.prisma.asset.create({
          data: {
            userId,
            name: String(body.name ?? ''),
            type: String(body.type ?? 'other'),
            currentValue: asNumber(body.currentValue),
          },
        });
        await this.recordAssetSnapshot(
          userId,
          asset.id,
          Number(asset.currentValue),
          t,
        );
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(asset);
      }
      case 'asset.update': {
        const asset = await this.prisma.asset.update({
          where: { id: String(body.id) },
          data: {
            name: String(body.name ?? ''),
            type: String(body.type ?? 'other'),
            currentValue: asNumber(body.currentValue),
          },
        });
        await this.recordAssetSnapshot(
          userId,
          asset.id,
          Number(asset.currentValue),
          t,
        );
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(asset);
      }
      case 'asset.delete': {
        const asset = await this.prisma.asset.update({
          where: { id: String(body.id) },
          data: { deletedAt: new Date() },
        });
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(asset);
      }
      case 'asset.restore': {
        const asset = await this.prisma.asset.update({
          where: { id: String(body.id) },
          data: { deletedAt: null },
        });
        await this.recordAssetSnapshot(
          userId,
          asset.id,
          Number(asset.currentValue),
          t,
        );
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(asset);
      }
      case 'savings.save':
        return toJson(
          await this.prisma.savings.upsert({
            where: { userId },
            update: {
              balance:
                body.balance == null ? undefined : asNumber(body.balance),
              goalAmount:
                body.goalAmount == null || body.goalAmount === ''
                  ? null
                  : asNumber(body.goalAmount),
              linkedGoalId: body.linkedGoalId
                ? String(body.linkedGoalId)
                : null,
            },
            create: {
              userId,
              balance: asNumber(body.balance),
              goalAmount:
                body.goalAmount == null || body.goalAmount === ''
                  ? null
                  : asNumber(body.goalAmount),
              linkedGoalId: body.linkedGoalId
                ? String(body.linkedGoalId)
                : null,
            },
          }),
        );
      case 'transaction.add': {
        const transactionDate =
          body.date || body.transactionDate
            ? dateOnly(String(body.date ?? body.transactionDate))
            : t;
        const transactionType = checkedTransactionType(
          body.transactionType ?? body.type,
        );
        const amount = asNumber(body.amount);
        const category = String(
          body.category ??
            (transactionType === 'debt_payment' ? 'Debt' : 'Other'),
        );
        const note = body.note ? String(body.note) : null;

        if (transactionType !== 'debt_payment') {
          return toJson(
            await this.prisma.financeTransaction.create({
              data: {
                userId,
                transactionDate,
                type: transactionType,
                amount,
                category,
                note,
              },
            }),
          );
        }

        const linkedDebtId = body.linkedDebtId ? String(body.linkedDebtId) : '';
        if (!linkedDebtId)
          throw new BadRequestException(
            'Debt payment transactions require a linked debt.',
          );
        const result = await this.prisma.$transaction(async (tx) => {
          const debt = await tx.debt.findFirstOrThrow({
            where: { id: linkedDebtId, userId, deletedAt: null },
          });
          const payment = applyPrincipalPayment(Number(debt.balance), amount);
          const debtPayment = await tx.debtPayment.create({
            data: {
              userId,
              debtId: linkedDebtId,
              amount: payment.amount,
              kind: 'extra',
              interestPortion: payment.interestPortion,
              principalPortion: payment.principalPortion,
              resultingBalance: payment.resultingBalance,
              paidOn: transactionDate,
            },
          });
          await tx.debt.update({
            where: { id: linkedDebtId },
            data: { balance: payment.resultingBalance },
          });
          return tx.financeTransaction.create({
            data: {
              userId,
              transactionDate,
              type: transactionType,
              amount: payment.amount,
              category,
              note,
              linkedDebtId,
              debtPaymentId: debtPayment.id,
            },
          });
        });
        await this.awardXp(userId, 'debt_payment', 15);
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(result);
      }
      case 'transaction.update': {
        const existing = await this.prisma.financeTransaction.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        const transactionDate =
          body.date || body.transactionDate
            ? dateOnly(String(body.date ?? body.transactionDate))
            : existing.transactionDate;
        const transactionType = checkedTransactionType(
          body.transactionType ?? body.type ?? existing.type,
        );
        const amount =
          body.amount == null ? Number(existing.amount) : asNumber(body.amount);
        const category = String(body.category ?? existing.category ?? 'Other');
        const note =
          body.note == null ? existing.note : String(body.note || '');
        const nextLinkedDebtId = body.linkedDebtId
          ? String(body.linkedDebtId)
          : null;
        const result = await this.prisma.$transaction(async (tx) => {
          if (existing.type === 'debt_payment' && existing.debtPaymentId) {
            const oldPayment = await tx.debtPayment.findFirst({
              where: { id: existing.debtPaymentId, userId },
            });
            if (oldPayment && !oldPayment.deletedAt) {
              await tx.debtPayment.update({
                where: { id: oldPayment.id },
                data: { deletedAt: new Date() },
              });
              await tx.debt.update({
                where: { id: oldPayment.debtId },
                data: { balance: { increment: oldPayment.principalPortion } },
              });
            }
          }

          if (transactionType !== 'debt_payment') {
            return tx.financeTransaction.update({
              where: { id: existing.id },
              data: {
                transactionDate,
                type: transactionType,
                amount,
                category,
                note,
                linkedDebtId: null,
                debtPaymentId: null,
                deletedAt: null,
              },
            });
          }

          if (!nextLinkedDebtId)
            throw new BadRequestException(
              'Debt payment transactions require a linked debt.',
            );
          const debt = await tx.debt.findFirstOrThrow({
            where: { id: nextLinkedDebtId, userId, deletedAt: null },
          });
          const payment = applyPrincipalPayment(Number(debt.balance), amount);
          const debtPayment = await tx.debtPayment.create({
            data: {
              userId,
              debtId: nextLinkedDebtId,
              amount: payment.amount,
              kind: 'extra',
              interestPortion: payment.interestPortion,
              principalPortion: payment.principalPortion,
              resultingBalance: payment.resultingBalance,
              paidOn: transactionDate,
            },
          });
          await tx.debt.update({
            where: { id: nextLinkedDebtId },
            data: { balance: payment.resultingBalance },
          });
          return tx.financeTransaction.update({
            where: { id: existing.id },
            data: {
              transactionDate,
              type: transactionType,
              amount: payment.amount,
              category,
              note,
              linkedDebtId: nextLinkedDebtId,
              debtPaymentId: debtPayment.id,
              deletedAt: null,
            },
          });
        });
        if (
          existing.type === 'debt_payment' ||
          transactionType === 'debt_payment'
        )
          await this.recordNetWorthSnapshot(userId, t);
        return toJson(result);
      }
      case 'transaction.delete': {
        const existing = await this.prisma.financeTransaction.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        await this.prisma.$transaction(async (tx) => {
          await tx.financeTransaction.update({
            where: { id: existing.id },
            data: { deletedAt: new Date() },
          });
          if (existing.type === 'debt_payment' && existing.debtPaymentId) {
            const payment = await tx.debtPayment.findFirst({
              where: { id: existing.debtPaymentId, userId },
            });
            if (payment && !payment.deletedAt) {
              await tx.debtPayment.update({
                where: { id: payment.id },
                data: { deletedAt: new Date() },
              });
              await tx.debt.update({
                where: { id: payment.debtId },
                data: { balance: { increment: payment.principalPortion } },
              });
            }
          }
        });
        if (existing.type === 'debt_payment')
          await this.recordNetWorthSnapshot(userId, t);
        return { ok: true };
      }
      case 'transaction.restore': {
        const existing = await this.prisma.financeTransaction.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        await this.prisma.$transaction(async (tx) => {
          if (existing.type === 'debt_payment' && existing.debtPaymentId) {
            const payment = await tx.debtPayment.findFirst({
              where: { id: existing.debtPaymentId, userId },
            });
            if (payment && payment.deletedAt) {
              await tx.debtPayment.update({
                where: { id: payment.id },
                data: { deletedAt: null },
              });
              await tx.debt.update({
                where: { id: payment.debtId },
                data: { balance: { decrement: payment.principalPortion } },
              });
            }
          }
          await tx.financeTransaction.update({
            where: { id: existing.id },
            data: { deletedAt: null },
          });
        });
        if (existing.type === 'debt_payment')
          await this.recordNetWorthSnapshot(userId, t);
        return { ok: true };
      }
      case 'financeMonth.save':
        return toJson(
          await this.prisma.financeMonth.upsert({
            where: {
              userId_month: { userId, month: dateOnly(String(body.month)) },
            },
            update: {
              income: asNumber(body.income),
              expenses: asNumber(body.expenses),
              debtPaid: asNumber(body.debtPaid),
              deletedAt: null,
            },
            create: {
              userId,
              month: dateOnly(String(body.month)),
              income: asNumber(body.income),
              expenses: asNumber(body.expenses),
              debtPaid: asNumber(body.debtPaid),
            },
          }),
        );
      case 'financeMonth.update':
        return toJson(
          await this.prisma.financeMonth.update({
            where: { id: String(body.id) },
            data: {
              income: asNumber(body.income),
              expenses: asNumber(body.expenses),
              debtPaid: asNumber(body.debtPaid),
            },
          }),
        );
      case 'financeMonth.delete':
        return toJson(
          await this.prisma.financeMonth.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'financeMonth.restore':
        return toJson(
          await this.prisma.financeMonth.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'weight.add':
        await this.awardXp(userId, 'weight', 5);
        return toJson(
          await this.prisma.weightLog.create({
            data: { userId, logDate: t, weight: asNumber(body.weight) },
          }),
        );
      case 'weight.update':
        return toJson(
          await this.prisma.weightLog.update({
            where: { id: String(body.id) },
            data: { weight: asNumber(body.weight) },
          }),
        );
      case 'weight.delete':
        return toJson(
          await this.prisma.weightLog.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'weight.restore':
        return toJson(
          await this.prisma.weightLog.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'profile.goalWeight':
        return toJson(
          await this.prisma.profile.update({
            where: { id: userId },
            data: { goalWeight: asNumber(body.goalWeight) },
          }),
        );
      case 'diet.save': {
        const existing = await this.prisma.dietLog.findUnique({
          where: { userId_logDate: { userId, logDate: t } },
        });
        const diet = await this.prisma.dietLog.upsert({
          where: { userId_logDate: { userId, logDate: t } },
          update: {
            calories: asNumber(body.calories),
            protein: asNumber(body.protein),
            deletedAt: null,
          },
          create: {
            userId,
            logDate: t,
            calories: asNumber(body.calories),
            protein: asNumber(body.protein),
          },
        });
        if (!existing) await this.awardXp(userId, 'diet', 5);
        return toJson(diet);
      }
      case 'diet.update':
        return toJson(
          await this.prisma.dietLog.update({
            where: { id: String(body.id) },
            data: {
              calories: asNumber(body.calories),
              protein: asNumber(body.protein),
            },
          }),
        );
      case 'diet.delete':
        return toJson(
          await this.prisma.dietLog.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'diet.restore':
        return toJson(
          await this.prisma.dietLog.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'workout.add':
        await this.awardXp(userId, 'workout', 10);
        return toJson(
          await this.prisma.workoutLog.create({
            data: {
              userId,
              logDate: t,
              exercise: String(body.exercise ?? ''),
              sets: asNumber(body.sets),
              reps: asNumber(body.reps),
              weight: asNumber(body.weight),
            },
          }),
        );
      case 'workout.update':
        return toJson(
          await this.prisma.workoutLog.update({
            where: { id: String(body.id) },
            data: {
              exercise: String(body.exercise ?? ''),
              sets: asNumber(body.sets),
              reps: asNumber(body.reps),
              weight: asNumber(body.weight),
            },
          }),
        );
      case 'workout.delete':
        return toJson(
          await this.prisma.workoutLog.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'workout.restore':
        return toJson(
          await this.prisma.workoutLog.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'sleep.add':
        await this.awardXp(userId, 'sleep', 5);
        return toJson(
          await this.prisma.sleepLog.create({
            data: {
              userId,
              logDate: body.logDate ? dateOnly(String(body.logDate)) : t,
              hours: asNumber(body.hours),
              quality: asNumber(body.quality, 3),
            },
          }),
        );
      case 'sleep.update':
        return toJson(
          await this.prisma.sleepLog.update({
            where: { id: String(body.id) },
            data: {
              hours: asNumber(body.hours),
              quality: asNumber(body.quality, 3),
              logDate: body.logDate
                ? dateOnly(String(body.logDate))
                : undefined,
            },
          }),
        );
      case 'sleep.delete':
        return toJson(
          await this.prisma.sleepLog.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'sleep.restore':
        return toJson(
          await this.prisma.sleepLog.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'habit.add':
        return toJson(
          await this.prisma.habit.create({
            data: {
              userId,
              linkedGoalId: body.linkedGoalId
                ? String(body.linkedGoalId)
                : null,
              name: String(body.name ?? ''),
              kind: String(body.kind ?? 'build'),
              whyThisMatters: body.whyThisMatters
                ? String(body.whyThisMatters)
                : null,
              lastSlip: body.kind === 'break' ? t : null,
            },
          }),
        );
      case 'habit.update':
        return toJson(
          await this.prisma.habit.update({
            where: { id: String(body.id) },
            data: {
              name: String(body.name ?? ''),
              kind: String(body.kind ?? 'build'),
              linkedGoalId: body.linkedGoalId
                ? String(body.linkedGoalId)
                : null,
              whyThisMatters:
                body.whyThisMatters === undefined
                  ? undefined
                  : body.whyThisMatters == null || body.whyThisMatters === ''
                    ? null
                    : String(body.whyThisMatters),
            },
          }),
        );
      case 'habit.checkin': {
        const habit = await this.prisma.habit.findFirstOrThrow({
          where: { id: String(body.id), userId },
        });
        const last = habit.lastCheckin ? dateOnly(habit.lastCheckin) : null;
        const diff = last
          ? Math.round((t.getTime() - last.getTime()) / 86400000)
          : 999;
        const streak = diff === 1 ? habit.currentStreak + 1 : 1;
        await this.awardXp(userId, 'habit', 5);
        return toJson(
          await this.prisma.habit.update({
            where: { id: habit.id },
            data: {
              currentStreak: streak,
              longestStreak: Math.max(habit.longestStreak, streak),
              lastCheckin: t,
            },
          }),
        );
      }
      case 'habit.slip':
        return toJson(
          await this.prisma.habit.update({
            where: { id: String(body.id) },
            data: { currentStreak: 0, lastSlip: t },
          }),
        );
      case 'habit.delete':
        return toJson(
          await this.prisma.habit.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'habit.restore':
        return toJson(
          await this.prisma.habit.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'relationship.add':
        return toJson(
          await this.prisma.relationshipCheckin.create({
            data: {
              userId,
              weekStart: ws,
              personName: String(body.personName ?? ''),
              category: String(body.category ?? 'Friend'),
              rating: asNumber(body.rating, 3),
              note: body.note ? String(body.note) : null,
            },
          }),
        );
      case 'relationship.update':
        return toJson(
          await this.prisma.relationshipCheckin.update({
            where: { id: String(body.id) },
            data: {
              personName: String(body.personName ?? ''),
              category: String(body.category ?? 'Friend'),
              rating: asNumber(body.rating, 3),
              note: body.note ? String(body.note) : null,
            },
          }),
        );
      case 'relationship.delete':
        return toJson(
          await this.prisma.relationshipCheckin.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'relationship.restore':
        return toJson(
          await this.prisma.relationshipCheckin.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'importantDate.add':
        return toJson(
          await this.prisma.importantDate.create({
            data: {
              userId,
              personName: String(body.personName ?? ''),
              kind: String(body.kind ?? ''),
              date: dateOnly(String(body.date)),
            },
          }),
        );
      case 'importantDate.update':
        return toJson(
          await this.prisma.importantDate.update({
            where: { id: String(body.id) },
            data: {
              personName: String(body.personName ?? ''),
              kind: String(body.kind ?? ''),
              date: dateOnly(String(body.date)),
            },
          }),
        );
      case 'importantDate.delete':
        return toJson(
          await this.prisma.importantDate.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'importantDate.restore':
        return toJson(
          await this.prisma.importantDate.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'skill.add':
        return toJson(
          await this.prisma.skill.create({
            data: {
              userId,
              name: String(body.name ?? ''),
              linkedGoalId: body.linkedGoalId
                ? String(body.linkedGoalId)
                : null,
              targetDate: body.targetDate
                ? dateOnly(String(body.targetDate))
                : null,
              status: checkedSkillStage(body.status),
            },
          }),
        );
      case 'skill.update':
        return toJson(
          await this.prisma.skill.update({
            where: { id: String(body.id) },
            data: {
              name: String(body.name ?? ''),
              linkedGoalId: body.linkedGoalId
                ? String(body.linkedGoalId)
                : null,
              targetDate: body.targetDate
                ? dateOnly(String(body.targetDate))
                : null,
              status:
                body.status == null
                  ? undefined
                  : checkedSkillStage(body.status),
            },
          }),
        );
      case 'skill.delete':
        return toJson(
          await this.prisma.skill.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'skill.restore':
        return toJson(
          await this.prisma.skill.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      case 'learning.add':
        await this.awardXp(userId, 'learning', 10);
        return toJson(
          await this.prisma.learningSession.create({
            data: {
              userId,
              skillId: body.skillId ? String(body.skillId) : null,
              minutes: asNumber(body.minutes),
              notes: body.notes ? String(body.notes) : null,
              logDate: t,
            },
          }),
        );
      case 'learning.update':
        return toJson(
          await this.prisma.learningSession.update({
            where: { id: String(body.id) },
            data: {
              skillId: body.skillId ? String(body.skillId) : null,
              minutes: asNumber(body.minutes),
              notes: body.notes ? String(body.notes) : null,
            },
          }),
        );
      case 'learning.delete':
        return toJson(
          await this.prisma.learningSession.update({
            where: { id: String(body.id) },
            data: { deletedAt: new Date() },
          }),
        );
      case 'learning.restore':
        return toJson(
          await this.prisma.learningSession.update({
            where: { id: String(body.id) },
            data: { deletedAt: null },
          }),
        );
      default:
        throw new BadRequestException(`Unknown ledger action: ${type}`);
    }
  }
}
