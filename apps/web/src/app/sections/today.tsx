'use client';

import React, { useEffect, useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { moods, colors, moduleOptions } from '@/lib/ledger/constants';
import {
  dateKey,
  financeTotalsForMonth,
  daysLoggedThisWeek,
  moduleCountsByDay,
  studyStreak,
  totalLiabilities,
  navigateTo,
  currentFocusGoal,
  descendantGoalIds,
  dismissedLinkSuggestionKeys,
  goalDefinition,
  routineAppliesNow,
  routineAnchorLabel,
  routineStepTypeLabel,
  routineStepTargetLabel,
  entityDomId,
  focusEntityInView,
  getLinkedEntities,
  listenForEntityNavigation,
  navigateToEntity,
  rememberDismissedLinkSuggestion,
} from '@/lib/ledger/utils';
import { Parchment, Stat, Field, TextArea, ProgressBar, ListItem, Empty } from '@/components/ledger/ui';
import { NavIcon } from '@/components/ledger/nav-icon';
import { Heatmap } from '@/components/ledger/charts';
import { PatternsPanel } from './review';
import { ask } from '@/lib/ledger/utils';
import { EntityConnections } from '@/components/ledger/entity-connections';

type ActionFn = (type: string, payload?: Row) => Promise<boolean>;

export function Today({ data, action, saving }: { data: Dashboard; action: ActionFn; saving: boolean }) {
  const [mood, setMood] = useState(data.journal?.mood ?? 'Steady');
  const [body, setBody] = useState(data.journal?.body ?? '');
  const [focusedJournalId, setFocusedJournalId] = useState('');
  const [dismissedLinkSuggestions, setDismissedLinkSuggestions] = useState<Set<string>>(dismissedLinkSuggestionKeys);
  const [goal, setGoal] = useState('');
  const xpToNext = Math.max((data.stats?.level ?? 1) * 100, 100);
  const xp = data.stats?.xp ?? 0;
  const latestWeight = data.weights.at(-1)?.weight;
  const previousWeight = data.weights.at(-2)?.weight;
  const debtPaidThisMonth = financeTotalsForMonth(data).debtPaid;
  const cycleDaysLeft = data.focusCycle?.endDate ? Math.ceil((new Date(String(data.focusCycle.endDate)).getTime() - new Date(data.today).getTime()) / 86400000) : null;
  const todayGoals = data.goals.filter((item) => item.level === 'daily' && dateKey(item.targetDate) === data.today);

  const pendingIncomes = data.transactions.filter((item) => item.type === 'income' && item.status === 'predicted' && !item.deletedAt);

  const suggestedLearningLinks = (data.linkSuggestions?.journalLearning ?? []).filter((suggestion) => !dismissedLinkSuggestions.has(`journal:${suggestion.journalEntryId}:${suggestion.skillId}`));

  const pendingJournalTarget = typeof window === 'undefined' ? null : data.journalEntries.find((item) => String(item.id) === focusedJournalId);
  const journalHistory = [...data.journalEntries]
    .filter((item) => String(item.id) !== String(data.journal?.id ?? ''))
    .reverse()
    .slice(0, 8);

  // Reminders logic
  const upcomingDates = data.dates
    ?.filter(d => {
      const dateObj = new Date(d.date);
      const today = new Date(data.today);
      dateObj.setFullYear(today.getFullYear());
      if (dateObj.getTime() < today.getTime()) {
        dateObj.setFullYear(today.getFullYear() + 1);
      }
      const diffTime = dateObj.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    })
    .map(d => {
      const dateObj = new Date(d.date);
      const today = new Date(data.today);
      dateObj.setFullYear(today.getFullYear());
      if (dateObj.getTime() < today.getTime()) dateObj.setFullYear(today.getFullYear() + 1);
      const diffDays = Math.ceil((dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const person = data.people?.find(p => p.id === d.personId);
      return { ...d, diffDays, name: person?.name || d.personName };
    })
    .sort((a, b) => a.diffDays - b.diffDays) || [];

  const staleRelationships = (data.people || [])
    .map(p => {
      const personCheckins = (data.checkins || []).filter(c => c.personId === p.id).sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
      if (personCheckins.length === 0) return null;
      const lastCheckinDays = Math.ceil((new Date(data.today).getTime() - new Date(personCheckins[0].weekStart).getTime()) / (1000 * 60 * 60 * 24));
      if (lastCheckinDays > 14) return { ...p, lastCheckinDays };
      return null;
    })
    .filter(Boolean);
  if (pendingJournalTarget && !journalHistory.some((item) => String(item.id) === String(pendingJournalTarget.id)) && String(pendingJournalTarget.id) !== String(data.journal?.id ?? '')) {
    journalHistory.push(pendingJournalTarget);
  }

  useEffect(
    () =>
      listenForEntityNavigation((target) => {
        if (target.entityType !== 'journal_entry') return;
        if (!data.journalEntries.some((item) => String(item.id) === target.entityId)) return;
        setFocusedJournalId(target.entityId);
        focusEntityInView(target);
      }),
    [data.journalEntries],
  );

  return (
    <div className="space-y-5">
      {suggestedLearningLinks.map((suggestion) => {
        const suggestionKey = `journal:${suggestion.journalEntryId}:${suggestion.skillId}`;
        return (
          <div key={suggestionKey} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brass/30 bg-brass/10 p-4 text-ink shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brass/20 text-brass">
                <NavIcon name="bookOpen" className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm">Suggested Link</div>
                <div className="text-xs text-[var(--muted)]">
                  Link the {suggestion.logDate ? dateKey(suggestion.logDate) : 'matching'} journal entry to <span className="font-semibold text-brass">{suggestion.skillName}</span>?
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  action('entityLink.add', {
                    sourceType: 'journal_entry',
                    sourceId: suggestion.journalEntryId,
                    targetType: 'learning_skill',
                    targetId: suggestion.skillId,
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
                  setDismissedLinkSuggestions((current) => {
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
      {pendingIncomes.map((inc) => (
        <div key={inc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-amber-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-200 text-amber-800">
              <NavIcon name="coins" className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm">
                {inc.note?.replace('Predicted income: ', '') || 'Income'} ₹{Number(inc.amount).toLocaleString('en-IN')} expected today
              </div>
              <div className="text-xs text-amber-700">Predicted recurring income for {dateKey(inc.transactionDate)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => action('transaction.confirm', { id: inc.id })}
              className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700 active:scale-95"
            >
              Confirm ✓
            </button>
            <button
              type="button"
              onClick={() => {
                const newAmount = ask('Adjust Income Amount (₹)', String(inc.amount));
                if (!newAmount) return;
                action('transaction.update', {
                  id: inc.id,
                  amount: newAmount,
                  status: 'edited',
                });
              }}
              className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 active:scale-95"
            >
              Edit
            </button>
          </div>
        </div>
      ))}

      {cycleDaysLeft != null && cycleDaysLeft <= 5 ? (
        <div className="rounded-2xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-ink">
          This focus cycle ends in <span className="font-semibold tabular-nums text-brass">{Math.max(cycleDaysLeft, 0)} days</span>. Visit Settings to choose the next North Star when you are ready.
        </div>
      ) : null}

      {(upcomingDates.length > 0 || staleRelationships.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {upcomingDates.map((date, idx) => (
            <div key={`date-${idx}`} className="rounded-2xl border border-indigo-200 bg-indigo-50/50 px-4 py-3 text-sm flex items-center gap-3">
              <span className="text-xl">📅</span>
              <div>
                <div className="font-semibold text-indigo-900">{String((date as any).kind)} in {date.diffDays === 0 ? 'today' : `${date.diffDays} days`}</div>
                <div className="text-xs text-indigo-700/70">For {date.name}</div>
              </div>
            </div>
          ))}
          {staleRelationships.map((person, idx) => (
            <div key={`stale-${idx}`} className="rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm flex items-center gap-3">
              <span className="text-xl">👋</span>
              <div>
                <div className="font-semibold text-amber-900">Haven't checked in with {String((person as any)!.name)} in a while</div>
                <div className="text-xs text-amber-700/70">Last check-in was {person!.lastCheckinDays} days ago</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div id={data.journal?.id ? entityDomId('journal_entry', String(data.journal.id)) : undefined} className="transition">
        <Parchment
          title="Today's Entry"
          eyebrow={new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
          action={data.journal?.id ? <EntityConnections data={data} entityType="journal_entry" entityId={String(data.journal.id)} action={action} /> : undefined}
        >
          <div className="flex flex-wrap gap-2">
            {moods.map((item) => (
              <button
                key={item}
                onClick={() => setMood(item)}
                className={`rounded-xl border px-3 py-1.5 text-sm transition duration-200 active:scale-95 ${mood === item ? 'border-brass bg-brass text-white shadow-sm' : 'hover:border-brass hover:bg-brass/5 hover:text-brass'}`}
              >
                {item}
              </button>
            ))}
          </div>
          <TextArea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write today's entry..." className={body.trim() ? 'mt-4 min-h-36' : 'mt-4'} />
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm italic text-[var(--muted)]">{data.journal ? 'Entry started' : '+10 XP for first entry today'}</span>
            <div className="flex gap-2">
              {data.journal?.id ? (
                <button
                  disabled={saving}
                  className="btn"
                  onClick={() =>
                    action('journal.delete', {
                      id: data.journal?.id,
                      label: 'Journal entry',
                    })
                  }
                >
                  Delete
                </button>
              ) : null}
              <button disabled={saving} className="btn btn-primary" onClick={() => action('journal.save', { mood, body })}>
                Save entry
              </button>
            </div>
          </div>
          {!data.journal?.id ? (
            <div className="mt-4 rounded-xl border border-dashed bg-background/60 px-3 py-2 text-xs text-[var(--muted)]">
              Save the entry once, then use Connections to link it to any goal, habit, routine, skill, or finance record.
            </div>
          ) : null}
        </Parchment>
      </div>

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
          <div className="mt-1 text-xs text-[var(--muted)]">
            {xp}/{xpToNext} XP
          </div>
        </div>
        <div className="stat-card border-l-4 border-l-[#06B6D4] p-5">
          <Stat label="Days logged" value={`${daysLoggedThisWeek(data)}/7`} tone="text-moss" />
        </div>
        <div className="stat-card border-l-4 border-l-wax p-5">
          <Stat
            label={latestWeight && previousWeight ? 'Weight trend' : 'Debt paid'}
            value={
              latestWeight && previousWeight
                ? `${Number(latestWeight) <= Number(previousWeight) ? '↓' : '↑'} ${Math.abs(Number(latestWeight) - Number(previousWeight)).toFixed(1)}`
                : Number(debtPaidThisMonth).toFixed(0)
            }
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

      <div className="grid gap-5 lg:grid-cols-2">
        <PatternsPanel patterns={data.patterns} />

        <Parchment title="Journal History" eyebrow="Recent entries">
          {data.journalEntries.length === 0 ? <Empty tone="ink">No journal entries yet.</Empty> : null}
          {journalHistory.map((item) => (
            <div id={entityDomId('journal_entry', String(item.id))} key={item.id} className="transition">
              <ListItem
                title={`${item.entryDate} · ${item.mood}`}
                note={String(item.body ?? '').slice(0, 120)}
                right={<EntityConnections data={data} entityType="journal_entry" entityId={String(item.id)} action={action} compact />}
                onEdit={() => {
                  const nextBody = ask('Edit journal entry', item.body);
                  if (nextBody != null)
                    action('journal.update', {
                      id: item.id,
                      mood: item.mood,
                      body: nextBody,
                    });
                }}
                onDelete={() =>
                  action('journal.delete', {
                    id: item.id,
                    label: 'Journal entry',
                  })
                }
              />
            </div>
          ))}
        </Parchment>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Parchment title="Today's Goals" eyebrow="Checklist">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (goal.trim())
                action('goal.add', {
                  title: goal.trim(),
                  level: 'daily',
                  targetDate: data.today,
                }).then(() => setGoal(''));
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
              right={
                <div className="flex items-center gap-2">
                  <EntityConnections data={data} entityType="goal" entityId={String(item.id)} action={action} compact />
                  <button className={`btn ${item.completed ? 'check-pop border-moss bg-moss text-white' : ''}`} onClick={() => action('goal.toggle', { id: item.id })}>
                    {item.completed ? 'Undo' : 'Done'}
                  </button>
                </div>
              }
              onEdit={() => {
                const title = ask('Edit daily goal', item.title);
                if (title)
                  action('goal.update', {
                    id: item.id,
                    title,
                    targetDescription: item.targetDescription ?? '',
                    targetDate: item.targetDate ?? data.today,
                  });
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

function TodayRoutines({ data, action }: { data: Dashboard; action: ActionFn }) {
  const routines = data.routineStatuses.filter((routine) => routineAppliesNow(routine.timeAnchor));
  if (data.routines.length === 0) return null;

  const openStepTarget = (step: Row) => {
    if (step.targetType && step.targetId) {
      navigateToEntity(step.targetType, String(step.targetId));
    } else if (step.actionTab === 'Finance') navigateTo('Finance', { financeTab: 'Transactions' });
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
              <div className="flex items-center gap-2">
                <EntityConnections data={data} entityType="routine" entityId={String(routine.id)} action={action} compact />
                <strong className="text-lg tabular-nums text-brass">{routine.completionPct}%</strong>
              </div>
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
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${done ? 'border-moss bg-moss text-white' : 'border-rule bg-background text-transparent'}`}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={done ? 'font-medium line-through decoration-moss/60' : 'font-medium'}>{step.stepName}</span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {routineStepTypeLabel(String(step.stepType))}
                        {targetLabel ? ` · ${targetLabel}` : ''}
                        {step.readOnly && !done ? ' · open to log' : ''}
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
        <p className="mt-3 text-sm leading-6 text-white/86">{pattern ? String(pattern.sentence) : fallback}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/80">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur">Weekly refresh</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur">Private data</span>
        </div>
      </div>
    </section>
  );
}

function ExecutiveSnapshots({ data }: { data: Dashboard }) {
  const weeklyMinutes = data.sessions.filter((row) => new Date(row.logDate).getTime() >= new Date(data.weekStart).getTime()).reduce((sum, row) => sum + Number(row.minutes), 0);
  const habitCompletion = data.habits.length
    ? Math.round((data.habits.filter((row) => row.lastCheckin === data.today || (row.kind === 'break' && row.lastSlip !== data.today)).length / data.habits.length) * 100)
    : 0;
  const latestWeight = data.weights.at(-1)?.weight;
  const cards = [
    {
      label: 'Finance Snapshot',
      value: totalLiabilities(data).toFixed(0),
      note: 'current liabilities',
      icon: 'coins',
      color: '#16A34A',
    },
    {
      label: 'Health Snapshot',
      value: latestWeight ? Number(latestWeight).toFixed(1) : '-',
      note: data.workouts.length ? `${data.workouts.length} workouts logged` : 'no recent workouts',
      icon: 'heart',
      color: '#EF4444',
    },
    {
      label: 'Learning Progress',
      value: `${Math.round(weeklyMinutes / 60)}h`,
      note: `${studyStreak(data)} day study streak`,
      icon: 'book',
      color: '#06B6D4',
    },
    {
      label: 'Habit Progress',
      value: `${habitCompletion}%`,
      note: 'today completion',
      icon: 'repeat',
      color: '#10B981',
    },
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

function CurrentFocusPanel({ data, action }: { data: Dashboard; action: ActionFn }) {
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
          <button type="button" className="btn btn-primary" onClick={() => navigateTo('Settings')}>
            Cycle Settings
          </button>
        </div>
      </section>
    );
  }
  const ids = descendantGoalIds(data, focusGoal.id);
  const weeklyGoals = data.goals.filter((goal) => ids.has(goal.id) && goal.level === 'weekly');
  const activeWeekly = weeklyGoals.find((goal) => !goal.completed) ?? weeklyGoals[0] ?? null;
  const dailyGoals = data.goals.filter((goal) => ids.has(goal.id) && goal.level === 'daily' && dateKey(goal.targetDate) === data.today);
  const linkedHabitIds = new Set(
    [...ids].flatMap((goalId) =>
      getLinkedEntities(data, 'goal', String(goalId))
        .filter((connection) => connection.entityType === 'habit')
        .map((connection) => connection.entityId),
    ),
  );
  const habits = data.habits.filter((habit) => linkedHabitIds.has(String(habit.id)));
  return (
    <section className="parchment overflow-hidden border-t-4 border-t-brass bg-brass/5 p-0">
      <div className="p-5 md:p-6">
        <div className="label-caps mb-2">Current Focus</div>
        <h2 className="text-2xl font-semibold tracking-tight text-brass">{focusGoal.title}</h2>
        {focusGoal.whyThisMatters || goalDefinition(focusGoal) ? <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{String(focusGoal.whyThisMatters ?? goalDefinition(focusGoal))}</p> : null}
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
            ) : (
              <div className="text-sm text-[var(--muted)]">No weekly goal connected yet.</div>
            )}
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
                  {item.completed ? '✓ ' : ''}
                  {item.title}
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
