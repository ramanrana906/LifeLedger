'use client';

import React, { useEffect, useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors } from '@/lib/ledger/constants';
import { EntityType, LinkableEntity, entityDomId, focusEntityInView, listenForEntityNavigation, routineAnchorLabel, routineStepTypeLabel, routineStepTargetLabel, ask } from '@/lib/ledger/utils';
import { Parchment, Stat, Field, Select, ProgressBar, Empty } from '@/components/ledger/ui';
import { NavIcon } from '@/components/ledger/nav-icon';
import { EntityConnections } from '@/components/ledger/entity-connections';
import { LinkToPicker } from '@/components/ledger/link-to-picker';

type ActionFn = (type: string, payload?: Row) => Promise<boolean>;

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
  const [routine, setRoutine] = useState({
    name: '',
    timeAnchor: '',
    protected: false,
  });
  const [selectedRoutineId, setSelectedRoutineId] = useState(() => String(data.routines[0]?.id ?? ''));
  const [step, setStep] = useState({
    stepType: 'habit',
    stepName: defaultRoutineStepName('habit'),
  });
  const [stepTarget, setStepTarget] = useState<LinkableEntity | null>(null);
  const [showStepTargetPicker, setShowStepTargetPicker] = useState(false);
  const selectedRoutine = data.routines.find((item) => String(item.id) === selectedRoutineId) ?? data.routines[0] ?? null;
  const selectedStatus = data.routineStatuses.find((item) => String(item.id) === String(selectedRoutine?.id));
  const recentLogs = data.routineDayLogs
    .filter((log) => String(log.routineId) === String(selectedRoutine?.id))
    .slice(-14)
    .reverse();
  const stepAllowedTypes: EntityType[] =
    step.stepType === 'habit' ? ['habit'] : ['daily_goal', 'weekly_goal'].includes(step.stepType) ? ['goal'] : step.stepType === 'learning' ? ['learning_skill'] : [];
  const stepTargetRequired = stepAllowedTypes.length > 0;
  const stepTargetFilter = (candidate: LinkableEntity) => {
    if (step.stepType === 'daily_goal') return candidate.level === 'daily';
    if (step.stepType === 'weekly_goal') return candidate.level === 'weekly';
    return true;
  };

  const addStepPayload = () => {
    const payload: Row = {
      routineId: selectedRoutine?.id,
      stepType: step.stepType,
      stepName: step.stepName.trim() || stepTarget?.title || defaultRoutineStepName(step.stepType),
    };
    if (stepTarget) {
      payload.targetType = stepTarget.entityType;
      payload.targetId = stepTarget.entityId;
    }
    return payload;
  };

  useEffect(
    () =>
      listenForEntityNavigation((target) => {
        if (target.entityType === 'routine') {
          if (!data.routines.some((item) => String(item.id) === target.entityId)) return;
          setSelectedRoutineId(target.entityId);
          focusEntityInView(target);
          return;
        }
        if (target.entityType !== 'routine_step') return;
        const routineWithStep = data.routines.find((item) => (item.steps ?? []).some((routineStep: Row) => String(routineStep.id) === target.entityId));
        if (!routineWithStep) return;
        setSelectedRoutineId(String(routineWithStep.id));
        focusEntityInView(target);
      }),
    [data.routines],
  );

  return (
    <div className="space-y-6">
      <Parchment title="Routines" eyebrow="Ordered checklists">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!routine.name.trim()) return;
            action('routine.add', {
              name: routine.name.trim(),
              timeAnchor: routine.timeAnchor || null,
              protected: routine.protected,
            }).then(() => setRoutine({ name: '', timeAnchor: '', protected: false }));
          }}
          className="mb-5 grid gap-2 md:grid-cols-[1fr_170px_140px_auto]"
        >
          <Field value={routine.name} onChange={(event) => setRoutine({ ...routine, name: event.target.value })} placeholder="Routine name" />
          <Select value={routine.timeAnchor} onChange={(event) => setRoutine({ ...routine, timeAnchor: event.target.value })}>
            <option value="">Anytime</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
            <option value="custom">Custom time</option>
          </Select>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium text-ink">
            <input type="checkbox" checked={routine.protected} onChange={(event) => setRoutine({ ...routine, protected: event.target.checked })} />
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
                id={entityDomId('routine', String(item.id))}
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
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {routineAnchorLabel(item.timeAnchor)} · {(item.steps ?? []).length} steps
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold tabular-nums text-brass">
                    <NavIcon name="flame" className="h-3 w-3" />
                    {status?.streak ?? 0}d
                  </span>
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
          action={
            <div className="flex flex-wrap justify-end gap-2">
              <EntityConnections data={data} entityType="routine" entityId={String(selectedRoutine.id)} action={action} />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const name = ask('Routine name', selectedRoutine.name);
                  if (!name) return;
                  const timeAnchor = ask('Time anchor: morning, afternoon, evening, custom, or blank', selectedRoutine.timeAnchor ?? '');
                  action('routine.update', {
                    id: selectedRoutine.id,
                    name,
                    timeAnchor: timeAnchor || null,
                    protected: Boolean(selectedRoutine.protected),
                  });
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className={`btn ${selectedRoutine.protected ? 'border-brass bg-brass/10 text-brass' : ''}`}
                onClick={() =>
                  action('routine.update', {
                    id: selectedRoutine.id,
                    name: selectedRoutine.name,
                    timeAnchor: selectedRoutine.timeAnchor ?? null,
                    protected: !selectedRoutine.protected,
                  })
                }
              >
                {selectedRoutine.protected ? 'Protected on' : 'Protect'}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  action('routine.delete', {
                    id: selectedRoutine.id,
                    label: 'Routine',
                  })
                }
              >
                Delete
              </button>
            </div>
          }
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
              action('routineStep.add', addStepPayload()).then(() => {
                setStep({
                  stepType: 'habit',
                  stepName: defaultRoutineStepName('habit'),
                });
                setStepTarget(null);
                setShowStepTargetPicker(false);
              });
            }}
            className="mb-5 grid gap-2 border-t pt-5 md:grid-cols-[170px_1fr_1fr_auto]"
          >
            <Select
              value={step.stepType}
              onChange={(event) => {
                const stepType = event.target.value;
                setStep({
                  stepType,
                  stepName: defaultRoutineStepName(stepType),
                });
                setStepTarget(null);
                setShowStepTargetPicker(false);
              }}
            >
              {routineStepTypes.map((type) => (
                <option key={type} value={type}>
                  {routineStepTypeLabel(type)}
                </option>
              ))}
            </Select>
            {step.stepType === 'standalone' ? (
              <Field value={step.stepName} onChange={(event) => setStep({ ...step, stepName: event.target.value })} placeholder="Step label" />
            ) : (
              <div className="flex items-center px-3 py-2 text-sm font-medium text-ink bg-background rounded-xl border border-transparent">
                {defaultRoutineStepName(step.stepType)}
              </div>
            )}
            {stepAllowedTypes.length ? (
              <button
                type="button"
                onClick={() => setShowStepTargetPicker((current) => !current)}
                className="rounded-xl border bg-background px-3 py-2 text-left text-sm text-[var(--muted)] transition hover:border-brass hover:text-brass"
              >
                {stepTarget ? `Target: ${stepTarget.title}` : `Choose ${routineStepTypeLabel(step.stepType).toLowerCase()} target…`}
              </button>
            ) : (
              <div className="rounded-xl border bg-background px-3 py-2 text-sm text-[var(--muted)]">
                {step.stepType === 'finance'
                  ? "Done when today's finance activity exists."
                  : step.stepType === 'journal'
                    ? "Done when today's journal entry has text."
                    : 'Standalone steps are checked inside the routine.'}
              </div>
            )}
            <button className="btn btn-primary" disabled={stepTargetRequired && !stepTarget} title={stepTargetRequired && !stepTarget ? 'Choose a target first' : undefined}>
              Add step
            </button>
            {showStepTargetPicker && stepAllowedTypes.length ? (
              <div className="md:col-span-4">
                <LinkToPicker
                  data={data}
                  sourceType="routine_step"
                  sourceId="draft"
                  allowedTypes={stepAllowedTypes}
                  candidateFilter={stepTargetFilter}
                  heading="Choose step target"
                  onSelect={(_targetType, _targetId, _relationshipType, candidate) => {
                    setStepTarget(candidate);
                    setShowStepTargetPicker(false);
                  }}
                  onClose={() => setShowStepTargetPicker(false)}
                />
              </div>
            ) : null}
          </form>

          {(selectedRoutine.steps ?? []).length === 0 ? <Empty tone="ink">No steps in this routine yet.</Empty> : null}
          <div className="space-y-2">
            {[...(selectedRoutine.steps ?? [])]
              .sort((a, b) => Number(a.orderIndex) - Number(b.orderIndex))
              .map((item: Row, index: number, steps: Row[]) => {
                const targetLabel = routineStepTargetLabel(data, item);
                return (
                  <div id={entityDomId('routine_step', String(item.id))} key={item.id} className="ledger-row py-3 transition">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brass/10 text-xs font-semibold tabular-nums text-brass">{index + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-ink">{item.stepName}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {routineStepTypeLabel(String(item.stepType))}
                          {targetLabel ? ` · ${targetLabel}` : ''}
                        </div>
                      </div>
                      <button
                        className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white disabled:opacity-40"
                        disabled={index === 0}
                        onClick={() =>
                          action('routineStep.move', {
                            id: item.id,
                            direction: 'up',
                          })
                        }
                        type="button"
                      >
                        Up
                      </button>
                      <button
                        className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white disabled:opacity-40"
                        disabled={index === steps.length - 1}
                        onClick={() =>
                          action('routineStep.move', {
                            id: item.id,
                            direction: 'down',
                          })
                        }
                        type="button"
                      >
                        Down
                      </button>
                      <EntityConnections data={data} entityType="routine_step" entityId={String(item.id)} action={action} compact />
                      <button
                        className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white"
                        onClick={() => {
                          const stepName = ask('Step label', item.stepName);
                          if (stepName)
                            action('routineStep.update', {
                              id: item.id,
                              stepName,
                              stepType: item.stepType,
                              targetType: item.targetType ?? null,
                              targetId: item.targetId ?? null,
                            });
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white"
                        onClick={() =>
                          action('routineStep.delete', {
                            id: item.id,
                            label: 'Routine step',
                          })
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
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
