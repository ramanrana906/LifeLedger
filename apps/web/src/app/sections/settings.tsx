'use client';

import React, { useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { daysUntil } from '@/lib/ledger/utils';
import { Parchment, Stat, Field, Modal, Empty } from '@/components/ledger/ui';

type ActionFn = (type: string, payload?: Row) => Promise<boolean>;

export function Settings({ data, action }: { data: Dashboard; action: ActionFn }) {
  const lifeGoals = data.goals.filter((goal) => goal.level === 'someday' || goal.level === 'life');
  const [focusGoalId, setFocusGoalId] = useState(String(data.focusCycle?.focusGoalId ?? lifeGoals[0]?.id ?? ''));
  const [focusGoalQuery, setFocusGoalQuery] = useState(() => lifeGoals.find((goal) => goal.id === String(data.focusCycle?.focusGoalId ?? lifeGoals[0]?.id ?? ''))?.title ?? '');
  const [cycleLengthDays, setCycleLengthDays] = useState(String(data.focusCycle?.cycleLengthDays ?? 90));
  const daysLeft = data.focusCycle?.endDate ? daysUntil(String(data.focusCycle.endDate), data.today) : null;
  const focusedGoal = lifeGoals.find((goal) => goal.id === focusGoalId) ?? null;
  const canSave = true;
  const focusGoalFromTitle = (title: string) => lifeGoals.find((goal) => goal.title === title)?.id ?? '';
  const [confirmStartModal, setConfirmStartModal] = useState(false);

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
            onClick={() => setConfirmStartModal(true)}
            type="button"
          >
            Start new cycle
          </button>
        </div>

        <Modal
          isOpen={confirmStartModal}
          onClose={() => setConfirmStartModal(false)}
          title="Start New Focus Cycle"
          actionText="Start Cycle"
          tone="brass"
          onConfirm={() => action('focusCycle.start', { focusGoalId, cycleLengthDays })}
        >
          Start a new focus cycle with this North Star? This will close the current cycle.
        </Modal>
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
