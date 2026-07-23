'use client';

import React, { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors, gridStroke } from '@/lib/ledger/constants';
import {
  dateKey,
  filterRange,
  financeTotalsForMonth,
  expenseBreakdownForMonth,
  transactionTypeLabel,
  totalAssets,
  totalLiabilities,
  debtSeries,
  assetSeries,
  netWorthSeries,
  dismissedLinkSuggestionKeys,
  entityDomId,
  focusEntityInView,
  listenForEntityNavigation,
  rememberDismissedLinkSuggestion,
  submit,
  ask,
} from '@/lib/ledger/utils';
import { Parchment, SubTabs, Stat, Field, Select, ProgressBar, ListItem, Empty, RangeToggle } from '@/components/ledger/ui';
import { SvgCanvasTrendChart, ChartTooltip, ChartBox, ChartPlaceholder, AxisLabel } from '@/components/ledger/charts';
import { EntityConnections } from '@/components/ledger/entity-connections';

type ActionFn = (type: string, payload?: Row) => Promise<boolean>;

export function Finance({ data, action }: { data: Dashboard; action: ActionFn }) {
  const financeTabs = ['Overview', 'Transactions', 'Income', 'Savings', 'Debts', 'Assets'] as const;
  const [activeFinanceTab, setActiveFinanceTab] = useState<(typeof financeTabs)[number]>(() => {
    if (typeof window === 'undefined') return 'Overview';
    const saved = window.sessionStorage.getItem('life-ledger-finance-tab');
    window.sessionStorage.removeItem('life-ledger-finance-tab');
    return financeTabs.includes(saved as (typeof financeTabs)[number]) ? (saved as (typeof financeTabs)[number]) : 'Overview';
  });
  const [income, setIncome] = useState({
    name: '',
    amount: '',
    frequency: 'monthly',
    recurringDayOfMonth: '1',
  });
  const [asset, setAsset] = useState({
    name: '',
    type: 'mutual-fund',
    currentValue: '',
  });
  const [debt, setDebt] = useState({
    name: '',
    amount: '',
    loanType: 'personal',
    interestRate: '',
    tenureMonths: '',
    emiAmount: '',
    dueDay: '1',
  });
  const [payment, setPayment] = useState({ debtId: '', amount: '' });
  const [savings, setSavings] = useState('');
  const [savingsGoal, setSavingsGoal] = useState(String(data.savings?.goalAmount ?? '10000'));
  const [range, setRange] = useState(90);
  const [growthRange, setGrowthRange] = useState(90);
  const [budgetDraft, setBudgetDraft] = useState({
    category: 'Food',
    limitAmount: '',
  });
  const [transaction, setTransaction] = useState({
    date: data.today,
    type: 'expense',
    amount: '',
    category: 'Food',
    note: '',
    debtId: '',
    incomeSourceId: '',
  });
  const [transactionFilter, setTransactionFilter] = useState({
    type: '',
    category: '',
    startDate: '',
    endDate: '',
    query: '',
  });
  const [dismissedDebtSuggestions, setDismissedDebtSuggestions] = useState<Set<string>>(dismissedLinkSuggestionKeys);
  const financeSummary = data.financeSummary ?? {};
  const core = financeSummary.core ?? {};
  const debtMetrics = financeSummary.debt ?? {};
  const assetMetrics = financeSummary.assets ?? {};
  const budgetMetrics = financeSummary.budget ?? {};
  const incomeMetrics = financeSummary.income ?? {};
  const totalDebt = Number(core.totalLiabilities ?? totalLiabilities(data));
  const totalAssetValue = Number(core.totalAssets ?? totalAssets(data));
  const netWorth = Number(core.netWorth ?? totalAssetValue - totalDebt);
  const currentMonthTotals = financeTotalsForMonth(data);
  const monthlyIncome = Number(core.monthlyIncome ?? currentMonthTotals.confirmedIncome);
  const monthlyExpenses = Number(core.monthlyExpenses ?? currentMonthTotals.expenses);
  const monthlyDebtPayments = Number(core.monthlyDebtPayments ?? currentMonthTotals.debtPaid);
  const savingsBalance = Number(core.savingsBalance ?? data.savings?.balance ?? 0);
  const debtData = filterRange(debtSeries(data), 'date', range, data.today);
  const assetData = filterRange(assetSeries(data), 'date', range, data.today);
  const netWorthData = filterRange(netWorthSeries(data), 'date', range, data.today);
  const monthMix = [
    { name: 'Income', value: monthlyIncome, color: colors.moss },
    { name: 'Expenses', value: monthlyExpenses, color: colors.wax },
    { name: 'Debt paid', value: monthlyDebtPayments, color: colors.brass },
  ].filter((item) => item.value > 0);
  const expenseBreakdown = expenseBreakdownForMonth(data).map((item, index) => ({
    ...item,
    color: [colors.wax, colors.warning, colors.brass, colors.moss, colors.cyan, colors.neutral][index % 6],
  }));
  const budgetCategories = (budgetMetrics.categories ?? []) as Row[];
  const portfolioAllocation: Array<Row & { color: string }> = ((assetMetrics.portfolioAllocation ?? []) as Row[])
    .filter((item) => Number(item.value) > 0)
    .map((item: Row, index) => ({
      ...item,
      color: [colors.moss, colors.brass, colors.cyan, colors.warning, colors.wax, colors.neutral][index % 6],
    }));
  const selectedGrowth = ((assetMetrics.growth ?? []) as Row[]).find((item) => Number(item.days) === growthRange);
  const portfolioPayoff = debtMetrics.projectedDebtFreeDate
    ? new Date(`${debtMetrics.projectedDebtFreeDate}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : 'No projection yet';
  const transactionCategories = [
    ...new Set([
      'Food',
      'Transport',
      'Rent',
      'Utilities',
      'Shopping',
      'Entertainment',
      'Health',
      'Debt',
      'Income',
      'Other',
      ...data.transactions.map((row) => String(row.category ?? '')).filter(Boolean),
    ]),
  ];
  const transactionCategoryValue = transaction.category && transactionCategories.includes(transaction.category) ? transaction.category : '__custom';
  const filteredTransactions = data.transactions.filter((item) => {
    const date = String(item.transactionDate ?? '');
    if (transactionFilter.type && item.type !== transactionFilter.type) return false;
    if (
      transactionFilter.category &&
      !String(item.category ?? '')
        .toLowerCase()
        .includes(transactionFilter.category.toLowerCase())
    )
      return false;
    if (transactionFilter.startDate && date < transactionFilter.startDate) return false;
    if (transactionFilter.endDate && date > transactionFilter.endDate) return false;
    if (transactionFilter.query) {
      const haystack = `${item.category ?? ''} ${item.note ?? ''} ${item.linkedDebt?.name ?? ''}`.toLowerCase();
      if (!haystack.includes(transactionFilter.query.toLowerCase())) return false;
    }
    return true;
  });
  const debtTransactionSuggestions = (data.linkSuggestions?.debtTransactions ?? []).filter((suggestion) => !dismissedDebtSuggestions.has(`debt:${suggestion.transactionId}:${suggestion.debtId}`));

  useEffect(
    () =>
      listenForEntityNavigation((target) => {
        if (target.entityType === 'finance_transaction') {
          if (!data.transactions.some((item) => String(item.id) === target.entityId)) return;
          setActiveFinanceTab('Transactions');
          setTransactionFilter({
            type: '',
            category: '',
            startDate: '',
            endDate: '',
            query: '',
          });
          focusEntityInView(target);
          return;
        }
        if (target.entityType === 'finance_debt') {
          if (!data.debts.some((item) => String(item.id) === target.entityId)) return;
          setActiveFinanceTab('Debts');
          focusEntityInView(target);
          return;
        }
        if (target.entityType === 'finance_savings' && data.savings) {
          setActiveFinanceTab('Savings');
          focusEntityInView(target);
        }
      }),
    [data.debts, data.savings, data.transactions],
  );

  return (
    <div className="space-y-6">
      <datalist id="finance-transaction-categories">
        {transactionCategories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      <Parchment title="Ledger" eyebrow="Summary">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Monthly income"
            value={
              <div>
                <div>
                  ₹
                  {monthlyIncome.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                {currentMonthTotals.hasPendingIncome ? (
                  <div className="text-[10px] font-normal text-amber-700">+ ₹{currentMonthTotals.pendingIncome.toLocaleString('en-IN')} pending, excluded</div>
                ) : null}
              </div>
            }
            tone="text-moss"
          />
          <Stat label="Savings" value={`₹${savingsBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="text-moss" />
          <Stat label="Assets" value={`₹${totalAssetValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="text-moss" />
          <Stat label="Total debt" value={`₹${totalDebt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="text-wax" />
          <Stat label="Net worth" value={`₹${netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone={netWorth >= 0 ? 'text-brass' : 'text-wax'} />
          <Stat
            label="Monthly cash flow"
            value={`₹${Number(core.monthlyCashFlow ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            tone={Number(core.monthlyCashFlow ?? 0) >= 0 ? 'text-moss' : 'text-wax'}
          />
        </div>
      </Parchment>

      <SubTabs tabs={financeTabs} value={activeFinanceTab} onChange={setActiveFinanceTab} ariaLabel="Finance sections" />

      {/* OVERVIEW */}
      <div className={activeFinanceTab === 'Overview' ? 'space-y-6' : 'hidden'}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Stat label="Net worth" value={`₹${netWorth.toLocaleString('en-IN')}`} tone={netWorth >= 0 ? 'text-brass' : 'text-wax'} />
          <Stat label="Savings rate" value={core.savingsRate == null ? 'No income logged' : `${Number(core.savingsRate).toFixed(1)}%`} tone="text-moss" />
          <Stat label="Debt-to-income" value={core.debtToIncomeRatio == null ? 'No income logged' : `${Number(core.debtToIncomeRatio).toFixed(1)}%`} tone="text-brass" />
          <Stat label="Emergency runway" value={core.emergencyFundRunway == null ? 'Not enough history' : `${Number(core.emergencyFundRunway).toFixed(1)} months`} tone="text-moss" />
          <Stat label="Monthly cash flow" value={`₹${Number(core.monthlyCashFlow ?? 0).toLocaleString('en-IN')}`} tone={Number(core.monthlyCashFlow ?? 0) >= 0 ? 'text-moss' : 'text-wax'} />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <Parchment title="Net Worth Growth" eyebrow="Assets minus liabilities" action={<RangeToggle value={range} onChange={setRange} />}>
            <SvgCanvasTrendChart data={netWorthData} valueKey="netWorth" unit="₹" strokeColor={colors.brass} fillGradientId="overviewNetWorthGrad" height={210} />
          </Parchment>

          <Parchment title="Monthly Cash Mix" eyebrow="Income vs expense vs debt">
            {monthMix.length ? (
              <ChartBox height={210}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={monthMix} innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={4}>
                      {monthMix.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartBox>
            ) : (
              <Empty>Add transactions to see this month&apos;s mix.</Empty>
            )}
            <div className="mt-3 flex flex-wrap justify-around gap-2 text-xs">
              {monthMix.map((item) => (
                <span key={item.name} className="flex items-center gap-1.5 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}: <strong className="tabular-nums">{item.value.toFixed(0)}</strong>
                </span>
              ))}
            </div>
          </Parchment>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr]">
          <Parchment title="Expenses by Category" eyebrow="This month breakdown">
            {expenseBreakdown.length === 0 ? <Empty tone="moss">No expense transactions logged this month.</Empty> : null}
            <div className="space-y-3">
              {expenseBreakdown.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-2 text-ink">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="tabular-nums font-semibold">${item.value.toFixed(2)}</span>
                  </div>
                  <ProgressBar value={item.value} max={currentMonthTotals.expenses || 1} tone={item.color} />
                </div>
              ))}
            </div>
          </Parchment>

          <Parchment
            title="Recent Transactions"
            eyebrow="Financial log"
            action={
              <button type="button" onClick={() => setActiveFinanceTab('Transactions')} className="text-xs font-semibold text-brass hover:underline">
                View all →
              </button>
            }
          >
            {data.transactions.length === 0 ? <Empty tone="moss">No financial transactions logged yet.</Empty> : null}
            {[...data.transactions]
              .reverse()
              .slice(0, 6)
              .map((item) => (
                <ListItem
                  key={item.id}
                  title={`${dateKey(item.transactionDate)} · ${item.category ?? 'Other'}`}
                  note={item.note || (item.type === 'income' ? 'Income' : item.type === 'debt_payment' ? 'Debt payment' : 'Expense')}
                  right={
                    <span className={`font-semibold tabular-nums ${item.type === 'income' ? 'text-moss' : item.type === 'debt_payment' ? 'text-brass' : 'text-wax'}`}>
                      {item.type === 'income' ? '+' : '-'}₹{Number(item.amount ?? 0).toFixed(2)}
                    </span>
                  }
                />
              ))}
          </Parchment>
        </div>
      </div>

      {/* TRANSACTIONS */}
      <div className={activeFinanceTab === 'Transactions' ? 'space-y-6' : 'hidden'}>
        {debtTransactionSuggestions.map((suggestion) => {
          const suggestionKey = `debt:${suggestion.transactionId}:${suggestion.debtId}`;
          return (
            <div key={suggestionKey} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brass/30 bg-brass/10 p-4 text-ink shadow-2xs">
              <div>
                <div className="text-sm font-semibold">Possible debt payment</div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  Link the ₹{Number(suggestion.amount ?? 0).toLocaleString('en-IN')} transaction on {dateKey(suggestion.transactionDate)} to {suggestion.debtName}
                  {suggestion.expectedAmount == null ? '?' : ` (expected ₹${Number(suggestion.expectedAmount).toLocaleString('en-IN')})?`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    action('entityLink.add', {
                      sourceType: 'finance_transaction',
                      sourceId: suggestion.transactionId,
                      targetType: 'finance_debt',
                      targetId: suggestion.debtId,
                      relationshipType: 'linked',
                    })
                  }
                  className="rounded-xl bg-brass px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-brass/90 active:scale-95"
                >
                  Link ✓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDismissedDebtSuggestions((current) => {
                      const next = new Set(current);
                      next.add(suggestionKey);
                      rememberDismissedLinkSuggestion(suggestionKey);
                      return next;
                    })
                  }
                  className="rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:text-ink"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <Parchment title="Add Transaction" eyebrow="Record income, expense, or debt payment">
            <form
              onSubmit={(event) =>
                submit(event, () => {
                  const category = transaction.category.trim() || (transaction.type === 'debt_payment' ? 'Debt' : transaction.type === 'income' ? 'Income' : 'Other');
                  action('transaction.add', { ...transaction, category }).then(() =>
                    setTransaction({
                      date: data.today,
                      type: 'expense',
                      amount: '',
                      category: 'Food',
                      note: '',
                      debtId: '',
                      incomeSourceId: '',
                    }),
                  );
                })
              }
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Date</label>
                  <Field
                    type="date"
                    value={transaction.date}
                    onChange={(event) =>
                      setTransaction({
                        ...transaction,
                        date: event.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Type</label>
                  <Select
                    value={transaction.type}
                    onChange={(event) => {
                      const type = event.target.value;
                      setTransaction({
                        ...transaction,
                        type,
                        category: type === 'debt_payment' ? 'Debt' : type === 'income' ? 'Income' : transaction.category || 'Food',
                        debtId: type === 'debt_payment' ? transaction.debtId : '',
                        incomeSourceId: type === 'income' ? transaction.incomeSourceId : '',
                      });
                    }}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="debt_payment">Debt Payment</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Amount</label>
                  <Field
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    value={transaction.amount}
                    onChange={(event) =>
                      setTransaction({
                        ...transaction,
                        amount: event.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Category</label>
                  <Select
                    value={transactionCategoryValue}
                    onChange={(event) =>
                      setTransaction({
                        ...transaction,
                        category: event.target.value === '__custom' ? '' : event.target.value,
                      })
                    }
                  >
                    {transactionCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value="__custom">Custom category</option>
                  </Select>
                </div>
              </div>

              {transactionCategoryValue === '__custom' ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Custom Category Name</label>
                  <Field
                    placeholder="e.g. Subscriptions, Gifts..."
                    value={transaction.category}
                    onChange={(event) =>
                      setTransaction({
                        ...transaction,
                        category: event.target.value,
                      })
                    }
                  />
                </div>
              ) : null}

              {transaction.type === 'debt_payment' ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Debt being paid</label>
                  <Select
                    value={transaction.debtId}
                    onChange={(event) =>
                      setTransaction({
                        ...transaction,
                        debtId: event.target.value,
                      })
                    }
                  >
                    <option value="">Select debt obligation</option>
                    {data.debts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              {transaction.type === 'income' && data.incomeSources.length ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Income Source (optional)</label>
                  <Select
                    value={transaction.incomeSourceId}
                    onChange={(event) =>
                      setTransaction({
                        ...transaction,
                        incomeSourceId: event.target.value,
                      })
                    }
                  >
                    <option value="">Variable / unassigned income</option>
                    {data.incomeSources.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.isRecurring ? 'recurring' : 'variable'}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Note (optional)</label>
                  <Field
                    placeholder="Where or what did you spend on?"
                    value={transaction.note}
                    onChange={(event) =>
                      setTransaction({
                        ...transaction,
                        note: event.target.value,
                      })
                    }
                  />
                </div>
                <button className="btn btn-primary shrink-0 px-6 py-2.5">+ Save Transaction</button>
              </div>
            </form>
          </Parchment>

          <Parchment title="Expenses by Category" eyebrow="This month breakdown">
            <form
              onSubmit={(event) => submit(event, () => action('budget.save', budgetDraft).then(() => setBudgetDraft({ ...budgetDraft, limitAmount: '' })))}
              className="mb-4 grid gap-2 sm:grid-cols-[1fr_130px_auto]"
            >
              <Field
                list="finance-transaction-categories"
                placeholder="Budget category"
                value={budgetDraft.category}
                onChange={(event) =>
                  setBudgetDraft({
                    ...budgetDraft,
                    category: event.target.value,
                  })
                }
              />
              <Field
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Monthly limit"
                value={budgetDraft.limitAmount}
                onChange={(event) =>
                  setBudgetDraft({
                    ...budgetDraft,
                    limitAmount: event.target.value,
                  })
                }
              />
              <button className="btn btn-primary">Set budget</button>
            </form>
            <div className="mb-4 rounded-xl border bg-background px-3 py-2 text-xs text-[var(--muted)]">
              Month over month:{' '}
              <strong className={budgetMetrics.direction === 'up' ? 'text-wax' : budgetMetrics.direction === 'down' ? 'text-moss' : 'text-ink'}>
                {budgetMetrics.monthOverMonthExpensePercentage == null
                  ? 'No prior-month baseline'
                  : `${budgetMetrics.direction === 'up' ? '↑' : budgetMetrics.direction === 'down' ? '↓' : '→'} ${Math.abs(Number(budgetMetrics.monthOverMonthExpensePercentage)).toFixed(1)}%`}
              </strong>
            </div>
            {budgetCategories.length === 0 ? <Empty tone="moss">Log an expense or set a budget to see category spending.</Empty> : null}
            <div className="space-y-3">
              {budgetCategories.map((item) => {
                const budgetTone = item.budgetStatus === 'over' ? colors.wax : item.budgetStatus === 'warning' ? colors.warning : colors.moss;
                const savedBudget = data.budgetLimits.find((row) => String(row.category).toLocaleLowerCase() === String(item.category).toLocaleLowerCase());
                return (
                  <div key={item.category} className="space-y-1 rounded-xl border border-rule/70 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs font-medium">
                      <span className="text-ink">{item.category}</span>
                      <span className="tabular-nums font-semibold">
                        ₹{Number(item.actual).toFixed(2)}
                        {item.budgetLimit != null ? ` / ₹${Number(item.budgetLimit).toFixed(2)}` : ''}
                      </span>
                    </div>
                    <ProgressBar
                      value={Number(item.actual)}
                      max={item.budgetLimit != null ? Number(item.budgetLimit) : monthlyExpenses || 1}
                      tone={item.budgetLimit != null ? budgetTone : colors.neutral}
                    />
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                      <span>{item.budgetPercentage == null ? 'No budget set' : `${Number(item.budgetPercentage).toFixed(1)}% of budget`}</span>
                      <span className={item.direction === 'up' ? 'text-wax' : item.direction === 'down' ? 'text-moss' : ''}>
                        {item.monthOverMonthPercentage == null
                          ? Number(item.actual) > 0 && Number(item.previousAmount) === 0
                            ? 'New this month'
                            : 'No prior baseline'
                          : `${item.direction === 'up' ? '↑' : item.direction === 'down' ? '↓' : '→'} ${Math.abs(Number(item.monthOverMonthPercentage)).toFixed(1)}% MoM`}
                      </span>
                      {savedBudget ? (
                        <button type="button" className="text-wax hover:underline" onClick={() => action('budget.delete', { id: savedBudget.id })}>
                          Remove limit
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Parchment>
        </div>

        <Parchment title="Transaction History" eyebrow="Filter & search ledger entries">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
            <Select
              value={transactionFilter.type}
              onChange={(event) =>
                setTransactionFilter({
                  ...transactionFilter,
                  type: event.target.value,
                })
              }
            >
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="debt_payment">Debt Payment</option>
            </Select>
            <Field
              list="finance-transaction-categories"
              placeholder="Category"
              value={transactionFilter.category}
              onChange={(event) =>
                setTransactionFilter({
                  ...transactionFilter,
                  category: event.target.value,
                })
              }
            />
            <Field
              type="date"
              value={transactionFilter.startDate}
              onChange={(event) =>
                setTransactionFilter({
                  ...transactionFilter,
                  startDate: event.target.value,
                })
              }
            />
            <Field
              type="date"
              value={transactionFilter.endDate}
              onChange={(event) =>
                setTransactionFilter({
                  ...transactionFilter,
                  endDate: event.target.value,
                })
              }
            />
            <Field
              placeholder="Search notes..."
              value={transactionFilter.query}
              onChange={(event) =>
                setTransactionFilter({
                  ...transactionFilter,
                  query: event.target.value,
                })
              }
            />
          </div>

          {filteredTransactions.length === 0 ? <Empty tone="moss">No transactions match this view.</Empty> : null}
          {filteredTransactions.map((item) => (
            <div id={entityDomId('finance_transaction', String(item.id))} key={item.id} className="transition">
              <ListItem
                title={`${dateKey(item.transactionDate)} · ${transactionTypeLabel(item.type)} · ${item.category ?? 'Other'}`}
                note={`${item.note ? `${item.note} · ` : ''}${item.linkedDebt?.name ? `Debt: ${item.linkedDebt.name}` : ''}`}
                right={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {item.status === 'predicted' ? (
                      <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Pending confirmation</span>
                    ) : null}
                    <span className={`font-semibold tabular-nums text-sm ${item.type === 'income' ? 'text-moss' : item.type === 'debt_payment' ? 'text-brass' : 'text-wax'}`}>
                      {item.type === 'income' ? '+' : '-'}₹{Number(item.amount ?? 0).toFixed(2)}
                    </span>
                    <EntityConnections data={data} entityType="finance_transaction" entityId={String(item.id)} action={action} compact />
                  </div>
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
                  let debtId = '';
                  if (type === 'debt_payment') {
                    const debtName = ask('Debt name', item.linkedDebt?.name ?? data.debts[0]?.name ?? '');
                    if (!debtName) return;
                    debtId = data.debts.find((debtItem) => debtItem.id === debtName || String(debtItem.name).toLowerCase() === debtName.toLowerCase())?.id ?? '';
                    if (!debtId) return;
                  }
                  action('transaction.update', {
                    id: item.id,
                    date,
                    type,
                    amount,
                    category,
                    note,
                    debtId,
                  });
                }}
                onDelete={() =>
                  action('transaction.delete', {
                    id: item.id,
                    label: 'Transaction',
                  })
                }
              />
            </div>
          ))}
        </Parchment>
      </div>

      {/* INCOME */}
      <div className={activeFinanceTab === 'Income' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Income" eyebrow="Sources">
          {Number(incomeMetrics.sourceCount ?? 0) > 1 ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <Stat label="Income stability" value={incomeMetrics.stabilityPercentage == null ? 'No confirmed income' : `${Number(incomeMetrics.stabilityPercentage).toFixed(1)}%`} tone="text-moss" />
              <Stat label="Recurring income this month" value={`₹${Number(incomeMetrics.recurringIncome ?? 0).toLocaleString('en-IN')}`} tone="text-brass" />
            </div>
          ) : null}
          <form
            onSubmit={(e) =>
              submit(e, () =>
                action('income.add', income).then(() =>
                  setIncome({
                    name: '',
                    amount: '',
                    frequency: 'monthly',
                    recurringDayOfMonth: '1',
                  }),
                ),
              )
            }
            className="mb-4 grid gap-2 md:grid-cols-[1fr_150px_160px_130px_auto]"
          >
            <Field placeholder="Source name" value={income.name} onChange={(e) => setIncome({ ...income, name: e.target.value })} />
            <Field placeholder="Amount (₹)" type="number" value={income.amount} onChange={(e) => setIncome({ ...income, amount: e.target.value })} />
            <Select value={income.frequency} onChange={(e) => setIncome({ ...income, frequency: e.target.value })}>
              <option value="monthly">Recurring monthly</option>
              <option value="one-time">One-time</option>
            </Select>
            {income.frequency !== 'one-time' ? (
              <Field placeholder="Due Day (1-28)" type="number" min={1} max={28} value={income.recurringDayOfMonth} onChange={(e) => setIncome({ ...income, recurringDayOfMonth: e.target.value })} />
            ) : (
              <div />
            )}
            <button className="btn btn-primary">Add income</button>
          </form>
          {data.incomeSources.length === 0 ? <Empty>No income sources added yet.</Empty> : null}
          {data.incomeSources.map((item) => (
            <ListItem
              key={item.id}
              title={item.name}
              note={`₹${Number(item.amount).toFixed(2)} · ${item.frequency === 'one-time' ? 'One-time' : `Recurring (credited on day ${item.recurringDayOfMonth ?? 1})`}`}
              onEdit={() => {
                const name = ask('Income source name', item.name);
                if (!name) return;
                const amount = ask('Amount', item.amount);
                if (amount == null) return;
                const frequency = ask('Frequency: monthly or one-time', item.frequency ?? 'monthly');
                if (!frequency) return;
                const recurringDayOfMonth = frequency !== 'one-time' ? ask('Expected day of month (1-28)', String(item.recurringDayOfMonth ?? 1)) : '1';
                action('income.update', {
                  id: item.id,
                  name,
                  amount,
                  frequency,
                  recurringDayOfMonth,
                });
              }}
              onDelete={() => action('income.delete', { id: item.id, label: 'Income source' })}
            />
          ))}
        </Parchment>
      </div>

      {/* SAVINGS */}
      <div className={activeFinanceTab === 'Savings' ? 'space-y-5' : 'hidden'}>
        <div id={data.savings ? entityDomId('finance_savings', String(data.savings.userId ?? 'savings')) : undefined} className="transition">
          <Parchment
            title="Savings"
            eyebrow="Liquid Balance & Target"
            action={data.savings ? <EntityConnections data={data} entityType="finance_savings" entityId={String(data.savings.userId ?? 'savings')} action={action} /> : undefined}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                action('savings.save', {
                  balance: savings !== '' ? savings : (data.savings?.balance ?? 0),
                  goalAmount: savingsGoal !== '' ? savingsGoal : (data.savings?.goalAmount ?? 10000),
                }).then(() => setSavings(''));
              }}
              className="mb-5 space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Current Balance (₹)</label>
                  <Field type="number" value={savings} onChange={(event) => setSavings(event.target.value)} placeholder={`Current: ₹${data.savings?.balance ?? 0}`} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Savings Target (₹)</label>
                  <Field type="number" value={savingsGoal} onChange={(event) => setSavingsGoal(event.target.value)} placeholder="Target amount" />
                </div>
              </div>
              <div className="flex justify-end">
                <button className="btn btn-primary">Save savings</button>
              </div>
            </form>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-[var(--muted)]">
                <span>Progress</span>
                <span className="tabular-nums font-semibold text-ink">
                  ₹{Number(data.savings?.balance ?? 0).toLocaleString('en-IN')} of ₹{Number(savingsGoal || 1).toLocaleString('en-IN')} target
                </span>
              </div>
              <ProgressBar value={Number(data.savings?.balance ?? 0)} max={Number(savingsGoal) || 1} tone={colors.moss} />
            </div>
          </Parchment>
        </div>
      </div>

      {/* DEBTS */}
      <div className={activeFinanceTab === 'Debts' ? 'space-y-5' : 'hidden'}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Interest paid" value={`₹${Number(debtMetrics.totalInterestPaid ?? 0).toLocaleString('en-IN')}`} tone="text-wax" />
          <Stat label="Principal paid" value={`₹${Number(debtMetrics.totalPrincipalPaid ?? 0).toLocaleString('en-IN')}`} tone="text-moss" />
          <Stat
            label="Weighted avg. rate"
            value={debtMetrics.weightedAverageInterestRate == null ? 'No active debt' : `${Number(debtMetrics.weightedAverageInterestRate).toFixed(2)}%`}
            tone="text-brass"
          />
          <Stat label="Debt-free date" value={portfolioPayoff} tone="text-brass" />
          <Stat label="Interest saved" value={`₹${Number(debtMetrics.totalInterestSaved ?? 0).toLocaleString('en-IN')}`} tone="text-moss" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <Parchment title="Debt Payoff" eyebrow={`All debts projected clear: ${portfolioPayoff}`} action={<RangeToggle value={range} onChange={setRange} />}>
            <ChartBox>
              {debtData.length >= 2 ? (
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
              ) : (
                <ChartPlaceholder>Add more entries to see your trend</ChartPlaceholder>
              )}
            </ChartBox>
          </Parchment>

          <Parchment title="This Month" eyebrow="Income, expenses, debt">
            {monthMix.length ? (
              <ChartBox height={220}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={monthMix} innerRadius={54} outerRadius={82} dataKey="value" paddingAngle={3}>
                      {monthMix.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartBox>
            ) : (
              <Empty>Add this month&apos;s transactions to see the mix.</Empty>
            )}
            <div className="mt-3 space-y-2 text-sm">
              {monthMix.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="tabular-nums">₹{item.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </Parchment>
        </div>

        <Parchment title="Debts" eyebrow="Loans & obligations">
          <form
            onSubmit={(e) =>
              submit(e, () =>
                action('debt.add', debt).then(() => {
                  setDebt({
                    name: '',
                    amount: '',
                    loanType: 'personal',
                    interestRate: '',
                    tenureMonths: '',
                    emiAmount: '',
                    dueDay: '1',
                  });
                }),
              )
            }
            className="mb-4 space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Loan / Debt Name</label>
                <Field placeholder="e.g. Home Loan, Car Loan" value={debt.name} onChange={(e) => setDebt({ ...debt, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Principal Amount (₹)</label>
                <Field placeholder="0.00" type="number" value={debt.amount} onChange={(e) => setDebt({ ...debt, amount: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Loan Type</label>
                <Select value={debt.loanType} onChange={(e) => setDebt({ ...debt, loanType: e.target.value })}>
                  <option value="personal">Personal</option>
                  <option value="home">Home</option>
                  <option value="car">Car</option>
                  <option value="credit-card">Credit card</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Interest Rate (%)</label>
                <Field placeholder="e.g. 10.5" type="number" step="0.1" value={debt.interestRate} onChange={(e) => setDebt({ ...debt, interestRate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Tenure (Months)</label>
                <Field placeholder="e.g. 36" type="number" value={debt.tenureMonths} onChange={(e) => setDebt({ ...debt, tenureMonths: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Monthly EMI (₹)</label>
                <Field placeholder="e.g. 5000" type="number" value={debt.emiAmount} onChange={(e) => setDebt({ ...debt, emiAmount: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--muted)]">Due Day of Month (1-28)</label>
                <Field placeholder="1" type="number" min={1} max={28} value={debt.dueDay} onChange={(e) => setDebt({ ...debt, dueDay: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end">
              <button className="btn btn-primary">+ Add debt</button>
            </div>
          </form>
          {data.debts.map((item) => (
            <LoanItem key={item.id} item={item} summary={data.loanSummaries.find((row) => row.debtId === item.id)} data={data} action={action} />
          ))}
          {data.debts.length === 0 ? <Empty>No loans or obligations recorded yet.</Empty> : null}
          <form
            onSubmit={(e) => submit(e, () => action('debt.pay', payment).then(() => setPayment({ ...payment, amount: '' })))}
            className="mt-5 grid gap-2 border-t pt-4 md:grid-cols-[1fr_180px_auto]"
          >
            <Select value={payment.debtId} onChange={(e) => setPayment({ ...payment, debtId: e.target.value })}>
              <option value="">Select debt</option>
              {data.debts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Field placeholder="Amount" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
            <button className="btn btn-primary">Log payment</button>
          </form>
          {data.debtPayments.length ? (
            <div className="mt-5 border-t pt-4">
              <div className="label-caps mb-2">Recent payments</div>
              {[...data.debtPayments]
                .reverse()
                .slice(0, 5)
                .map((item) => (
                  <ListItem
                    key={item.id}
                    title={`${item.paidOn} · ${Number(item.amount).toFixed(2)} ${item.kind === 'emi' ? 'EMI' : 'extra'}`}
                    note={`${data.debts.find((debtRow) => debtRow.id === item.debtId)?.name ?? 'Debt payment'} · principal ${Number(item.principalPortion ?? item.amount).toFixed(2)} · interest ${Number(item.interestPortion ?? 0).toFixed(2)} · balance ${item.resultingBalance == null ? '-' : Number(item.resultingBalance).toFixed(2)}`}
                    onDelete={() =>
                      action('debtPayment.delete', {
                        id: item.id,
                        label: 'Debt payment',
                      })
                    }
                  />
                ))}
            </div>
          ) : (
            <div className="mt-5">
              <Empty>No debt payments logged yet.</Empty>
            </div>
          )}
        </Parchment>
      </div>

      {/* ASSETS */}
      <div className={activeFinanceTab === 'Assets' ? 'space-y-5' : 'hidden'}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Parchment title="Assets" eyebrow="Manual values">
            <form
              onSubmit={(e) =>
                submit(e, () =>
                  action('asset.add', asset).then(() =>
                    setAsset({
                      name: '',
                      type: 'mutual-fund',
                      currentValue: '',
                    }),
                  ),
                )
              }
              className="mb-4 grid gap-2 md:grid-cols-[1fr_170px_160px_auto]"
            >
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
                  action('asset.update', {
                    id: item.id,
                    name,
                    type,
                    currentValue,
                  });
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
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}>
                      <AxisLabel value="Date" />
                    </XAxis>
                    <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={54}>
                      <AxisLabel value="Assets" axis="y" />
                    </YAxis>
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="assets" name="Assets" stroke={colors.moss} fill={colors.moss} fillOpacity={0.12} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder>Update an asset value to see the trend.</ChartPlaceholder>
              )}
            </ChartBox>
          </Parchment>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Parchment title="Portfolio Allocation" eyebrow="Share of total assets">
            {portfolioAllocation.length === 0 ? (
              <Empty>No assets to allocate yet.</Empty>
            ) : (
              <div className="space-y-3">
                {portfolioAllocation.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="flex items-center gap-2 text-ink">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="tabular-nums">
                        {Number(item.percentage).toFixed(1)}% · ₹{Number(item.value).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <ProgressBar value={Number(item.percentage)} max={100} tone={item.color} />
                  </div>
                ))}
              </div>
            )}
          </Parchment>

          <Parchment
            title="Asset Growth Rate"
            eyebrow="Change in total assets"
            action={
              <div className="flex rounded-2xl border bg-background p-1">
                {[30, 90, 365].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setGrowthRange(days)}
                    className={`rounded-xl px-2.5 py-1 text-xs ${growthRange === days ? 'bg-brass text-white' : 'text-[var(--muted)] hover:bg-card'}`}
                  >
                    {days === 365 ? '1yr' : `${days}d`}
                  </button>
                ))}
              </div>
            }
          >
            {selectedGrowth?.percentage == null ? (
              <Empty tone="moss">Not enough snapshot history for this range.</Empty>
            ) : (
              <div>
                <div className={`stat-number text-4xl font-semibold tabular-nums ${Number(selectedGrowth.percentage) >= 0 ? 'text-moss' : 'text-wax'}`}>
                  {Number(selectedGrowth.percentage) >= 0 ? '↑' : '↓'} {Math.abs(Number(selectedGrowth.percentage)).toFixed(2)}%
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  ₹{Number(selectedGrowth.baselineValue).toLocaleString('en-IN')} on {selectedGrowth.baselineDate} → ₹{totalAssetValue.toLocaleString('en-IN')} today
                </p>
              </div>
            )}
          </Parchment>
        </div>

        <Parchment title="Net Worth" eyebrow="Assets minus liabilities">
          <div className="mb-5 grid grid-cols-3 gap-6">
            <Stat label="Assets" value={totalAssetValue.toFixed(2)} tone="text-moss" />
            <Stat label="Liabilities" value={totalDebt.toFixed(2)} tone="text-wax" />
            <Stat label="Net worth" value={netWorth.toFixed(2)} tone={netWorth >= 0 ? 'text-brass' : 'text-wax'} />
          </div>
          <SvgCanvasTrendChart data={netWorthData} valueKey="netWorth" unit="₹" strokeColor={colors.brass} fillGradientId="netWorthGradient" height={210} />
        </Parchment>
      </div>
    </div>
  );
}

function LoanItem({ item, summary, data, action }: { item: Row; summary?: Row; data: Dashboard; action: ActionFn }) {
  return (
    <div id={entityDomId('finance_debt', String(item.id))} className="ledger-row py-4 transition">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium">{item.name}</div>
            <span className="rounded border px-2 py-0.5 text-xs text-[var(--muted)]">{item.type ?? 'other'}</span>
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            Principal {Number(item.principal).toFixed(2)} · rate {Number(item.interestRate).toFixed(2)}% · EMI {item.emiAmount ? Number(item.emiAmount).toFixed(2) : '-'} · due {item.dueDay ?? '-'}
          </div>
          {summary?.emiWarning ? <div className="mt-2 text-xs text-wax">{summary.emiWarning}</div> : null}
          <div className="mt-2 grid gap-3 text-xs text-[var(--muted)] md:grid-cols-4">
            <div>
              Interest paid <span className="font-medium text-ink">{Number(summary?.totalInterestPaid ?? 0).toFixed(2)}</span>
            </div>
            <div>
              Principal paid <span className="font-medium text-ink">{Number(summary?.totalPrincipalPaid ?? 0).toFixed(2)}</span>
            </div>
            <div>
              Projected payoff <span className="font-medium text-ink">{summary?.projectedPayoffDate ?? '-'}</span>
            </div>
            <div>
              Projected interest <span className="font-medium text-ink">{summary?.projectedRemainingInterest == null ? '-' : Number(summary.projectedRemainingInterest).toFixed(2)}</span>
            </div>
          </div>
          {summary?.hasExtraPayments && summary?.interestSaved != null ? (
            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
              You&apos;ve saved ₹{Number(summary.interestSaved).toLocaleString('en-IN')} in interest by paying extra
            </div>
          ) : null}
        </div>
        <strong className="shrink-0 text-wax">{Number(item.balance).toFixed(2)}</strong>
        <EntityConnections data={data} entityType="finance_debt" entityId={String(item.id)} action={action} compact />
        <button
          className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white"
          onClick={() => {
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
            action('debt.update', {
              id: item.id,
              name,
              balance,
              interestRate,
              tenureMonths,
              emiAmount,
              dueDay,
              loanType: item.type ?? 'other',
            });
          }}
        >
          Edit
        </button>
        <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('debt.delete', { id: item.id, label: 'Loan' })}>
          Delete
        </button>
      </div>
    </div>
  );
}
