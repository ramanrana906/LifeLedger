'use client';

import React, { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors, gridStroke } from '@/lib/ledger/constants';
import {
  dateKey,
  filterRange,
  financeTransactionsForMonth,
  financeTotalsForMonth,
  expenseBreakdownForMonth,
  transactionTypeLabel,
  totalAssets,
  totalLiabilities,
  debtSeries,
  assetSeries,
  netWorthSeries,
  projectedPayoff,
  goalLevelLabel,
  goalTitle,
  submit,
  ask,
} from '@/lib/ledger/utils';
import { Parchment, SubTabs, Stat, Field, Select, ProgressBar, ListItem, Empty, RangeToggle } from '@/components/ledger/ui';
import { NavIcon } from '@/components/ledger/nav-icon';
import { SvgCanvasTrendChart, ChartTooltip, ChartBox, ChartPlaceholder, AxisLabel } from '@/components/ledger/charts';

type ActionFn = (type: string, payload?: Row) => Promise<void>;

export function Finance({ data, action }: { data: Dashboard; action: ActionFn }) {
  const financeTabs = ['Overview', 'Transactions', 'Income', 'Savings', 'Debts', 'Assets'] as const;
  const [activeFinanceTab, setActiveFinanceTab] = useState<(typeof financeTabs)[number]>(() => {
    if (typeof window === 'undefined') return 'Overview';
    const saved = window.sessionStorage.getItem('life-ledger-finance-tab');
    window.sessionStorage.removeItem('life-ledger-finance-tab');
    return financeTabs.includes(saved as (typeof financeTabs)[number]) ? saved as (typeof financeTabs)[number] : 'Overview';
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
  const incomeSourcesMonthly = data.incomeSources
    .filter((s) => String(s.frequency ?? 'monthly') !== 'one-time')
    .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);
  const monthlyIncome = currentMonthTotals.income > 0 ? currentMonthTotals.income : incomeSourcesMonthly;
  const savingsBalance = Number(data.savings?.balance ?? 0);
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
    <div className="space-y-6">
      <datalist id="finance-goal-options">
        {goalOptions.map((goal) => <option key={goal.id} value={goal.label} />)}
      </datalist>
      <datalist id="finance-transaction-categories">
        {transactionCategories.map((category) => <option key={category} value={category} />)}
      </datalist>

      <Parchment title="Ledger" eyebrow="Summary">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5">
          <Stat label="Monthly income" value={`₹${monthlyIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="text-moss" />
          <Stat label="Savings" value={`₹${savingsBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="text-moss" />
          <Stat label="Assets" value={`₹${totalAssetValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="text-moss" />
          <Stat label="Total debt" value={`₹${totalDebt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="text-wax" />
          <Stat label="Net worth" value={`₹${netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone={netWorth >= 0 ? 'text-brass' : 'text-wax'} />
        </div>
      </Parchment>

      <SubTabs tabs={financeTabs} value={activeFinanceTab} onChange={setActiveFinanceTab} ariaLabel="Finance sections" />

      {/* OVERVIEW */}
      <div className={activeFinanceTab === 'Overview' ? 'space-y-6' : 'hidden'}>
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <Parchment title="Net Worth Growth" eyebrow="Assets minus liabilities" action={<RangeToggle value={range} onChange={setRange} />}>
            <SvgCanvasTrendChart
              data={netWorthData}
              valueKey="netWorth"
              unit="$"
              strokeColor={colors.brass}
              fillGradientId="overviewNetWorthGrad"
              height={210}
            />
          </Parchment>

          <Parchment title="Monthly Cash Mix" eyebrow="Income vs expense vs debt">
            {monthMix.length ? (
              <ChartBox height={210}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={monthMix} innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={4}>
                      {monthMix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartBox>
            ) : <Empty>Add transactions to see this month&apos;s mix.</Empty>}
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
              <button
                type="button"
                onClick={() => setActiveFinanceTab('Transactions')}
                className="text-xs font-semibold text-brass hover:underline"
              >
                View all →
              </button>
            }
          >
            {data.transactions.length === 0 ? <Empty tone="moss">No financial transactions logged yet.</Empty> : null}
            {[...data.transactions].reverse().slice(0, 6).map((item) => (
              <ListItem
                key={item.id}
                title={`${dateKey(item.transactionDate)} · ${item.category ?? 'Other'}`}
                note={item.note || (item.type === 'income' ? 'Income' : item.type === 'debt_payment' ? 'Debt payment' : 'Expense')}
                right={
                  <span className={`font-semibold tabular-nums ${item.type === 'income' ? 'text-moss' : item.type === 'debt_payment' ? 'text-brass' : 'text-wax'}`}>
                    {item.type === 'income' ? '+' : '-'}${Number(item.amount ?? 0).toFixed(2)}
                  </span>
                }
              />
            ))}
          </Parchment>
        </div>
      </div>

      {/* TRANSACTIONS */}
      <div className={activeFinanceTab === 'Transactions' ? 'space-y-6' : 'hidden'}>
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <Parchment title="Add Transaction" eyebrow="Record income, expense, or debt payment">
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
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Date</label>
                  <Field type="date" value={transaction.date} onChange={(event) => setTransaction({ ...transaction, date: event.target.value })} />
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
                        linkedDebtId: type === 'debt_payment' ? transaction.linkedDebtId : '',
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
                  <Field placeholder="0.00" type="number" step="0.01" value={transaction.amount} onChange={(event) => setTransaction({ ...transaction, amount: event.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Category</label>
                  <Select
                    value={transactionCategoryValue}
                    onChange={(event) => setTransaction({ ...transaction, category: event.target.value === '__custom' ? '' : event.target.value })}
                  >
                    {transactionCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    <option value="__custom">Custom category</option>
                  </Select>
                </div>
              </div>

              {transactionCategoryValue === '__custom' ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Custom Category Name</label>
                  <Field placeholder="e.g. Subscriptions, Gifts..." value={transaction.category} onChange={(event) => setTransaction({ ...transaction, category: event.target.value })} />
                </div>
              ) : null}

              {transaction.type === 'debt_payment' ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Linked Loan / Debt</label>
                  <Select value={transaction.linkedDebtId} onChange={(event) => setTransaction({ ...transaction, linkedDebtId: event.target.value })}>
                    <option value="">Select debt obligation</option>
                    {data.debts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </Select>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Note (optional)</label>
                  <Field placeholder="Where or what did you spend on?" value={transaction.note} onChange={(event) => setTransaction({ ...transaction, note: event.target.value })} />
                </div>
                <button className="btn btn-primary shrink-0 px-6 py-2.5">
                  + Save Transaction
                </button>
              </div>
            </form>
          </Parchment>

          <Parchment title="Expenses by Category" eyebrow="This month breakdown">
            {expenseBreakdown.length === 0 ? <Empty tone="moss">Log an expense to see category spending.</Empty> : null}
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
        </div>

        <Parchment title="Transaction History" eyebrow="Filter & search ledger entries">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
            <Select value={transactionFilter.type} onChange={(event) => setTransactionFilter({ ...transactionFilter, type: event.target.value })}>
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="debt_payment">Debt Payment</option>
            </Select>
            <Field list="finance-transaction-categories" placeholder="Category" value={transactionFilter.category} onChange={(event) => setTransactionFilter({ ...transactionFilter, category: event.target.value })} />
            <Field type="date" value={transactionFilter.startDate} onChange={(event) => setTransactionFilter({ ...transactionFilter, startDate: event.target.value })} />
            <Field type="date" value={transactionFilter.endDate} onChange={(event) => setTransactionFilter({ ...transactionFilter, endDate: event.target.value })} />
            <Field placeholder="Search notes..." value={transactionFilter.query} onChange={(event) => setTransactionFilter({ ...transactionFilter, query: event.target.value })} />
          </div>

          {filteredTransactions.length === 0 ? <Empty tone="moss">No transactions match this view.</Empty> : null}
          {filteredTransactions.map((item) => (
            <ListItem
              key={item.id}
              title={`${dateKey(item.transactionDate)} · ${transactionTypeLabel(item.type)} · ${item.category ?? 'Other'}`}
              note={`${item.note ? `${item.note} · ` : ''}${item.linkedDebt?.name ? `Debt: ${item.linkedDebt.name}` : ''}`}
              right={
                <span className={`font-semibold tabular-nums text-sm ${item.type === 'income' ? 'text-moss' : item.type === 'debt_payment' ? 'text-brass' : 'text-wax'}`}>
                  {item.type === 'income' ? '+' : '-'}${Number(item.amount ?? 0).toFixed(2)}
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
      </div>

      {/* INCOME */}
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

      {/* SAVINGS */}
      <div className={activeFinanceTab === 'Savings' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Savings" eyebrow="Balance">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              action('savings.save', {
                balance: savings !== '' ? savings : (data.savings?.balance ?? 0),
                goalAmount: savingsGoal,
                linkedGoalId: savingsGoalQuery ? (goalIdFromLabel(savingsGoalQuery) || null) : (data.savings?.linkedGoalId || null),
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

      {/* DEBTS */}
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

      {/* ASSETS */}
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
          <SvgCanvasTrendChart
            data={netWorthData}
            valueKey="netWorth"
            unit="$"
            strokeColor={colors.brass}
            fillGradientId="netWorthGradient"
            height={210}
          />
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
  action: ActionFn;
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
