import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import {
  amortizePayment,
  applyPrincipalPayment,
  emiWarning,
} from './amortization';
import {
  computeCorrelationPatterns,
  type CorrelationPattern,
} from './correlation-engine';
import { computeFinanceSummary } from './finance-formulas';
import {
  canonicalizeLink,
  isEntityType,
  isRelationshipType,
  linkedPeers,
  type EntityLinkRecord,
  type EntityTypeValue,
  type RelationshipTypeValue,
} from './entity-linking';
import {
  suggestDebtTransactionLinks,
  suggestJournalLearningLinks,
} from './entity-link-suggestions';
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
type LedgerDb = PrismaService | Prisma.TransactionClient;

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

  private invalidatePatternCache(userId: string) {
    for (const key of this.patternCache.keys()) {
      if (key.startsWith(`${userId}:`)) this.patternCache.delete(key);
    }
  }

  private checkedEntityType(value: unknown): EntityTypeValue {
    if (!isEntityType(value)) {
      throw new BadRequestException(
        `Unsupported entity type: ${String(value)}`,
      );
    }
    return value;
  }

  private checkedRelationshipType(value: unknown): RelationshipTypeValue {
    const relationship = value ?? 'linked';
    if (!isRelationshipType(relationship)) {
      throw new BadRequestException(
        `Unsupported relationship type: ${String(relationship)}`,
      );
    }
    return relationship;
  }

  private async assertEntityOwned(
    userId: string,
    type: EntityTypeValue,
    id: string,
    db: LedgerDb = this.prisma,
  ) {
    let entity: unknown = null;
    switch (type) {
      case 'goal':
        entity = await db.goal.findFirst({ where: active({ id, userId }) });
        break;
      case 'habit':
        entity = await db.habit.findFirst({ where: active({ id, userId }) });
        break;
      case 'routine':
        entity = await db.routine.findFirst({ where: active({ id, userId }) });
        break;
      case 'routine_step':
        entity = await db.routineStep.findFirst({
          where: active({ id, userId }),
        });
        break;
      case 'learning_skill':
        entity = await db.skill.findFirst({ where: active({ id, userId }) });
        break;
      case 'finance_debt':
        entity = await db.debt.findFirst({ where: active({ id, userId }) });
        break;
      case 'finance_savings':
        entity =
          id === userId
            ? await db.savings.findUnique({ where: { userId } })
            : null;
        break;
      case 'finance_transaction':
        entity = await db.financeTransaction.findFirst({
          where: active({ id, userId }),
        });
        break;
      case 'journal_entry':
        entity = await db.journalEntry.findFirst({
          where: active({ id, userId }),
        });
        break;
    }
    if (!entity) {
      throw new BadRequestException(
        `${type.replaceAll('_', ' ')} does not exist for this user.`,
      );
    }
  }

  private async upsertEntityLink(
    userId: string,
    leftType: EntityTypeValue,
    leftId: string,
    rightType: EntityTypeValue,
    rightId: string,
    relationshipType: RelationshipTypeValue = 'linked',
    db: LedgerDb = this.prisma,
  ) {
    await Promise.all([
      this.assertEntityOwned(userId, leftType, leftId, db),
      this.assertEntityOwned(userId, rightType, rightId, db),
    ]);
    let canonical;
    try {
      canonical = canonicalizeLink(
        { type: leftType, id: leftId },
        { type: rightType, id: rightId },
      );
    } catch {
      throw new BadRequestException('An entity cannot be linked to itself.');
    }
    return db.entityLink.upsert({
      where: {
        userId_sourceType_sourceId_targetType_targetId: {
          userId,
          ...canonical,
        },
      },
      update: { relationshipType },
      create: {
        userId,
        ...canonical,
        relationshipType,
      },
    });
  }

  private async deleteEntityLinksFor(
    userId: string,
    type: EntityTypeValue,
    id: string,
    relationshipType?: RelationshipTypeValue,
    db: LedgerDb = this.prisma,
  ) {
    return db.entityLink.deleteMany({
      where: {
        userId,
        ...(relationshipType ? { relationshipType } : {}),
        OR: [
          { sourceType: type, sourceId: id },
          { targetType: type, targetId: id },
        ],
      },
    });
  }

  private async deleteEntityLinksBetweenTypes(
    userId: string,
    type: EntityTypeValue,
    id: string,
    peerType: EntityTypeValue,
    db: LedgerDb = this.prisma,
  ) {
    return db.entityLink.deleteMany({
      where: {
        userId,
        OR: [
          {
            sourceType: type,
            sourceId: id,
            targetType: peerType,
          },
          {
            targetType: type,
            targetId: id,
            sourceType: peerType,
          },
        ],
      },
    });
  }

  private expectedRoutineStepTargetType(
    stepType: RoutineStepTypeValue,
  ): EntityTypeValue | null {
    if (stepType === 'habit') return 'habit';
    if (stepType === 'daily_goal' || stepType === 'weekly_goal') return 'goal';
    if (stepType === 'learning') return 'learning_skill';
    return null;
  }

  private async assertRoutineStepTarget(
    userId: string,
    stepType: RoutineStepTypeValue,
    targetType: EntityTypeValue,
    targetId: string,
    db: LedgerDb = this.prisma,
  ) {
    const expectedTargetType = this.expectedRoutineStepTargetType(stepType);
    if (!expectedTargetType || targetType !== expectedTargetType) {
      throw new BadRequestException(
        `${stepType.replaceAll('_', ' ')} steps require ${expectedTargetType?.replaceAll('_', ' ') ?? 'no'} target.`,
      );
    }
    await this.assertEntityOwned(userId, targetType, targetId, db);
    if (targetType === 'goal') {
      const goal = await db.goal.findFirstOrThrow({
        where: active({ id: targetId, userId }),
      });
      const expectedLevel = stepType === 'daily_goal' ? 'daily' : 'weekly';
      if (goal.level !== expectedLevel) {
        throw new BadRequestException(
          `${stepType.replaceAll('_', ' ')} steps require a ${expectedLevel} goal.`,
        );
      }
    }
  }

  private isManagedRoutineTargetLink(link: {
    sourceType: string;
    targetType: string;
    relationshipType: string;
  }) {
    return (
      link.relationshipType === 'triggered_by' &&
      (link.sourceType === 'routine_step' || link.targetType === 'routine_step')
    );
  }

  private debtPaymentLinkEndpoints(link: EntityLinkRecord) {
    if (
      link.sourceType === 'finance_transaction' &&
      link.targetType === 'finance_debt'
    ) {
      return { transactionId: link.sourceId, debtId: link.targetId };
    }
    if (
      link.targetType === 'finance_transaction' &&
      link.sourceType === 'finance_debt'
    ) {
      return { transactionId: link.targetId, debtId: link.sourceId };
    }
    return null;
  }

  private async isManagedDebtPaymentLink(
    userId: string,
    link: EntityLinkRecord,
    db: LedgerDb = this.prisma,
  ) {
    const endpoints = this.debtPaymentLinkEndpoints(link);
    if (!endpoints) return false;
    const transaction = await db.financeTransaction.findFirst({
      where: { id: endpoints.transactionId, userId },
      include: { debtPayment: true },
    });
    return transaction?.debtPayment?.debtId === endpoints.debtId;
  }

  private endpointKey(type: string, id: string) {
    return `${type}:${id}`;
  }

  private filterLinksToActiveEndpoints<T extends EntityLinkRecord>(
    links: T[],
    activeEndpoints: Set<string>,
  ) {
    return links.filter(
      (link) =>
        activeEndpoints.has(
          this.endpointKey(link.sourceType, String(link.sourceId)),
        ) &&
        activeEndpoints.has(
          this.endpointKey(link.targetType, String(link.targetId)),
        ),
    );
  }

  private async activeEntityEndpointKeys(
    userId: string,
    db: LedgerDb = this.prisma,
  ) {
    const [
      goals,
      habits,
      routines,
      routineSteps,
      skills,
      debts,
      savings,
      transactions,
      journals,
    ] = await Promise.all([
      db.goal.findMany({ where: active({ userId }), select: { id: true } }),
      db.habit.findMany({ where: active({ userId }), select: { id: true } }),
      db.routine.findMany({ where: active({ userId }), select: { id: true } }),
      db.routineStep.findMany({
        where: active({ userId }),
        select: { id: true },
      }),
      db.skill.findMany({ where: active({ userId }), select: { id: true } }),
      db.debt.findMany({ where: active({ userId }), select: { id: true } }),
      db.savings.findMany({ where: { userId }, select: { userId: true } }),
      db.financeTransaction.findMany({
        where: active({ userId }),
        select: { id: true },
      }),
      db.journalEntry.findMany({
        where: active({ userId }),
        select: { id: true },
      }),
    ]);
    return new Set([
      ...goals.map((row: { id: string }) => this.endpointKey('goal', row.id)),
      ...habits.map((row: { id: string }) => this.endpointKey('habit', row.id)),
      ...routines.map((row: { id: string }) =>
        this.endpointKey('routine', row.id),
      ),
      ...routineSteps.map((row: { id: string }) =>
        this.endpointKey('routine_step', row.id),
      ),
      ...skills.map((row: { id: string }) =>
        this.endpointKey('learning_skill', row.id),
      ),
      ...debts.map((row: { id: string }) =>
        this.endpointKey('finance_debt', row.id),
      ),
      ...savings.map((row: { userId: string }) =>
        this.endpointKey('finance_savings', row.userId),
      ),
      ...transactions.map((row: { id: string }) =>
        this.endpointKey('finance_transaction', row.id),
      ),
      ...journals.map((row: { id: string }) =>
        this.endpointKey('journal_entry', row.id),
      ),
    ]);
  }

  private async routineStepTarget(
    userId: string,
    stepId: string,
    db: LedgerDb = this.prisma,
  ) {
    const links = await db.entityLink.findMany({
      where: {
        userId,
        relationshipType: 'triggered_by',
        OR: [
          { sourceType: 'routine_step', sourceId: stepId },
          { targetType: 'routine_step', targetId: stepId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    return (
      linkedPeers(links, 'routine_step', stepId, 'triggered_by')[0] ?? null
    );
  }

  private async checkInHabit(
    userId: string,
    habit: {
      id: string;
      lastCheckin: Date | null;
      currentStreak: number;
      longestStreak: number;
    },
    currentDate: Date,
  ) {
    if (habit.lastCheckin && sameDate(habit.lastCheckin, currentDate)) {
      return habit;
    }
    const last = habit.lastCheckin ? dateOnly(habit.lastCheckin) : null;
    const diff = last
      ? Math.round((currentDate.getTime() - last.getTime()) / 86400000)
      : 999;
    const streak = diff === 1 ? habit.currentStreak + 1 : 1;
    await this.awardXp(userId, 'habit', 5);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.habitCheckin.upsert({
        where: {
          habitId_checkinDate: {
            habitId: habit.id,
            checkinDate: currentDate,
          },
        },
        update: {},
        create: {
          userId,
          habitId: habit.id,
          checkinDate: currentDate,
        },
      }),
      this.prisma.habit.update({
        where: { id: habit.id, userId },
        data: {
          currentStreak: streak,
          longestStreak: Math.max(habit.longestStreak, streak),
          lastCheckin: currentDate,
        },
      }),
    ]);
    return updated;
  }

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

  private async ensureDebtPaymentTransactions(userId: string) {
    const payments = await this.prisma.debtPayment.findMany({
      where: active({ userId }),
      include: { transaction: true },
    });
    if (!payments.length) return;

    await this.prisma.$transaction(async (tx) => {
      for (const payment of payments) {
        const transaction = payment.transaction
          ? payment.transaction.deletedAt
            ? await tx.financeTransaction.update({
                where: { id: payment.transaction.id, userId },
                data: { deletedAt: null },
              })
            : payment.transaction
          : await tx.financeTransaction.create({
              data: {
                userId,
                transactionDate: payment.paidOn,
                type: 'debt_payment',
                amount: payment.amount,
                category: 'Debt',
                note:
                  payment.kind === 'emi'
                    ? 'Scheduled EMI'
                    : 'Extra debt payment',
                status: 'confirmed',
                debtPaymentId: payment.id,
              },
            });
        await tx.entityLink.deleteMany({
          where: {
            userId,
            OR: [
              {
                sourceType: 'finance_transaction',
                sourceId: transaction.id,
                targetType: 'finance_debt',
                targetId: { not: payment.debtId },
              },
              {
                targetType: 'finance_transaction',
                targetId: transaction.id,
                sourceType: 'finance_debt',
                sourceId: { not: payment.debtId },
              },
            ],
          },
        });
        await this.upsertEntityLink(
          userId,
          'finance_transaction',
          transaction.id,
          'finance_debt',
          payment.debtId,
          'linked',
          tx,
        );
      }
    });
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

  private nextGoalLevel(parentLevel: string) {
    if (
      ['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(
        parentLevel,
      )
    )
      return 'monthly';
    if (parentLevel === 'monthly') return 'weekly';
    if (parentLevel === 'weekly') return 'daily';
    return 'daily';
  }

  private async firstLifeGoal(userId: string) {
    return this.prisma.goal.findFirst({
      where: active({
        userId,
        level: {
          in: ['north_star', 'someday', 'life', 'five_year', 'one_year'],
        },
      }),
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
      linkedFinanceAction: null as string | null,
      linkedJournal: null as string | null,
    };
    const expectedTargetType = this.expectedRoutineStepTargetType(stepType);
    let target: { type: EntityTypeValue; id: string } | null = null;

    if (expectedTargetType) {
      const targetType = this.checkedEntityType(
        body.targetType ?? expectedTargetType,
      );
      const targetId = asString(body.targetId);
      if (targetType !== expectedTargetType || !targetId) {
        throw new BadRequestException(
          `${stepType.replaceAll('_', ' ')} steps require a ${expectedTargetType.replaceAll('_', ' ')} target.`,
        );
      }
      await this.assertRoutineStepTarget(
        userId,
        stepType,
        targetType,
        targetId,
      );
      target = { type: targetType, id: targetId };
    }

    if (stepType === 'finance') {
      data.linkedFinanceAction = asString(body.linkedFinanceAction, 'expense');
    }

    if (stepType === 'journal') {
      data.linkedJournal = asString(body.linkedJournal, 'today');
    }

    return { data, target };
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
            completionPct: routine.completionPct,
            status: routine.status,
          },
          create: {
            userId,
            routineId: routine.routineId,
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
    await this.ensureDebtPaymentTransactions(userId);
    await this.processPredictedRecurringIncome(userId);
    this.invalidatePatternCache(userId);
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
      budgetLimits,
      dietLogs,
      journalEntries,
      xpEvents,
      patterns,
      weeklyReflection,
      routines,
      routineStepCompletions,
      routineDayLogsForStreaks,
      entityLinks,
    ] = await Promise.all([
      this.prisma.userStats.findUnique({ where: { userId } }),
      this.prisma.profile.findUnique({ where: { id: userId } }),
      this.currentFocusCycle(userId, t),
      this.prisma.journalEntry.findFirst({
        where: active({ userId, entryDate: t }),
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
        include: { incomeSource: true, debtPayment: true },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
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
      }),
      this.prisma.budgetLimit.findMany({
        where: { userId },
        orderBy: { category: 'asc' },
      }),
      this.prisma.dietLog.findMany({
        where: active({ userId }),
        orderBy: { logDate: 'asc' },
        take: 90,
      }),
      this.prisma.journalEntry.findMany({
        where: active({ userId }),
        orderBy: { entryDate: 'asc' },
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
      this.prisma.entityLink.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const activeEndpoints = await this.activeEntityEndpointKeys(userId);
    const activeEntityLinks = this.filterLinksToActiveEndpoints(
      entityLinks,
      activeEndpoints,
    );
    const transactionsWithLinks = financeTransactions.map((transaction) => {
      const debtPeer = linkedPeers(
        activeEntityLinks,
        'finance_transaction',
        transaction.id,
      ).find((peer) => peer.type === 'finance_debt');
      const debtId = transaction.debtPayment?.debtId ?? debtPeer?.id ?? null;
      return {
        ...transaction,
        debtId,
        linkedDebt: debts.find((debt) => debt.id === debtId) ?? null,
      };
    });
    const routinesWithTargets = routines.map((routine) => ({
      ...routine,
      steps: routine.steps.map((step) => {
        const target = linkedPeers(
          activeEntityLinks,
          'routine_step',
          step.id,
          'triggered_by',
        )[0];
        return {
          ...step,
          targetType: target?.type ?? null,
          targetId: target?.id ?? null,
        };
      }),
    }));
    const linkSuggestions = {
      journalLearning: suggestJournalLearningLinks({
        journals: journalEntries,
        sessions,
        skills,
        entityLinks: activeEntityLinks,
      }),
      debtTransactions: suggestDebtTransactionLinks({
        transactions: transactionsWithLinks,
        debts,
        entityLinks: activeEntityLinks,
      }),
    };

    const financeSummary = computeFinanceSummary({
      today: t,
      savingsBalance: savings?.balance,
      assets,
      debts,
      transactions: transactionsWithLinks,
      debtPayments,
      incomeSources,
      netWorthSnapshots,
      budgetLimits,
    });
    const loanSummaries = financeSummary.debt.debts.map((summary) => {
      const debt = debts.find((item) => item.id === summary.debtId)!;
      const emiAmount = debt.emiAmount == null ? null : Number(debt.emiAmount);
      return {
        ...summary,
        emiWarning: emiWarning(
          Number(debt.principal),
          Number(debt.interestRate),
          debt.tenureMonths,
          emiAmount,
        ),
      };
    });

    const routineStatuses = evaluateRoutineStatuses({
      routines: routinesWithTargets,
      currentDate: t,
      goals,
      habits,
      sessions,
      financeMonths,
      transactions: transactionsWithLinks,
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
      transactions: transactionsWithLinks,
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
      budgetLimits,
      financeSummary,
      dietLogs,
      journalEntries,
      xpEvents,
      patterns,
      weeklyReflection,
      routines: routinesWithTargets,
      routineStatuses,
      routineDayLogs,
      entityLinks: activeEntityLinks,
      linkSuggestions,
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
      habitCheckins,
      routineDayLogs,
      goals,
      transactions,
      entityLinks,
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
      this.prisma.habitCheckin.findMany({
        where: { userId, checkinDate: { gte: start } },
        orderBy: { checkinDate: 'asc' },
      }),
      this.prisma.routineDayLog.findMany({
        where: { userId, logDate: { gte: start } },
        orderBy: { logDate: 'asc' },
      }),
      this.prisma.goal.findMany({
        where: active({ userId }),
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.financeTransaction.findMany({
        where: active({ userId, transactionDate: { gte: start } }),
        orderBy: { transactionDate: 'asc' },
      }),
      this.prisma.entityLink.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const activeEndpoints = await this.activeEntityEndpointKeys(userId);
    const activeEntityLinks = this.filterLinksToActiveEndpoints(
      entityLinks,
      activeEndpoints,
    );
    const patterns = computeCorrelationPatterns({
      today: currentDate,
      journals,
      sleep,
      diet,
      weights,
      sessions,
      dailyGoals,
      habits,
      habitActivity: habitCheckins,
      routineDayLogs,
      goals,
      transactions,
      entityLinks: activeEntityLinks,
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

  private async recordNetWorthSnapshot(
    userId: string,
    snapshotDate = today(),
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const [assets, debts, savings] = await Promise.all([
      db.asset.findMany({ where: active({ userId }) }),
      db.debt.findMany({ where: active({ userId }) }),
      db.savings.findUnique({ where: { userId } }),
    ]);
    const totalAssets =
      assets.reduce((sum, asset) => sum + Number(asset.currentValue), 0) +
      Number(savings?.balance ?? 0);
    const liabilities = debts.reduce(
      (sum, debt) => sum + Number(debt.balance),
      0,
    );
    return db.netWorthSnapshot.create({
      data: {
        userId,
        totalAssets,
        liabilities,
        netWorth: totalAssets - liabilities,
        snapshotDate,
      },
    });
  }

  private async processPredictedRecurringIncome(userId: string) {
    const todayDate = today();
    const dayOfMonth = todayDate.getDate();

    // Auto-confirm predicted transactions older than 3 days
    const graceCutoff = new Date(todayDate);
    graceCutoff.setDate(graceCutoff.getDate() - 3);

    await this.prisma.financeTransaction.updateMany({
      where: {
        userId,
        type: 'income',
        status: 'predicted',
        transactionDate: { lte: graceCutoff },
        deletedAt: null,
      },
      data: {
        status: 'confirmed',
      },
    });

    // Generate predicted transactions for active recurring income sources
    const recurringSources = await this.prisma.incomeSource.findMany({
      where: {
        userId,
        deletedAt: null,
        isRecurring: true,
        frequency: { not: 'one-time' },
      },
    });

    const startOfMonth = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth() + 1,
      0,
    );

    for (const source of recurringSources) {
      const expectedDay = Math.min(
        Math.max(source.recurringDayOfMonth ?? 1, 1),
        28,
      );
      const existing = await this.prisma.financeTransaction.findFirst({
        where: {
          userId,
          incomeSourceId: source.id,
          type: 'income',
          transactionDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          deletedAt: null,
        },
      });

      if (!existing && dayOfMonth >= expectedDay) {
        const targetDate = new Date(
          todayDate.getFullYear(),
          todayDate.getMonth(),
          expectedDay,
        );
        await this.prisma.financeTransaction.create({
          data: {
            userId,
            incomeSourceId: source.id,
            transactionDate: targetDate,
            type: 'income',
            amount: source.amount,
            category: 'Income',
            note: `Predicted income: ${source.name}`,
            status: 'predicted',
          },
        });
      }
    }
  }

  async wipeUserData(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.entityLink.deleteMany({ where: { userId } });
      await tx.journalEntry.deleteMany({ where: { userId } });
      await tx.routineStepCompletion.deleteMany({ where: { userId } });
      await tx.routineStep.deleteMany({ where: { userId } });
      await tx.routineDayLog.deleteMany({ where: { userId } });
      await tx.routine.deleteMany({ where: { userId } });
      await tx.habitCheckin.deleteMany({ where: { userId } });
      await tx.habit.deleteMany({ where: { userId } });
      await tx.dailyGoal.deleteMany({ where: { userId } });
      await tx.weeklyGoal.deleteMany({ where: { userId } });
      await tx.lifeGoal.deleteMany({ where: { userId } });
      await tx.goal.deleteMany({ where: { userId } });
      await tx.focusCycle.deleteMany({ where: { userId } });
      await tx.debtPayment.deleteMany({ where: { userId } });
      await tx.financeTransaction.deleteMany({ where: { userId } });
      await tx.budgetLimit.deleteMany({ where: { userId } });
      await tx.debt.deleteMany({ where: { userId } });
      await tx.incomeSource.deleteMany({ where: { userId } });
      await tx.savings.deleteMany({ where: { userId } });
      await tx.financeMonth.deleteMany({ where: { userId } });
      await tx.assetSnapshot.deleteMany({ where: { userId } });
      await tx.asset.deleteMany({ where: { userId } });
      await tx.netWorthSnapshot.deleteMany({ where: { userId } });
      await tx.weightLog.deleteMany({ where: { userId } });
      await tx.dietLog.deleteMany({ where: { userId } });
      await tx.workoutLog.deleteMany({ where: { userId } });
      await tx.sleepLog.deleteMany({ where: { userId } });
      await tx.relationshipCheckin.deleteMany({ where: { userId } });
      await tx.importantDate.deleteMany({ where: { userId } });
      await tx.learningSession.deleteMany({ where: { userId } });
      await tx.skill.deleteMany({ where: { userId } });
      await tx.weeklyReflection.deleteMany({ where: { userId } });
      await tx.xpEvent.deleteMany({ where: { userId } });
      await tx.userStats.upsert({
        where: { userId },
        update: {
          level: 1,
          xp: 0,
          currentStreak: 0,
          longestStreak: 0,
          freezeTokens: 0,
          lastActiveDate: null,
        },
        create: {
          userId,
          level: 1,
          xp: 0,
          currentStreak: 0,
          longestStreak: 0,
          freezeTokens: 0,
          lastActiveDate: null,
        },
      });
    });
    return { ok: true };
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
    this.invalidatePatternCache(userId);
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
        if (!existing) await this.awardXp(userId, 'journal', 10);
        return toJson(entry);
      }
      case 'journal.update':
        return toJson(
          await this.prisma.journalEntry.update({
            where: { id: String(body.id), userId },
            data: {
              mood: String(body.mood ?? 'Steady'),
              body: String(body.body ?? ''),
            },
          }),
        );
      case 'journal.delete':
        return toJson(
          await this.prisma.journalEntry.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'journal.restore':
        return toJson(
          await this.prisma.journalEntry.update({
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'dailyGoal.restore':
        return toJson(
          await this.prisma.dailyGoal.update({
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'lifeGoal.restore':
        return toJson(
          await this.prisma.lifeGoal.update({
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
            data: {
              title: String(body.title ?? ''),
              lifeGoalId: body.lifeGoalId ? String(body.lifeGoalId) : null,
            },
          }),
        );
      case 'weeklyGoal.delete':
        return toJson(
          await this.prisma.weeklyGoal.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'weeklyGoal.restore':
        return toJson(
          await this.prisma.weeklyGoal.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: null },
          }),
        );
      case 'goal.add': {
        let parentGoalId = body.parentGoalId ? String(body.parentGoalId) : null;
        let parent = parentGoalId
          ? await this.prisma.goal.findFirst({
              where: active({ id: parentGoalId, userId }),
            })
          : null;
        let rawLevel = String(body.level ?? 'north_star');
        if (['someday', 'life', 'five_year', 'one_year'].includes(rawLevel))
          rawLevel = 'north_star';
        const level = parent ? this.nextGoalLevel(parent.level) : rawLevel;
        if (!['north_star', 'monthly', 'weekly', 'daily'].includes(level)) {
          throw new BadRequestException('Unknown goal level.');
        }

        if (!parent && level !== 'north_star') {
          const parentLevelMap: Record<string, string[]> = {
            monthly: ['north_star', 'one_year', 'five_year', 'someday', 'life'],
            weekly: ['monthly'],
            daily: ['weekly'],
          };
          const candidateLevels = parentLevelMap[level] ?? [];
          if (candidateLevels.length > 0) {
            const candidateParent = await this.prisma.goal.findFirst({
              where: active({ userId, level: { in: candidateLevels } }),
              orderBy: { createdAt: 'desc' },
            });
            if (candidateParent) {
              parentGoalId = candidateParent.id;
              parent = candidateParent;
            }
          }
        }
        return toJson(
          await this.prisma.goal.create({
            data: {
              userId,
              parentGoalId: level === 'north_star' ? null : parentGoalId,
              level,
              title: String(body.title ?? ''),
              targetMetric:
                [
                  'north_star',
                  'monthly',
                  'weekly',
                  'one_year',
                  'five_year',
                  'someday',
                  'life',
                ].includes(level) && body.targetMetric
                  ? String(body.targetMetric)
                  : null,
              targetDescription:
                [
                  'north_star',
                  'monthly',
                  'one_year',
                  'five_year',
                  'someday',
                  'life',
                ].includes(level) &&
                (body.definitionOfDone ?? body.targetDescription)
                  ? String(body.definitionOfDone ?? body.targetDescription)
                  : null,
              definitionOfDone:
                [
                  'north_star',
                  'monthly',
                  'one_year',
                  'five_year',
                  'someday',
                  'life',
                ].includes(level) &&
                (body.definitionOfDone ?? body.targetDescription)
                  ? String(body.definitionOfDone ?? body.targetDescription)
                  : null,
              whyThisMatters:
                [
                  'north_star',
                  'someday',
                  'life',
                  'five_year',
                  'one_year',
                ].includes(level) && body.whyThisMatters
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
                [
                  'north_star',
                  'monthly',
                  'weekly',
                  'one_year',
                  'five_year',
                  'someday',
                  'life',
                ].includes(existing.level) && body.targetMetric
                  ? String(body.targetMetric)
                  : null,
              targetDescription:
                [
                  'north_star',
                  'monthly',
                  'one_year',
                  'five_year',
                  'someday',
                  'life',
                ].includes(existing.level) &&
                (body.definitionOfDone ?? body.targetDescription)
                  ? String(body.definitionOfDone ?? body.targetDescription)
                  : null,
              definitionOfDone:
                [
                  'north_star',
                  'monthly',
                  'one_year',
                  'five_year',
                  'someday',
                  'life',
                ].includes(existing.level) &&
                (body.definitionOfDone ?? body.targetDescription)
                  ? String(body.definitionOfDone ?? body.targetDescription)
                  : null,
              whyThisMatters:
                [
                  'north_star',
                  'someday',
                  'life',
                  'five_year',
                  'one_year',
                ].includes(existing.level) && body.whyThisMatters
                  ? String(body.whyThisMatters)
                  : null,
              targetDate:
                [
                  'north_star',
                  'monthly',
                  'weekly',
                  'daily',
                  'one_year',
                  'five_year',
                  'someday',
                  'life',
                ].includes(existing.level) && body.targetDate
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
        if (!goal.completed) {
          const xpMap: Record<string, { xp: number; source: string }> = {
            daily: { xp: 5, source: 'daily_goal' },
            weekly: { xp: 10, source: 'weekly_goal' },
            monthly: { xp: 15, source: 'monthly_goal' },
            north_star: { xp: 50, source: 'north_star_goal' },
            one_year: { xp: 50, source: 'north_star_goal' },
            five_year: { xp: 50, source: 'north_star_goal' },
            someday: { xp: 50, source: 'north_star_goal' },
            life: { xp: 50, source: 'north_star_goal' },
          };
          const reward = xpMap[goal.level] ?? { xp: 10, source: 'goal' };
          await this.awardXp(userId, reward.source, reward.xp);
        }
        return toJson(
          await this.prisma.goal.update({
            where: { id: goal.id },
            data: { completed: !goal.completed },
          }),
        );
      }
      case 'goal.delete': {
        const targetId = String(body.id);
        const allGoals = await this.prisma.goal.findMany({
          where: { userId, deletedAt: null },
        });
        const idsToDelete = new Set<string>([targetId]);
        let changed = true;
        while (changed) {
          changed = false;
          allGoals.forEach((g) => {
            if (
              g.parentGoalId &&
              idsToDelete.has(g.parentGoalId) &&
              !idsToDelete.has(g.id)
            ) {
              idsToDelete.add(g.id);
              changed = true;
            }
          });
        }
        await this.prisma.goal.updateMany({
          where: { id: { in: Array.from(idsToDelete) }, userId },
          data: { deletedAt: new Date() },
        });
        return toJson({ id: targetId, count: idsToDelete.size });
      }
      case 'goal.restore':
        return toJson(
          await this.prisma.goal.update({
            where: { id: String(body.id), userId },
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
            where: active({
              id: focusGoalId,
              userId,
              level: {
                in: ['north_star', 'someday', 'life', 'five_year', 'one_year'],
              },
            }),
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
            where: active({
              id: focusGoalId,
              userId,
              level: {
                in: ['north_star', 'someday', 'life', 'five_year', 'one_year'],
              },
            }),
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
        return toJson(
          await this.prisma.routine.create({
            data: {
              userId,
              name: String(body.name ?? ''),
              timeAnchor: body.timeAnchor ? String(body.timeAnchor) : null,
              protected: body.protected === true || body.protected === 'true',
            },
          }),
        );
      }
      case 'routine.update': {
        return toJson(
          await this.prisma.routine.update({
            where: { id: String(body.id), userId },
            data: {
              name: String(body.name ?? ''),
              timeAnchor: body.timeAnchor ? String(body.timeAnchor) : null,
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
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'routine.restore':
        return toJson(
          await this.prisma.routine.update({
            where: { id: String(body.id), userId },
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
        const { data, target } = await this.routineStepLinkData(
          userId,
          stepType,
          body,
        );
        const created = await this.prisma.$transaction(async (tx) => {
          const step = await tx.routineStep.create({
            data: {
              userId,
              routineId,
              orderIndex: maxStep ? maxStep.orderIndex + 1 : 0,
              stepName: String(body.stepName ?? ''),
              stepType,
              ...data,
            },
          });
          if (target) {
            await this.upsertEntityLink(
              userId,
              'routine_step',
              step.id,
              target.type,
              target.id,
              'triggered_by',
              tx,
            );
          }
          return step;
        });
        return toJson({
          ...created,
          targetType: target?.type ?? null,
          targetId: target?.id ?? null,
        });
      }
      case 'routineStep.update': {
        const existing = await this.prisma.routineStep.findFirstOrThrow({
          where: active({ id: String(body.id), userId }),
        });
        const stepType = checkedRoutineStepType(
          body.stepType ?? existing.stepType,
        );
        const { data, target } = await this.routineStepLinkData(
          userId,
          stepType,
          body,
        );
        const updated = await this.prisma.$transaction(async (tx) => {
          const step = await tx.routineStep.update({
            where: { id: existing.id },
            data: {
              stepName: String(body.stepName ?? existing.stepName),
              stepType,
              ...data,
            },
          });
          await this.deleteEntityLinksFor(
            userId,
            'routine_step',
            step.id,
            'triggered_by',
            tx,
          );
          if (target) {
            await this.upsertEntityLink(
              userId,
              'routine_step',
              step.id,
              target.type,
              target.id,
              'triggered_by',
              tx,
            );
          }
          return step;
        });
        return toJson({
          ...updated,
          targetType: target?.type ?? null,
          targetId: target?.id ?? null,
        });
      }
      case 'routineStep.delete':
        return toJson(
          await this.prisma.routineStep.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'routineStep.restore':
        return toJson(
          await this.prisma.routineStep.update({
            where: { id: String(body.id), userId },
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
        const target = await this.routineStepTarget(userId, step.id);
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
        if (stepType === 'habit' && target?.type === 'habit') {
          const habit = await this.prisma.habit.findFirstOrThrow({
            where: { id: target.id, userId },
          });
          return toJson(await this.checkInHabit(userId, habit, t));
        }
        if (
          (stepType === 'daily_goal' || stepType === 'weekly_goal') &&
          target?.type === 'goal'
        ) {
          const goal = await this.prisma.goal.findFirstOrThrow({
            where: { id: target.id, userId },
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
        const emiAmount = body.emiAmount ? asNumber(body.emiAmount) : null;
        const interestRate = asNumber(body.interestRate);
        const tenureMonths = body.tenureMonths
          ? asNumber(body.tenureMonths)
          : null;
        const debt = await this.prisma.debt.create({
          data: {
            userId,
            name: String(body.name ?? ''),
            type: String(body.loanType ?? body.type ?? 'other'),
            principal: amount,
            balance: amount,
            interestRate,
            originalInterestRate: interestRate,
            tenureMonths,
            originalTenureMonths: tenureMonths,
            emiAmount,
            originalEmiAmount: emiAmount,
            dueDay: body.dueDay ? asNumber(body.dueDay, 1) : null,
          },
        });
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(debt);
      }
      case 'debt.delete': {
        const debt = await this.prisma.debt.update({
          where: { id: String(body.id), userId },
          data: { deletedAt: new Date() },
        });
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(debt);
      }
      case 'debt.update': {
        const debt = await this.prisma.debt.update({
          where: { id: String(body.id), userId },
          data: {
            name: String(body.name ?? ''),
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
          where: { id: String(body.id), userId },
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
          const transaction = await tx.financeTransaction.create({
            data: {
              userId,
              transactionDate: t,
              type: 'debt_payment',
              amount: payment.amount,
              category: 'Debt',
              note: 'Logged from debt payment form',
              debtPaymentId: debtPayment.id,
            },
          });
          await this.upsertEntityLink(
            userId,
            'finance_transaction',
            transaction.id,
            'finance_debt',
            debtId,
            'linked',
            tx,
          );
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
              isRecurring:
                body.isRecurring !== false &&
                String(body.frequency ?? 'monthly') !== 'one-time',
              recurringDayOfMonth: body.recurringDayOfMonth
                ? Math.max(1, Math.min(28, asNumber(body.recurringDayOfMonth)))
                : 1,
            },
          }),
        );
      case 'income.update':
        return toJson(
          await this.prisma.incomeSource.update({
            where: { id: String(body.id), userId },
            data: {
              name: String(body.name ?? ''),
              amount: asNumber(body.amount),
              frequency: String(body.frequency ?? 'monthly'),
              isRecurring:
                body.isRecurring !== false &&
                String(body.frequency ?? 'monthly') !== 'one-time',
              recurringDayOfMonth: body.recurringDayOfMonth
                ? Math.max(1, Math.min(28, asNumber(body.recurringDayOfMonth)))
                : 1,
            },
          }),
        );
      case 'transaction.confirm':
        return toJson(
          await this.prisma.financeTransaction.update({
            where: { id: String(body.id), userId },
            data: { status: 'confirmed' },
          }),
        );
      case 'income.delete':
        return toJson(
          await this.prisma.incomeSource.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'income.restore':
        return toJson(
          await this.prisma.incomeSource.update({
            where: { id: String(body.id), userId },
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
          where: { id: String(body.id), userId },
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
          where: { id: String(body.id), userId },
          data: { deletedAt: new Date() },
        });
        await this.recordNetWorthSnapshot(userId, t);
        return toJson(asset);
      }
      case 'asset.restore': {
        const asset = await this.prisma.asset.update({
          where: { id: String(body.id), userId },
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
      case 'savings.save': {
        const saved = await this.prisma.$transaction(async (t) => {
          const res = await t.savings.upsert({
            where: { userId },
            update: {
              balance:
                body.balance == null ? undefined : asNumber(body.balance),
              goalAmount:
                body.goalAmount == null || body.goalAmount === ''
                  ? null
                  : asNumber(body.goalAmount),
            },
            create: {
              userId,
              balance: asNumber(body.balance),
              goalAmount:
                body.goalAmount == null || body.goalAmount === ''
                  ? null
                  : asNumber(body.goalAmount),
            },
          });
          await this.recordNetWorthSnapshot(userId, today(), t);
          return res;
        });
        return toJson(saved);
      }
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
        const incomeSourceId =
          transactionType === 'income' && body.incomeSourceId
            ? String(body.incomeSourceId)
            : null;
        if (incomeSourceId) {
          await this.prisma.incomeSource.findFirstOrThrow({
            where: active({ id: incomeSourceId, userId }),
          });
        }

        if (transactionType !== 'debt_payment') {
          const existingPredicted =
            transactionType === 'income' && incomeSourceId
              ? await this.prisma.financeTransaction.findFirst({
                  where: {
                    userId,
                    type: 'income',
                    status: 'predicted',
                    incomeSourceId,
                    transactionDate,
                    deletedAt: null,
                  },
                })
              : null;

          if (existingPredicted) {
            return toJson(
              await this.prisma.financeTransaction.update({
                where: { id: existingPredicted.id },
                data: {
                  amount,
                  category,
                  note: note || existingPredicted.note,
                  status: 'confirmed',
                  incomeSourceId,
                },
              }),
            );
          }

          return toJson(
            await this.prisma.financeTransaction.create({
              data: {
                userId,
                transactionDate,
                type: transactionType,
                amount,
                category,
                note,
                status: String(body.status ?? 'confirmed'),
                incomeSourceId,
              },
            }),
          );
        }

        const debtId = body.debtId ? String(body.debtId) : '';
        if (!debtId)
          throw new BadRequestException(
            'Debt payment transactions require a debt.',
          );
        const result = await this.prisma.$transaction(async (tx) => {
          const debt = await tx.debt.findFirstOrThrow({
            where: { id: debtId, userId, deletedAt: null },
          });
          const payment = applyPrincipalPayment(Number(debt.balance), amount);
          const debtPayment = await tx.debtPayment.create({
            data: {
              userId,
              debtId,
              amount: payment.amount,
              kind: 'extra',
              interestPortion: payment.interestPortion,
              principalPortion: payment.principalPortion,
              resultingBalance: payment.resultingBalance,
              paidOn: transactionDate,
            },
          });
          await tx.debt.update({
            where: { id: debtId },
            data: { balance: payment.resultingBalance },
          });
          const transaction = await tx.financeTransaction.create({
            data: {
              userId,
              transactionDate,
              type: transactionType,
              amount: payment.amount,
              category,
              note,
              debtPaymentId: debtPayment.id,
            },
          });
          await this.upsertEntityLink(
            userId,
            'finance_transaction',
            transaction.id,
            'finance_debt',
            debtId,
            'linked',
            tx,
          );
          return transaction;
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
        const existingPayment = existing.debtPaymentId
          ? await this.prisma.debtPayment.findFirst({
              where: { id: existing.debtPaymentId, userId },
            })
          : null;
        const existingDebtTarget = await this.prisma.entityLink
          .findMany({
            where: {
              userId,
              OR: [
                {
                  sourceType: 'finance_transaction',
                  sourceId: existing.id,
                  targetType: 'finance_debt',
                },
                {
                  targetType: 'finance_transaction',
                  targetId: existing.id,
                  sourceType: 'finance_debt',
                },
              ],
            },
          })
          .then(
            (links) =>
              linkedPeers(links, 'finance_transaction', existing.id).find(
                (peer) => peer.type === 'finance_debt',
              ) ?? null,
          );
        const nextDebtId =
          transactionType === 'debt_payment'
            ? body.debtId
              ? String(body.debtId)
              : (existingPayment?.debtId ?? existingDebtTarget?.id ?? null)
            : null;
        const nextIncomeSourceId =
          transactionType === 'income'
            ? body.incomeSourceId
              ? String(body.incomeSourceId)
              : existing.incomeSourceId
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
          if (
            existing.type === 'debt_payment' ||
            transactionType === 'debt_payment'
          ) {
            await this.deleteEntityLinksBetweenTypes(
              userId,
              'finance_transaction',
              existing.id,
              'finance_debt',
              tx,
            );
          }

          if (transactionType !== 'debt_payment') {
            if (nextIncomeSourceId) {
              await tx.incomeSource.findFirstOrThrow({
                where: active({ id: nextIncomeSourceId, userId }),
              });
            }
            return tx.financeTransaction.update({
              where: { id: existing.id },
              data: {
                transactionDate,
                type: transactionType,
                amount,
                category,
                note,
                status: 'confirmed',
                incomeSourceId: nextIncomeSourceId,
                debtPaymentId: null,
                deletedAt: null,
              },
            });
          }

          if (!nextDebtId)
            throw new BadRequestException(
              'Debt payment transactions require a debt.',
            );
          const debt = await tx.debt.findFirstOrThrow({
            where: { id: nextDebtId, userId, deletedAt: null },
          });
          const payment = applyPrincipalPayment(Number(debt.balance), amount);
          const debtPayment = await tx.debtPayment.create({
            data: {
              userId,
              debtId: nextDebtId,
              amount: payment.amount,
              kind: 'extra',
              interestPortion: payment.interestPortion,
              principalPortion: payment.principalPortion,
              resultingBalance: payment.resultingBalance,
              paidOn: transactionDate,
            },
          });
          await tx.debt.update({
            where: { id: nextDebtId },
            data: { balance: payment.resultingBalance },
          });
          const transaction = await tx.financeTransaction.update({
            where: { id: existing.id },
            data: {
              transactionDate,
              type: transactionType,
              amount: payment.amount,
              category,
              note,
              status: 'confirmed',
              incomeSourceId: null,
              debtPaymentId: debtPayment.id,
              deletedAt: null,
            },
          });
          await this.upsertEntityLink(
            userId,
            'finance_transaction',
            transaction.id,
            'finance_debt',
            nextDebtId,
            'linked',
            tx,
          );
          return transaction;
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
      case 'budget.save': {
        const category = asString(body.category).trim();
        const limitAmount = asNumber(body.limitAmount);
        if (!category)
          throw new BadRequestException('Budget category is required.');
        if (limitAmount <= 0)
          throw new BadRequestException(
            'Budget limit must be greater than zero.',
          );
        const existingBudget = await this.prisma.budgetLimit.findFirst({
          where: {
            userId,
            category: { equals: category, mode: 'insensitive' },
          },
        });
        return toJson(
          existingBudget
            ? await this.prisma.budgetLimit.update({
                where: { id: existingBudget.id },
                data: { category, limitAmount },
              })
            : await this.prisma.budgetLimit.create({
                data: { userId, category, limitAmount },
              }),
        );
      }
      case 'budget.delete': {
        await this.prisma.budgetLimit.deleteMany({
          where: { id: String(body.id), userId },
        });
        return { ok: true };
      }
      case 'financeMonth.update':
        return toJson(
          await this.prisma.financeMonth.update({
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'financeMonth.restore':
        return toJson(
          await this.prisma.financeMonth.update({
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
            data: { weight: asNumber(body.weight) },
          }),
        );
      case 'weight.delete':
        return toJson(
          await this.prisma.weightLog.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'weight.restore':
        return toJson(
          await this.prisma.weightLog.update({
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
            data: {
              calories: asNumber(body.calories),
              protein: asNumber(body.protein),
            },
          }),
        );
      case 'diet.delete':
        return toJson(
          await this.prisma.dietLog.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'diet.restore':
        return toJson(
          await this.prisma.dietLog.update({
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'workout.restore':
        return toJson(
          await this.prisma.workoutLog.update({
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'sleep.restore':
        return toJson(
          await this.prisma.sleepLog.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: null },
          }),
        );
      case 'habit.add':
        return toJson(
          await this.prisma.habit.create({
            data: {
              userId,
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
            where: { id: String(body.id), userId },
            data: {
              name: String(body.name ?? ''),
              kind: String(body.kind ?? 'build'),
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
        return toJson(await this.checkInHabit(userId, habit, t));
      }
      case 'habit.slip':
        return toJson(
          await this.prisma.habit.update({
            where: { id: String(body.id), userId },
            data: { currentStreak: 0, lastSlip: t },
          }),
        );
      case 'habit.delete':
        return toJson(
          await this.prisma.habit.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'habit.restore':
        return toJson(
          await this.prisma.habit.update({
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'relationship.restore':
        return toJson(
          await this.prisma.relationshipCheckin.update({
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
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
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'importantDate.restore':
        return toJson(
          await this.prisma.importantDate.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: null },
          }),
        );
      case 'skill.add':
        return toJson(
          await this.prisma.skill.create({
            data: {
              userId,
              name: String(body.name ?? ''),
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
            where: { id: String(body.id), userId },
            data: {
              name: String(body.name ?? ''),
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
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'skill.restore':
        return toJson(
          await this.prisma.skill.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: null },
          }),
        );
      case 'learning.add': {
        const skillId = body.skillId ? String(body.skillId) : null;
        if (skillId) {
          await this.prisma.skill.findFirstOrThrow({
            where: active({ id: skillId, userId }),
          });
        }
        await this.awardXp(userId, 'learning', 10);
        return toJson(
          await this.prisma.learningSession.create({
            data: {
              userId,
              skillId,
              minutes: asNumber(body.minutes),
              notes: body.notes ? String(body.notes) : null,
              logDate: t,
            },
          }),
        );
      }
      case 'learning.update': {
        const skillId = body.skillId ? String(body.skillId) : null;
        if (skillId) {
          await this.prisma.skill.findFirstOrThrow({
            where: active({ id: skillId, userId }),
          });
        }
        return toJson(
          await this.prisma.learningSession.update({
            where: { id: String(body.id), userId },
            data: {
              skillId,
              minutes: asNumber(body.minutes),
              notes: body.notes ? String(body.notes) : null,
            },
          }),
        );
      }
      case 'learning.delete':
        return toJson(
          await this.prisma.learningSession.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: new Date() },
          }),
        );
      case 'learning.restore':
        return toJson(
          await this.prisma.learningSession.update({
            where: { id: String(body.id), userId },
            data: { deletedAt: null },
          }),
        );
      case 'entityLink.add': {
        const sourceType = this.checkedEntityType(body.sourceType);
        const sourceId = String(body.sourceId);
        const targetType = this.checkedEntityType(body.targetType);
        const targetId = String(body.targetId);
        const relationshipType = this.checkedRelationshipType(
          body.relationshipType,
        );
        const routineStepEndpoint =
          sourceType === 'routine_step'
            ? { id: sourceId, peerType: targetType, peerId: targetId }
            : targetType === 'routine_step'
              ? { id: targetId, peerType: sourceType, peerId: sourceId }
              : null;

        if (routineStepEndpoint && relationshipType === 'triggered_by') {
          const step = await this.prisma.routineStep.findFirstOrThrow({
            where: active({ id: routineStepEndpoint.id, userId }),
          });
          const stepType = checkedRoutineStepType(step.stepType);
          await this.assertRoutineStepTarget(
            userId,
            stepType,
            routineStepEndpoint.peerType,
            routineStepEndpoint.peerId,
          );
          return toJson(
            await this.prisma.$transaction(async (tx) => {
              await this.deleteEntityLinksFor(
                userId,
                'routine_step',
                step.id,
                'triggered_by',
                tx,
              );
              return this.upsertEntityLink(
                userId,
                'routine_step',
                step.id,
                routineStepEndpoint.peerType,
                routineStepEndpoint.peerId,
                'triggered_by',
                tx,
              );
            }),
          );
        }

        let canonical;
        try {
          canonical = canonicalizeLink(
            { type: sourceType, id: sourceId },
            { type: targetType, id: targetId },
          );
        } catch {
          throw new BadRequestException('An entity cannot link to itself.');
        }
        if (routineStepEndpoint) {
          const existing = await this.prisma.entityLink.findUnique({
            where: {
              userId_sourceType_sourceId_targetType_targetId: {
                userId,
                ...canonical,
              },
            },
          });
          if (existing && this.isManagedRoutineTargetLink(existing)) {
            throw new BadRequestException(
              'Change a routine step target through the routine editor.',
            );
          }
        }

        const debtPaymentEndpoints = this.debtPaymentLinkEndpoints(canonical);
        if (debtPaymentEndpoints) {
          const transaction = await this.prisma.financeTransaction.findFirst({
            where: active({
              id: debtPaymentEndpoints.transactionId,
              userId,
            }),
            include: { debtPayment: true },
          });
          if (
            transaction?.debtPayment &&
            transaction.debtPayment.debtId !== debtPaymentEndpoints.debtId
          ) {
            throw new BadRequestException(
              'A debt-payment transaction can only link to its owning debt.',
            );
          }
          if (transaction?.debtPayment && relationshipType !== 'linked') {
            throw new BadRequestException(
              'The owning debt link is managed by the debt payment.',
            );
          }
        }

        return toJson(
          await this.upsertEntityLink(
            userId,
            sourceType,
            sourceId,
            targetType,
            targetId,
            relationshipType,
          ),
        );
      }
      case 'entityLink.delete': {
        let link;
        if (body.id) {
          link = await this.prisma.entityLink.findFirst({
            where: { id: String(body.id), userId },
          });
        } else {
          const sourceType = this.checkedEntityType(body.sourceType);
          const targetType = this.checkedEntityType(body.targetType);
          let canonical;
          try {
            canonical = canonicalizeLink(
              { type: sourceType, id: String(body.sourceId) },
              { type: targetType, id: String(body.targetId) },
            );
          } catch {
            throw new BadRequestException('An entity cannot link to itself.');
          }
          link = await this.prisma.entityLink.findUnique({
            where: {
              userId_sourceType_sourceId_targetType_targetId: {
                userId,
                ...canonical,
              },
            },
          });
        }
        if (!link) return { count: 0 };
        if (this.isManagedRoutineTargetLink(link)) {
          throw new BadRequestException(
            'Change a routine step target through the routine editor.',
          );
        }
        if (await this.isManagedDebtPaymentLink(userId, link)) {
          throw new BadRequestException(
            'The owning debt link is managed by the debt payment.',
          );
        }
        return toJson(
          await this.prisma.entityLink.deleteMany({
            where: { id: link.id, userId },
          }),
        );
      }
      case 'system.wipeData': {
        await this.wipeUserData(userId);
        return { ok: true, wipedCount: 1 };
      }
      default:
        throw new BadRequestException(`Unknown ledger action: ${type}`);
    }
  }
}
