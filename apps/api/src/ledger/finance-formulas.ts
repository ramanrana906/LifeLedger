import { expectedEmi } from './amortization';

type MoneyValue = unknown;

export type FinanceFormulaInput = {
  today: string | Date;
  savingsBalance: MoneyValue;
  assets: Array<{
    type?: string | null;
    currentValue?: MoneyValue;
  }>;
  debts: Array<{
    id: string;
    principal?: MoneyValue;
    balance?: MoneyValue;
    interestRate?: MoneyValue;
    originalInterestRate?: MoneyValue;
    tenureMonths?: number | null;
    originalTenureMonths?: number | null;
    emiAmount?: MoneyValue;
    originalEmiAmount?: MoneyValue;
  }>;
  transactions: Array<{
    transactionDate?: string | Date | null;
    type?: string | null;
    amount?: MoneyValue;
    category?: string | null;
    status?: string | null;
    incomeSourceId?: string | null;
  }>;
  debtPayments: Array<{
    debtId: string;
    kind?: string | null;
    interestPortion?: MoneyValue;
    principalPortion?: MoneyValue;
    amount?: MoneyValue;
  }>;
  incomeSources: Array<{
    id: string;
    isRecurring?: boolean | null;
  }>;
  netWorthSnapshots: Array<{
    snapshotDate: string | Date;
    totalAssets?: MoneyValue;
  }>;
  budgetLimits: Array<{
    category: string;
    limitAmount?: MoneyValue;
  }>;
};

type AmortizationProjection = {
  interest: number;
  months: number;
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  'mutual-fund': 'Mutual Funds',
  'mutual fund': 'Mutual Funds',
  mutual_fund: 'Mutual Funds',
  stock: 'Stocks',
  stocks: 'Stocks',
  fd: 'FDs',
  'fixed-deposit': 'FDs',
  'fixed deposit': 'FDs',
  'real-estate': 'Real Estate',
  'real estate': 'Real Estate',
  real_estate: 'Real Estate',
  other: 'Other',
};

function number(value: MoneyValue) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function dateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function monthKey(value: string | Date) {
  return dateKey(value).slice(0, 7);
}

function addUtcMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function subtractUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

function confirmed(row: FinanceFormulaInput['transactions'][number]) {
  return row.status === 'confirmed';
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? round((numerator / denominator) * 100) : null;
}

function projectAmortization(
  balance: number,
  annualRatePercent: number,
  monthlyPayment: number,
  maxMonths = 1200,
): AmortizationProjection | null {
  let remaining = round(balance);
  let interest = 0;
  let months = 0;
  const monthlyRate = annualRatePercent / 100 / 12;

  while (remaining > 0 && months < maxMonths) {
    const interestPortion = round(remaining * monthlyRate);
    const principalPortion = round(
      Math.min(remaining, Math.max(monthlyPayment - interestPortion, 0)),
    );
    if (principalPortion <= 0) return null;
    interest = round(interest + interestPortion);
    remaining = round(Math.max(remaining - principalPortion, 0));
    months += 1;
  }

  return remaining <= 0 ? { interest, months } : null;
}

function debtPaymentAmount(
  debt: FinanceFormulaInput['debts'][number],
  original = false,
) {
  const stored = original
    ? number(debt.originalEmiAmount) || number(debt.emiAmount)
    : number(debt.emiAmount);
  if (stored > 0) return stored;
  const tenureMonths = original
    ? (debt.originalTenureMonths ?? debt.tenureMonths)
    : debt.tenureMonths;
  if (tenureMonths && number(debt.principal) > 0) {
    return expectedEmi(
      number(debt.principal),
      original
        ? number(debt.originalInterestRate ?? debt.interestRate)
        : number(debt.interestRate),
      tenureMonths,
    );
  }
  return 0;
}

function expenseTotalsByCategory(
  transactions: FinanceFormulaInput['transactions'],
  month: string,
) {
  const result = new Map<string, { name: string; value: number }>();
  transactions
    .filter(
      (row) =>
        confirmed(row) &&
        row.type === 'expense' &&
        row.transactionDate &&
        monthKey(row.transactionDate) === month,
    )
    .forEach((row) => {
      const name = String(row.category || 'Other').trim() || 'Other';
      const key = name.toLocaleLowerCase();
      const current = result.get(key) ?? { name, value: 0 };
      current.value = round(current.value + number(row.amount));
      result.set(key, current);
    });
  return result;
}

export function computeFinanceSummary(input: FinanceFormulaInput) {
  const today = new Date(input.today);
  const currentMonth = monthKey(today);
  const previousMonth = monthKey(addUtcMonths(today, -1));
  const confirmedThisMonth = input.transactions.filter(
    (row) =>
      confirmed(row) &&
      row.transactionDate &&
      monthKey(row.transactionDate) === currentMonth,
  );
  const monthlyIncome = round(
    confirmedThisMonth
      .filter((row) => row.type === 'income')
      .reduce((sum, row) => sum + number(row.amount), 0),
  );
  const monthlyExpenses = round(
    confirmedThisMonth
      .filter((row) => row.type === 'expense')
      .reduce((sum, row) => sum + number(row.amount), 0),
  );
  const monthlyDebtPayments = round(
    confirmedThisMonth
      .filter((row) => row.type === 'debt_payment')
      .reduce((sum, row) => sum + number(row.amount), 0),
  );

  const savingsBalance = round(number(input.savingsBalance));
  const trackedAssets = round(
    input.assets.reduce((sum, asset) => sum + number(asset.currentValue), 0),
  );
  const totalAssets = round(savingsBalance + trackedAssets);
  const totalLiabilities = round(
    input.debts.reduce((sum, debt) => sum + number(debt.balance), 0),
  );

  const expensesByMonth = new Map<string, number>();
  input.transactions
    .filter(
      (row) =>
        confirmed(row) &&
        row.type === 'expense' &&
        row.transactionDate &&
        monthKey(row.transactionDate) <= currentMonth,
    )
    .forEach((row) => {
      const key = monthKey(row.transactionDate!);
      expensesByMonth.set(
        key,
        round((expensesByMonth.get(key) ?? 0) + number(row.amount)),
      );
    });
  const expenseHistory = [...expensesByMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3);
  const averageMonthlyExpenses = expenseHistory.length
    ? round(
        expenseHistory.reduce((sum, [, value]) => sum + value, 0) /
          expenseHistory.length,
      )
    : null;

  const paymentsByDebt = new Map<string, typeof input.debtPayments>();
  input.debtPayments.forEach((payment) => {
    paymentsByDebt.set(payment.debtId, [
      ...(paymentsByDebt.get(payment.debtId) ?? []),
      payment,
    ]);
  });

  const debtSummaries = input.debts.map((debt) => {
    const payments = paymentsByDebt.get(debt.id) ?? [];
    const totalInterestPaid = round(
      payments.reduce(
        (sum, payment) => sum + number(payment.interestPortion),
        0,
      ),
    );
    const totalPrincipalPaid = round(
      payments.reduce(
        (sum, payment) =>
          sum + number(payment.principalPortion ?? payment.amount),
        0,
      ),
    );
    const originalPayment = debtPaymentAmount(debt, true);
    const currentPayment = debtPaymentAmount(debt);
    const originalProjection =
      originalPayment > 0
        ? projectAmortization(
            number(debt.principal),
            number(debt.originalInterestRate ?? debt.interestRate),
            originalPayment,
          )
        : null;
    const remainingProjection =
      number(debt.balance) <= 0
        ? { interest: 0, months: 0 }
        : currentPayment > 0
          ? projectAmortization(
              number(debt.balance),
              number(debt.interestRate),
              currentPayment,
            )
          : null;
    const hasExtraPayments = payments.some(
      (payment) => payment.kind === 'extra' && number(payment.amount) > 0,
    );
    const interestSaved =
      hasExtraPayments && originalProjection && remainingProjection
        ? round(
            Math.max(
              0,
              originalProjection.interest -
                (totalInterestPaid + remainingProjection.interest),
            ),
          )
        : null;
    const projectedPayoffDate = remainingProjection
      ? dateKey(addUtcMonths(today, remainingProjection.months))
      : null;

    return {
      debtId: debt.id,
      totalInterestPaid,
      totalPrincipalPaid,
      projectedPayoffDate,
      projectedRemainingInterest: remainingProjection?.interest ?? null,
      originalScheduleInterest: originalProjection?.interest ?? null,
      hasExtraPayments,
      interestSaved,
    };
  });

  const activeDebts = input.debts.filter((debt) => number(debt.balance) > 0);
  const projectedDates = debtSummaries
    .filter((summary) => activeDebts.some((debt) => debt.id === summary.debtId))
    .map((summary) => summary.projectedPayoffDate);
  const projectedDebtFreeDate =
    activeDebts.length === 0
      ? null
      : projectedDates.every((value): value is string => Boolean(value))
        ? [...projectedDates].sort().at(-1)!
        : null;
  const weightedAverageInterestRate =
    totalLiabilities > 0
      ? round(
          input.debts.reduce(
            (sum, debt) =>
              sum + number(debt.balance) * number(debt.interestRate),
            0,
          ) / totalLiabilities,
        )
      : null;

  const allocationValues = new Map<string, number>([
    ['Savings', savingsBalance],
    ['Mutual Funds', 0],
    ['Stocks', 0],
    ['FDs', 0],
    ['Real Estate', 0],
    ['Other', 0],
  ]);
  input.assets.forEach((asset) => {
    const normalized = String(asset.type ?? 'other').toLocaleLowerCase();
    const label = ASSET_TYPE_LABELS[normalized] ?? 'Other';
    allocationValues.set(
      label,
      round((allocationValues.get(label) ?? 0) + number(asset.currentValue)),
    );
  });
  const portfolioAllocation = [...allocationValues].map(([name, value]) => ({
    name,
    value,
    percentage: percent(value, totalAssets) ?? 0,
  }));

  const sortedSnapshots = [...input.netWorthSnapshots]
    .filter((row) => Number.isFinite(number(row.totalAssets)))
    .sort((a, b) =>
      dateKey(a.snapshotDate).localeCompare(dateKey(b.snapshotDate)),
    );
  const assetGrowth = [30, 90, 365].map((days) => {
    const cutoff = dateKey(subtractUtcDays(today, days));
    const baseline = sortedSnapshots
      .filter((row) => dateKey(row.snapshotDate) <= cutoff)
      .at(-1);
    const baselineValue = baseline ? number(baseline.totalAssets) : 0;
    return {
      days,
      percentage:
        baseline && baselineValue > 0
          ? percent(totalAssets - baselineValue, baselineValue)
          : null,
      baselineDate: baseline ? dateKey(baseline.snapshotDate) : null,
      baselineValue: baseline ? baselineValue : null,
    };
  });

  const currentCategoryTotals = expenseTotalsByCategory(
    input.transactions,
    currentMonth,
  );
  const previousCategoryTotals = expenseTotalsByCategory(
    input.transactions,
    previousMonth,
  );
  const budgetByCategory = new Map(
    input.budgetLimits.map((budget) => [
      budget.category.trim().toLocaleLowerCase(),
      budget,
    ]),
  );
  const categoryKeys = new Set([
    ...currentCategoryTotals.keys(),
    ...previousCategoryTotals.keys(),
    ...budgetByCategory.keys(),
  ]);
  const categorySpending = [...categoryKeys]
    .map((key) => {
      const current = currentCategoryTotals.get(key);
      const previous = previousCategoryTotals.get(key);
      const budget = budgetByCategory.get(key);
      const actual = current?.value ?? 0;
      const previousAmount = previous?.value ?? 0;
      const change = percent(actual - previousAmount, previousAmount);
      const budgetLimit = budget ? number(budget.limitAmount) : null;
      const budgetPercentage =
        budgetLimit != null ? percent(actual, budgetLimit) : null;
      return {
        category:
          current?.name ?? previous?.name ?? budget?.category ?? 'Other',
        actual,
        budgetLimit,
        budgetPercentage,
        budgetStatus:
          budgetPercentage == null
            ? null
            : budgetPercentage > 100
              ? 'over'
              : budgetPercentage >= 80
                ? 'warning'
                : 'ok',
        previousAmount,
        monthOverMonthPercentage: change,
        direction:
          actual > previousAmount
            ? 'up'
            : actual < previousAmount
              ? 'down'
              : 'flat',
      };
    })
    .sort(
      (a, b) => b.actual - a.actual || a.category.localeCompare(b.category),
    );

  const previousMonthExpenses = round(
    [...previousCategoryTotals.values()].reduce(
      (sum, row) => sum + row.value,
      0,
    ),
  );
  const monthOverMonthExpensePercentage = percent(
    monthlyExpenses - previousMonthExpenses,
    previousMonthExpenses,
  );

  const sourceById = new Map(
    input.incomeSources.map((source) => [source.id, source]),
  );
  const recurringIncome = round(
    confirmedThisMonth
      .filter(
        (row) =>
          row.type === 'income' &&
          row.incomeSourceId &&
          sourceById.get(row.incomeSourceId)?.isRecurring,
      )
      .reduce((sum, row) => sum + number(row.amount), 0),
  );

  return {
    core: {
      savingsBalance,
      trackedAssets,
      totalAssets,
      totalLiabilities,
      netWorth: round(totalAssets - totalLiabilities),
      monthlyIncome,
      monthlyExpenses,
      monthlyDebtPayments,
      monthlyCashFlow: round(
        monthlyIncome - monthlyExpenses - monthlyDebtPayments,
      ),
      savingsRate: percent(monthlyIncome - monthlyExpenses, monthlyIncome),
      debtToIncomeRatio: percent(monthlyDebtPayments, monthlyIncome),
      averageMonthlyExpenses,
      emergencyFundRunway:
        averageMonthlyExpenses && averageMonthlyExpenses > 0
          ? round(savingsBalance / averageMonthlyExpenses)
          : null,
    },
    debt: {
      totalInterestPaid: round(
        debtSummaries.reduce(
          (sum, summary) => sum + summary.totalInterestPaid,
          0,
        ),
      ),
      totalPrincipalPaid: round(
        debtSummaries.reduce(
          (sum, summary) => sum + summary.totalPrincipalPaid,
          0,
        ),
      ),
      weightedAverageInterestRate,
      projectedDebtFreeDate,
      totalInterestSaved: round(
        debtSummaries.reduce(
          (sum, summary) => sum + (summary.interestSaved ?? 0),
          0,
        ),
      ),
      debts: debtSummaries,
    },
    assets: {
      portfolioAllocation,
      growth: assetGrowth,
    },
    budget: {
      previousMonthExpenses,
      monthOverMonthExpensePercentage,
      direction:
        monthlyExpenses > previousMonthExpenses
          ? 'up'
          : monthlyExpenses < previousMonthExpenses
            ? 'down'
            : 'flat',
      categories: categorySpending,
    },
    income: {
      sourceCount: input.incomeSources.length,
      recurringIncome,
      stabilityPercentage:
        input.incomeSources.length > 1
          ? percent(recurringIncome, monthlyIncome)
          : null,
    },
  };
}
