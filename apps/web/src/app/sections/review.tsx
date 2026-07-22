'use client';

import React, { useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors, fourThieves } from '@/lib/ledger/constants';
import { gridStroke } from '@/lib/ledger/constants';
import { dateKey, debtSeries, daysBack, daysUntil, navigateTo } from '@/lib/ledger/utils';
import { Parchment, Stat, TextArea, ProgressBar, Empty, Field } from '@/components/ledger/ui';
import { SvgCanvasTrendChart, ChartTooltip, SparkBox, ChartPlaceholder } from '@/components/ledger/charts';

type ActionFn = (type: string, payload?: Row) => Promise<void>;

export function Review({ data, action }: { data: Dashboard; action: ActionFn }) {
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
        <Parchment title="Weight Trend" eyebrow="Vector trend line">
          <SvgCanvasTrendChart
            data={data.weights.slice(-14).map((row) => ({ date: row.logDate, weight: Number(row.weight) }))}
            valueKey="weight"
            unit="kg"
            strokeColor={colors.moss}
            fillGradientId="execWeightGrad"
            height={140}
          />
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

export function PatternsPanel({ patterns = [] }: { patterns?: Row[] }) {
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

export function CycleSettings({ data, action }: { data: Dashboard; action: ActionFn }) {
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
