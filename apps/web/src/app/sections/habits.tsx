'use client';

import React, { useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors } from '@/lib/ledger/constants';
import { daysBack, goalLevelLabel, goalTitle, submit, ask } from '@/lib/ledger/utils';
import { Parchment, SubTabs, Field, TextArea, Select, ProgressBar, Empty } from '@/components/ledger/ui';
import { NavIcon } from '@/components/ledger/nav-icon';
import { Heatmap } from '@/components/ledger/charts';

type ActionFn = (type: string, payload?: Row) => Promise<void>;

export function Habits({ data, action }: { data: Dashboard; action: ActionFn }) {
  const habitTabs = ['Building', 'Breaking'] as const;
  const [activeHabitTab, setActiveHabitTab] = useState<(typeof habitTabs)[number]>('Building');
  const [habit, setHabit] = useState({ name: '', kind: 'build', linkedGoalId: '', whyThisMatters: '' });
  const [habitGoalQuery, setHabitGoalQuery] = useState('');
  const [expandedHabitId, setExpandedHabitId] = useState('');
  const building = data.habits.filter((item) => item.kind === 'build');
  const breaking = data.habits.filter((item) => item.kind === 'break');
  const currentTime = new Date(data.today).getTime();
  const daysSince = (iso?: string | null) => (iso ? Math.floor((currentTime - new Date(iso).getTime()) / 86400000) : 0);
  const goalOptions = data.goals.map((goal) => ({ id: String(goal.id), label: `${goalLevelLabel(String(goal.level))}: ${goal.title}` }));
  const goalIdFromLabel = (label: string) => goalOptions.find((goal) => goal.label === label)?.id ?? '';
  const goalLabelFromId = (id?: string | null) => goalOptions.find((goal) => goal.id === id)?.label ?? '';
  return (
    <div className="space-y-5">
      <Parchment title="New Habit" eyebrow="Add">
        <form
          onSubmit={(e) => submit(e, () => action('habit.add', { ...habit, linkedGoalId: habit.linkedGoalId || null }).then(() => {
            setHabit({ name: '', kind: 'build', linkedGoalId: '', whyThisMatters: '' });
            setHabitGoalQuery('');
          }))}
          className="grid gap-2 md:grid-cols-[1fr_150px_260px_auto]"
        >
          <Field placeholder="Habit name" value={habit.name} onChange={(e) => setHabit({ ...habit, name: e.target.value })} />
          <Select value={habit.kind} onChange={(e) => setHabit({ ...habit, kind: e.target.value })}><option value="build">Build</option><option value="break">Break</option></Select>
          <Field
            list="habit-goal-options"
            placeholder="Link to a goal (optional)"
            value={habitGoalQuery}
            onChange={(e) => {
              const query = e.target.value;
              setHabitGoalQuery(query);
              setHabit({ ...habit, linkedGoalId: goalIdFromLabel(query) });
            }}
          />
          <datalist id="habit-goal-options">
            {goalOptions.map((goal) => <option key={goal.id} value={goal.label} />)}
          </datalist>
          <button className="btn btn-primary">Add</button>
          <label className="md:col-span-4">
            <span className="text-xs font-medium text-[var(--muted)]">Why this is a standard for me</span>
            <TextArea
              className="mt-1.5 min-h-20"
              placeholder="Optional reflective reminder. Leave blank if this habit is just practical."
              value={habit.whyThisMatters}
              onChange={(event) => setHabit({ ...habit, whyThisMatters: event.target.value })}
            />
          </label>
        </form>
      </Parchment>
      <SubTabs tabs={habitTabs} value={activeHabitTab} onChange={setActiveHabitTab} ariaLabel="Habit sections" />

      <div className={activeHabitTab === 'Building' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Building" eyebrow="Check in daily">
          {building.length === 0 ? <Empty tone="moss">Nothing to build yet.</Empty> : null}
          <div className="space-y-5">
            {building.map((item) => {
              const activeDates = new Set(daysBack(item.lastCheckin ?? data.today, Number(item.currentStreak) || 0));
              const heat = daysBack(data.today, 42).map((date) => ({ date, count: activeDates.has(date) ? 1 : 0 }));
              return (
                <div key={item.id} className="ledger-row pb-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {item.linkedGoalId ? (
                        <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs font-medium text-brass">
                          <NavIcon name="target" className="h-3 w-3" /> {goalTitle(data, String(item.linkedGoalId)) ?? 'Linked goal'}
                        </span>
                      ) : null}
                      {item.whyThisMatters ? (
                        <button
                          type="button"
                          onClick={() => setExpandedHabitId(expandedHabitId === String(item.id) ? '' : String(item.id))}
                          className="mb-1 ml-1 inline-flex items-center gap-1 rounded-full border border-moss/25 bg-moss/10 px-2 py-0.5 text-xs font-medium text-moss"
                        >
                          Standard
                        </button>
                      ) : null}
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-[var(--muted)]">Longest {item.longestStreak}d · last {item.lastCheckin ?? '-'}</div>
                    </div>
                    <strong className="text-brass">{item.currentStreak}d</strong>
                    <Field
                      list="habit-goal-options"
                      defaultValue={goalLabelFromId(item.linkedGoalId)}
                      onBlur={(event) => action('habit.update', { id: item.id, name: item.name, kind: item.kind, linkedGoalId: goalIdFromLabel(event.target.value) || null })}
                      className="max-w-48 text-xs"
                      aria-label="Link habit to goal"
                      placeholder="Link to a goal (optional)"
                    />
                    <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white" onClick={() => {
                      const name = ask('Habit name', item.name);
                      if (!name) return;
                      const whyThisMatters = ask('Why this is a standard for me', item.whyThisMatters ?? '');
                      if (whyThisMatters == null) return;
                      action('habit.update', { id: item.id, name, kind: item.kind, linkedGoalId: item.linkedGoalId ?? null, whyThisMatters });
                    }}>Edit</button>
                    <button className={`btn ${item.lastCheckin === data.today ? 'check-pop border-moss bg-moss text-white' : ''}`} onClick={() => action('habit.checkin', { id: item.id })}>Check in</button>
                    <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('habit.delete', { id: item.id, label: 'Habit' })}>Delete</button>
                  </div>
                  {expandedHabitId === String(item.id) && item.whyThisMatters ? (
                    <div className="mb-4 rounded-2xl border border-moss/20 bg-moss/5 p-3 text-sm leading-6 text-ink">
                      <div className="label-caps mb-1">Standard</div>
                      {String(item.whyThisMatters)}
                    </div>
                  ) : null}
                  <Heatmap days={heat} compact />
                </div>
              );
            })}
          </div>
        </Parchment>
      </div>

      <div className={activeHabitTab === 'Breaking' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Breaking" eyebrow="Days since last slip">
          {breaking.length === 0 ? <Empty tone="wax">No break habits added yet.</Empty> : null}
          {breaking.map((item) => {
            const clean = daysSince(item.lastSlip);
            const best = Math.max(clean, Number(item.longestStreak) || 1);
            return (
              <div key={item.id} className="ledger-row py-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {item.linkedGoalId ? (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-brass/25 bg-brass/10 px-2 py-0.5 text-xs font-medium text-brass">
                        <NavIcon name="target" className="h-3 w-3" /> {goalTitle(data, String(item.linkedGoalId)) ?? 'Linked goal'}
                      </span>
                    ) : null}
                    {item.whyThisMatters ? (
                      <button
                        type="button"
                        onClick={() => setExpandedHabitId(expandedHabitId === String(item.id) ? '' : String(item.id))}
                        className="mb-1 ml-1 inline-flex items-center gap-1 rounded-full border border-moss/25 bg-moss/10 px-2 py-0.5 text-xs font-medium text-moss"
                      >
                        Standard
                      </button>
                    ) : null}
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-[var(--muted)]">Last slip {item.lastSlip ?? '-'}</div>
                  </div>
                  <strong className="text-moss">{clean}d</strong>
                  <Field
                    list="habit-goal-options"
                    defaultValue={goalLabelFromId(item.linkedGoalId)}
                    onBlur={(event) => action('habit.update', { id: item.id, name: item.name, kind: item.kind, linkedGoalId: goalIdFromLabel(event.target.value) || null })}
                    className="max-w-48 text-xs"
                    aria-label="Link habit to goal"
                    placeholder="Link to a goal (optional)"
                  />
                  <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white" onClick={() => {
                    const name = ask('Habit name', item.name);
                    if (!name) return;
                    const whyThisMatters = ask('Why this is a standard for me', item.whyThisMatters ?? '');
                    if (whyThisMatters == null) return;
                    action('habit.update', { id: item.id, name, kind: item.kind, linkedGoalId: item.linkedGoalId ?? null, whyThisMatters });
                  }}>Edit</button>
                  <button className="btn" onClick={() => action('habit.slip', { id: item.id })}>Log slip</button>
                  <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('habit.delete', { id: item.id, label: 'Habit' })}>Delete</button>
                </div>
                {expandedHabitId === String(item.id) && item.whyThisMatters ? (
                  <div className="mb-4 rounded-2xl border border-moss/20 bg-moss/5 p-3 text-sm leading-6 text-ink">
                    <div className="label-caps mb-1">Standard</div>
                    {String(item.whyThisMatters)}
                  </div>
                ) : null}
                <ProgressBar value={clean} max={best} tone={colors.moss} />
                <div className="mt-1 text-xs text-[var(--muted)]">Personal best: {best}d</div>
              </div>
            );
          })}
        </Parchment>
      </div>
    </div>
  );
}
