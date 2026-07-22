'use client';

import React, { useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors } from '@/lib/ledger/constants';
import {
  goalLevelLabel,
  routineAnchorLabel,
  routineStepTypeLabel,
  routineStepTargetLabel,
  ask,
} from '@/lib/ledger/utils';
import { Parchment, Stat, Field, Select, ProgressBar, Empty } from '@/components/ledger/ui';

type ActionFn = (type: string, payload?: Row) => Promise<void>;

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

export function Routines({ data, action }: { data: Dashboard; action: ActionFn }) {
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
