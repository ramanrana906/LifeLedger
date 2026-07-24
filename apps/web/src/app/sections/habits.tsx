'use client';

import React, { useEffect, useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors } from '@/lib/ledger/constants';
import { daysBack, entityDomId, focusEntityInView, listenForEntityNavigation, submit, ask } from '@/lib/ledger/utils';
import { Parchment, SubTabs, Field, TextArea, Select, ProgressBar, Empty, Modal } from '@/components/ledger/ui';
import { Heatmap } from '@/components/ledger/charts';
import { EntityConnections } from '@/components/ledger/entity-connections';
import { LinkToPicker } from '@/components/ledger/link-to-picker';
import { EntityType } from '@/lib/ledger/utils';

type ActionFn = (type: string, payload?: Row) => Promise<boolean>;

export function Habits({ data, action }: { data: Dashboard; action: ActionFn }) {
  const habitTabs = ['Building', 'Breaking'] as const;
  const [activeHabitTab, setActiveHabitTab] = useState<(typeof habitTabs)[number]>('Building');
  const [habit, setHabit] = useState<{
    name: string;
    kind: string;
    whyThisMatters: string;
    frequency: string;
    frequencyCount: string;
    linkedEntity?: { type: string; id: string } | null;
  }>({
    name: '',
    kind: 'build',
    whyThisMatters: '',
    frequency: 'daily',
    frequencyCount: '7',
    linkedEntity: null,
  });
  const [expandedHabitId, setExpandedHabitId] = useState('');
  const building = data.habits.filter((item) => item.kind === 'build');
  const breaking = data.habits.filter((item) => item.kind === 'break');
  const currentTime = new Date(data.today).getTime();
  const daysSince = (iso?: string | null) => (iso ? Math.floor((currentTime - new Date(iso).getTime()) / 86400000) : 0);

  const [slipModal, setSlipModal] = useState<{ id: string; name: string } | null>(null);
  const [slip, setSlip] = useState<{ triggerTags: string[]; note: string }>({ triggerTags: [], note: '' });
  
  const formatFrequency = (item: Row) => {
    const f = String(item.frequency ?? 'daily');
    const c = Number(item.frequencyCount ?? 7);
    if (f === 'daily') return 'Daily';
    if (f === 'weekly') return '1x/week';
    if (f === 'few_times_week') return '3x/week';
    if (f === 'custom') return `${c}x/week`;
    return 'Daily';
  };

  useEffect(
    () =>
      listenForEntityNavigation((target) => {
        if (target.entityType !== 'habit') return;
        const matchedHabit = data.habits.find((item) => String(item.id) === target.entityId);
        if (!matchedHabit) return;
        setActiveHabitTab(matchedHabit.kind === 'break' ? 'Breaking' : 'Building');
        setExpandedHabitId(target.entityId);
        focusEntityInView(target);
      }),
    [data.habits],
  );

  return (
    <div className="space-y-5">
      <Parchment title="New Habit" eyebrow="Add">
        <form
          onSubmit={(e) =>
            submit(e, () =>
              action('habit.add', habit as any).then(() => {
                setHabit({ name: '', kind: 'build', whyThisMatters: '', frequency: 'daily', frequencyCount: '7', linkedEntity: null });
              }),
            )
          }
          className="grid gap-2 md:grid-cols-[1fr_auto_150px_auto]"
        >
          <Field placeholder="Habit name" value={habit.name} onChange={(e) => setHabit({ ...habit, name: e.target.value })} />
          <Select value={habit.frequency} onChange={(e) => setHabit({ ...habit, frequency: e.target.value })}>
            <option value="daily">Daily</option>
            <option value="few_times_week">Few times a week</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </Select>
          <Select value={habit.kind} onChange={(e) => setHabit({ ...habit, kind: e.target.value })}>
            <option value="build">Build</option>
            <option value="break">Break</option>
          </Select>
          <button className="btn btn-primary">Add</button>
          
          {habit.frequency === 'custom' && (
            <div className="md:col-span-4 grid grid-cols-[auto_1fr] items-center gap-2">
              <span className="text-xs font-medium text-[var(--muted)]">Times per week:</span>
              <input type="number" min="1" max="7" value={habit.frequencyCount} onChange={(e) => setHabit({ ...habit, frequencyCount: e.target.value })} className="w-16 rounded border px-2 py-1 text-sm outline-none" />
            </div>
          )}

          <div className="md:col-span-2">
            <span className="text-xs font-medium text-[var(--muted)]">Why this is a standard for me</span>
            <TextArea
              className="mt-1.5 min-h-20"
              placeholder="Optional reflective reminder. Leave blank if this habit is just practical."
              value={habit.whyThisMatters}
              onChange={(event) => setHabit({ ...habit, whyThisMatters: event.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <span className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Link to entity (optional)</span>
            <div className="rounded-2xl border bg-background flex flex-col p-2 min-h-20 justify-center">
              {habit.linkedEntity ? (
                <div className="flex items-center justify-between text-sm px-2">
                  <span className="font-medium text-brass">Linked: {habit.linkedEntity.type}</span>
                  <button type="button" onClick={() => setHabit({ ...habit, linkedEntity: null })} className="text-xs text-[var(--muted)] hover:text-wax">Remove</button>
                </div>
              ) : (
                <LinkToPicker
                  data={data}
                  sourceType="habit"
                  sourceId="new"
                  onSelect={(type, id) => setHabit({ ...habit, linkedEntity: { type, id } })}
                  heading="Link new habit to..."
                />
              )}
            </div>
          </div>
        </form>
      </Parchment>
      <SubTabs tabs={habitTabs} value={activeHabitTab} onChange={setActiveHabitTab} ariaLabel="Habit sections" />

      <div className={activeHabitTab === 'Building' ? 'space-y-5' : 'hidden'}>
        <Parchment title="Building" eyebrow="Check in daily">
          {building.length === 0 ? <Empty tone="moss">Nothing to build yet.</Empty> : null}
          <div className="space-y-5">
            {building.map((item) => {
              const activeDates = new Set(daysBack(item.lastCheckin ?? data.today, Number(item.currentStreak) || 0));
              const heat = daysBack(data.today, 42).map((date) => ({
                date,
                count: activeDates.has(date) ? 1 : 0,
              }));
              return (
                <div id={entityDomId('habit', String(item.id))} key={item.id} className="ledger-row pb-5 transition">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      {item.whyThisMatters ? (
                        <button
                          type="button"
                          onClick={() => setExpandedHabitId(expandedHabitId === String(item.id) ? '' : String(item.id))}
                          className="mb-1 ml-1 inline-flex items-center gap-1 rounded-full border border-moss/25 bg-moss/10 px-2 py-0.5 text-xs font-medium text-moss"
                        >
                          Standard
                        </button>
                      ) : null}
                      <div className="font-medium">{item.name} <span className="ml-2 font-mono text-[10px] bg-background border px-1.5 py-0.5 rounded-md text-[var(--muted)]">{formatFrequency(item)}</span></div>
                      <div className="text-xs text-[var(--muted)]">
                        Longest {item.longestStreak}d · last {item.lastCheckin ?? '-'}
                      </div>
                    </div>
                    <strong className="text-brass">{item.currentStreak}d</strong>
                    <EntityConnections data={data} entityType="habit" entityId={String(item.id)} action={action} compact />
                    <button
                      className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white"
                      onClick={() => {
                        const name = ask('Habit name', item.name);
                        if (!name) return;
                        const whyThisMatters = ask('Why this is a standard for me', item.whyThisMatters ?? '');
                        if (whyThisMatters == null) return;
                        action('habit.update', {
                          id: item.id,
                          name,
                          kind: item.kind,
                          whyThisMatters,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button className={`btn ${item.lastCheckin === data.today ? 'check-pop border-moss bg-moss text-white' : ''}`} onClick={() => action('habit.checkin', { id: item.id })}>
                      Check in
                    </button>
                    <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('habit.delete', { id: item.id, label: 'Habit' })}>
                      Delete
                    </button>
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
              <div id={entityDomId('habit', String(item.id))} key={item.id} className="ledger-row py-4 transition">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {item.whyThisMatters ? (
                      <button
                        type="button"
                        onClick={() => setExpandedHabitId(expandedHabitId === String(item.id) ? '' : String(item.id))}
                        className="mb-1 ml-1 inline-flex items-center gap-1 rounded-full border border-moss/25 bg-moss/10 px-2 py-0.5 text-xs font-medium text-moss"
                      >
                        Standard
                      </button>
                    ) : null}
                    <div className="font-medium">{item.name} <span className="ml-2 font-mono text-[10px] bg-background border px-1.5 py-0.5 rounded-md text-[var(--muted)]">{formatFrequency(item)}</span></div>
                    <div className="text-xs text-[var(--muted)]">Last slip {item.lastSlip ?? '-'}</div>
                  </div>
                  <strong className="text-moss">{clean}d</strong>
                  <EntityConnections data={data} entityType="habit" entityId={String(item.id)} action={action} compact />
                  <button
                    className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white"
                    onClick={() => {
                      const name = ask('Habit name', item.name);
                      if (!name) return;
                      const whyThisMatters = ask('Why this is a standard for me', item.whyThisMatters ?? '');
                      if (whyThisMatters == null) return;
                      action('habit.update', {
                        id: item.id,
                        name,
                        kind: item.kind,
                        whyThisMatters,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button className="btn" onClick={() => setSlipModal({ id: String(item.id), name: String(item.name) })}>
                    Log slip
                  </button>
                  <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={() => action('habit.delete', { id: item.id, label: 'Habit' })}>
                    Delete
                  </button>
                </div>
                {expandedHabitId === String(item.id) && item.whyThisMatters ? (
                  <div className="mb-4 rounded-2xl border border-moss/20 bg-moss/5 p-3 text-sm leading-6 text-ink">
                    <div className="label-caps mb-1">Standard</div>
                    {String(item.whyThisMatters)}
                  </div>
                ) : null}
                
                {expandedHabitId === String(item.id) && data.habitSlips && data.habitSlips.length > 0 ? (
                  <div className="mb-4 text-xs">
                    <div className="label-caps mb-2">Slip Triggers</div>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const habitSlips = data.habitSlips.filter(s => String(s.habitId) === String(item.id));
                        if (habitSlips.length === 0) return <span className="text-[var(--muted)]">No slips logged yet.</span>;
                        const triggers = habitSlips.flatMap(s => s.triggerTags as string[]);
                        if (triggers.length === 0) return <span className="text-[var(--muted)]">No triggers recorded.</span>;
                        const counts = triggers.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
                        return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => (
                          <div key={tag} className="bg-background border rounded px-2 py-1 text-[var(--muted)]">
                            {tag} <span className="font-medium ml-1">— {count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ) : null}

                <ProgressBar value={clean} max={best} tone={colors.moss} />
                <div className="mt-1 text-xs text-[var(--muted)]">Personal best: {best}d</div>
              </div>
            );
          })}
        </Parchment>
      </div>

      <Modal isOpen={!!slipModal} onClose={() => setSlipModal(null)} title="Log a Slip">
        {slipModal && (
          <form
            onSubmit={(e) => {
              submit(e, () =>
                action('habit.slip', { id: slipModal.id, triggerTags: slip.triggerTags, note: slip.note }).then(() => {
                  setSlipModal(null);
                  setSlip({ triggerTags: [], note: '' });
                }),
              );
            }}
            className="space-y-4"
          >
            <div className="text-sm font-medium">What triggered this slip for <span className="text-brass">{slipModal.name}</span>?</div>
            <div className="flex flex-wrap gap-2">
              {['Boredom', 'Stress/Anxiety', 'Social situation', 'Habit/reflex', 'Other'].map(tag => {
                const selected = slip.triggerTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (selected) {
                        setSlip({ ...slip, triggerTags: slip.triggerTags.filter(t => t !== tag) });
                      } else {
                        setSlip({ ...slip, triggerTags: [...slip.triggerTags, tag] });
                      }
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${selected ? 'border-brass bg-brass text-white' : 'border-moss/20 bg-moss/5 text-ink hover:border-moss/50'}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            {slip.triggerTags.includes('Other') && (
              <Field
                placeholder="Specify other trigger or add a note..."
                value={slip.note}
                onChange={(e) => setSlip({ ...slip, note: e.target.value })}
              />
            )}
            <div className="pt-2 flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setSlipModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary bg-wax border-wax">Log slip</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
