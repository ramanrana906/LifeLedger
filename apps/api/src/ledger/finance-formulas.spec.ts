import { computeFinanceSummary } from './finance-formulas';

describe('finance formulas', () => {
  const result = computeFinanceSummary({
    today: '2026-07-23',
    savingsBalance: 120000,
    assets: [
      { type: 'mutual-fund', currentValue: 200000 },
      { type: 'stock', currentValue: 80000 },
      { type: 'fd', currentValue: 100000 },
      { type: 'real-estate', currentValue: 500000 },
      { type: 'other', currentValue: 20000 },
    ],
    debts: [
      {
        id: 'home',
        principal: 500000,
        balance: 300000,
        interestRate: 8,
        tenureMonths: 60,
        emiAmount: 10138.2,
        originalEmiAmount: 10138.2,
      },
      {
        id: 'car',
        principal: 200000,
        balance: 100000,
        interestRate: 12,
        tenureMonths: 24,
        emiAmount: 9414.69,
        originalEmiAmount: 9414.69,
      },
    ],
    transactions: [
      {
        transactionDate: '2026-07-01',
        type: 'income',
        amount: 80000,
        status: 'confirmed',
        incomeSourceId: 'salary',
      },
      {
        transactionDate: '2026-07-10',
        type: 'income',
        amount: 20000,
        status: 'confirmed',
        incomeSourceId: 'freelance',
      },
      {
        transactionDate: '2026-07-23',
        type: 'income',
        amount: 5000,
        status: 'predicted',
        incomeSourceId: 'salary',
      },
      {
        transactionDate: '2026-07-05',
        type: 'expense',
        category: 'Food',
        amount: 20000,
        status: 'confirmed',
      },
      {
        transactionDate: '2026-07-07',
        type: 'expense',
        category: 'Rent',
        amount: 30000,
        status: 'confirmed',
      },
      {
        transactionDate: '2026-07-10',
        type: 'debt_payment',
        amount: 15000,
        status: 'confirmed',
      },
      {
        transactionDate: '2026-06-03',
        type: 'expense',
        category: 'Food',
        amount: 15000,
        status: 'confirmed',
      },
      {
        transactionDate: '2026-06-04',
        type: 'expense',
        category: 'Rent',
        amount: 25000,
        status: 'confirmed',
      },
      {
        transactionDate: '2026-05-03',
        type: 'expense',
        category: 'Food',
        amount: 30000,
        status: 'confirmed',
      },
    ],
    debtPayments: [
      {
        debtId: 'home',
        kind: 'emi',
        amount: 10138.2,
        interestPortion: 3333.33,
        principalPortion: 6804.87,
      },
      {
        debtId: 'home',
        kind: 'extra',
        amount: 50000,
        interestPortion: 0,
        principalPortion: 50000,
      },
      {
        debtId: 'car',
        kind: 'emi',
        amount: 9414.69,
        interestPortion: 2000,
        principalPortion: 7414.69,
      },
    ],
    incomeSources: [
      { id: 'salary', isRecurring: true },
      { id: 'freelance', isRecurring: false },
    ],
    netWorthSnapshots: [
      { snapshotDate: '2025-07-20', totalAssets: 800000 },
      { snapshotDate: '2026-04-20', totalAssets: 900000 },
      { snapshotDate: '2026-06-20', totalAssets: 950000 },
    ],
    budgetLimits: [
      { category: 'Food', limitAmount: 22000 },
      { category: 'Rent', limitAmount: 25000 },
    ],
  });

  it('computes core figures from confirmed transactions only', () => {
    expect(result.core).toMatchObject({
      totalAssets: 1020000,
      totalLiabilities: 400000,
      netWorth: 620000,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      monthlyDebtPayments: 15000,
      monthlyCashFlow: 35000,
      savingsRate: 50,
      debtToIncomeRatio: 15,
      averageMonthlyExpenses: 40000,
      emergencyFundRunway: 3,
    });
  });

  it('computes debt totals, weighting, payoff, and extra-payment savings', () => {
    expect(result.debt.totalInterestPaid).toBe(5333.33);
    expect(result.debt.totalPrincipalPaid).toBe(64219.56);
    expect(result.debt.weightedAverageInterestRate).toBe(9);
    expect(result.debt.projectedDebtFreeDate).toMatch(/^2029-/);
    expect(
      result.debt.debts.find((debt) => debt.debtId === 'home'),
    ).toMatchObject({
      hasExtraPayments: true,
    });
    expect(result.debt.totalInterestSaved).toBeGreaterThan(0);
  });

  it('computes portfolio allocation and snapshot growth', () => {
    expect(
      result.assets.portfolioAllocation.find((item) => item.name === 'Savings'),
    ).toMatchObject({ value: 120000, percentage: 11.76 });
    expect(
      result.assets.growth.find((item) => item.days === 30)?.percentage,
    ).toBe(7.37);
    expect(
      result.assets.growth.find((item) => item.days === 90)?.percentage,
    ).toBe(13.33);
    expect(
      result.assets.growth.find((item) => item.days === 365)?.percentage,
    ).toBe(27.5);
  });

  it('computes budget and month-over-month formulas', () => {
    expect(result.budget.monthOverMonthExpensePercentage).toBe(25);
    expect(
      result.budget.categories.find((item) => item.category === 'Food'),
    ).toMatchObject({
      actual: 20000,
      budgetPercentage: 90.91,
      budgetStatus: 'warning',
      monthOverMonthPercentage: 33.33,
      direction: 'up',
    });
    expect(
      result.budget.categories.find((item) => item.category === 'Rent'),
    ).toMatchObject({
      budgetPercentage: 120,
      budgetStatus: 'over',
      monthOverMonthPercentage: 20,
    });
  });

  it('computes income stability from recurring confirmed income', () => {
    expect(result.income).toMatchObject({
      sourceCount: 2,
      recurringIncome: 80000,
      stabilityPercentage: 80,
    });
  });

  it('returns empty percentages when income or comparison denominators are zero', () => {
    const empty = computeFinanceSummary({
      today: '2026-07-23',
      savingsBalance: 1000,
      assets: [],
      debts: [],
      transactions: [],
      debtPayments: [],
      incomeSources: [],
      netWorthSnapshots: [],
      budgetLimits: [],
    });
    expect(empty.core.savingsRate).toBeNull();
    expect(empty.core.debtToIncomeRatio).toBeNull();
    expect(empty.core.emergencyFundRunway).toBeNull();
    expect(empty.budget.monthOverMonthExpensePercentage).toBeNull();
  });
});
