'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors } from '@/lib/ledger/constants';
import {
  dateKey,
  goalChildren,
  childGoalLevel,
  goalLevelLabel,
  goalPrompt,
  addGoalLabel,
  northStarWhyLine,
  currentFocusGoal,
  descendantGoalIds,
  activeGoals,
  goalProgress,
  financeGoalProgress,
  goalDefinition,
  monthEndDate,
  entityDomId,
  focusEntityInView,
  listenForEntityNavigation,
} from '@/lib/ledger/utils';
import { Parchment, Field, TextArea, Select, ProgressBar, Empty, Modal } from '@/components/ledger/ui';
import { NavIcon } from '@/components/ledger/nav-icon';
import { EntityConnections } from '@/components/ledger/entity-connections';

type ActionFn = (type: string, payload?: Row) => Promise<void>;

function GoalsOverviewDashboard({ data }: { data: Dashboard }) {
  const [progressOpen, setProgressOpen] = useState(false);
  const validGoals = activeGoals(data);
  const totalGoals = validGoals.length;
  const completedGoals = validGoals.filter((g) => g.completed);
  const activeGoalsList = validGoals.filter((g) => !g.completed);
  const completedCount = completedGoals.length;
  const activeCount = activeGoalsList.length;
  const overallRate = totalGoals > 0 ? Math.round((completedCount / totalGoals) * 100) : 0;
  const focusGoal = currentFocusGoal(data);

  const levels = [
    {
      key: 'daily',
      label: 'Daily Goals',
      color: 'text-teal-600',
      barColor: '#14B8A6',
      icon: 'zap',
    },
    {
      key: 'weekly',
      label: 'Weekly Goals',
      color: 'text-emerald-600',
      barColor: '#10B981',
      icon: 'calendarRange',
    },
    {
      key: 'monthly',
      label: 'Monthly Goals',
      color: 'text-indigo-600',
      barColor: '#4338CA',
      icon: 'calendar',
    },
    {
      key: 'north_star',
      label: 'North Star Goals',
      color: 'text-blue-600',
      barColor: '#3B82F6',
      icon: 'target',
    },
  ];

  const levelProgressList = levels.map((lvl) => {
    const matching = validGoals.filter((g) => (lvl.key === 'north_star' ? ['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(String(g.level)) : g.level === lvl.key));
    const total = matching.length;
    const completed = matching.filter((g) => g.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      ...lvl,
      total,
      completed,
      pct,
    };
  });

  return (
    <div className="mb-5 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-rule bg-card p-3.5 shadow-2xs">
          <div className="text-[11px] font-medium text-[var(--muted)]">Total Goals</div>
          <div className="mt-1 text-2xl font-bold text-ink tabular-nums">{totalGoals}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">across 4 levels</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs">
          <div className="text-[11px] font-medium text-emerald-800">Completed Goals</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums">{completedCount}</div>
          <div className="mt-0.5 text-[10px] font-semibold text-emerald-700">{overallRate}% success rate</div>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-3.5 shadow-2xs">
          <div className="text-[11px] font-medium text-indigo-800">Active Goals</div>
          <div className="mt-1 text-2xl font-bold text-indigo-600 tabular-nums">{activeCount}</div>
          <div className="mt-0.5 text-[10px] text-indigo-700">currently in motion</div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-2xs">
          <div className="text-[11px] font-medium text-amber-800">Current Focus Goal</div>
          <div className="mt-1 text-xs font-bold text-amber-900 truncate">{focusGoal ? focusGoal.title : 'None set'}</div>
          <div className="mt-0.5 text-[10px] text-amber-700">First Domino</div>
        </div>
      </div>

      <div className="rounded-2xl border border-rule bg-card shadow-2xs overflow-hidden">
        <button type="button" onClick={() => setProgressOpen((prev) => !prev)} className="flex items-center justify-between w-full p-3 text-left transition hover:bg-slate-50/50">
          <div className="flex items-center gap-2">
            <NavIcon name="chart" className="h-4 w-4 text-brass" />
            <h4 className="text-xs font-bold text-ink">Goal Progress by Level</h4>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[10px] font-semibold text-brass">
              {completedCount} of {totalGoals} Completed
            </span>
            <NavIcon name={progressOpen ? 'chevronUp' : 'chevronDown'} className="h-4 w-4 text-slate-400" />
          </div>
        </button>

        {progressOpen ? (
          <div className="p-3.5 pt-1 border-t border-rule space-y-2.5">
            {levelProgressList.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink flex items-center gap-1.5">
                    <NavIcon name={item.icon} className="h-3.5 w-3.5 text-slate-500" />
                    {item.label}
                  </span>
                  <span className="text-[11px] font-medium text-[var(--muted)] tabular-nums">
                    {item.completed} / {item.total} Done ({item.pct}%)
                  </span>
                </div>
                <ProgressBar value={item.pct} max={100} tone={item.pct === 100 ? colors.moss : colors.brass} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Goals({ data, action }: { data: Dashboard; action: ActionFn }) {
  const [viewMode, setViewModeState] = useState<'tree' | 'graph'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('journal_goals_view_mode');
      if (saved === 'tree' || saved === 'graph') return saved;
    }
    return 'tree';
  });

  const setViewMode = (mode: 'tree' | 'graph') => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('journal_goals_view_mode', mode);
    }
  };

  const allGoalIds = Array.from(new Set(data.goals.map((g) => String(g.id))));
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const focusGoal = currentFocusGoal(data);
    return new Set(focusGoal ? [String(focusGoal.id)] : allGoalIds);
  });

  const roots = goalChildren(data, null);

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(
    () =>
      listenForEntityNavigation((target) => {
        if (target.entityType !== 'goal') return;
        const selectedGoal = data.goals.find((item) => String(item.id) === target.entityId);
        if (!selectedGoal) return;
        setViewModeState('tree');
        window.localStorage.setItem('journal_goals_view_mode', 'tree');
        setExpanded((current) => {
          const next = new Set(current);
          let cursor: Row | undefined = selectedGoal;
          const visited = new Set<string>();
          while (cursor && !visited.has(String(cursor.id))) {
            visited.add(String(cursor.id));
            next.add(String(cursor.id));
            cursor = cursor.parentGoalId ? data.goals.find((item) => String(item.id) === String(cursor?.parentGoalId)) : undefined;
          }
          return next;
        });
        focusEntityInView(target);
      }),
    [data.goals],
  );

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    label: string;
    subCount: number;
  } | null>(null);

  const onRequestDelete = (id: string, level: string) => {
    const subCount = descendantGoalIds(data, String(id)).size - 1;
    setDeleteTarget({ id, label: goalLevelLabel(level), subCount });
  };

  return (
    <div className="space-y-6">
      <Parchment
        title="Goal Tree"
        eyebrow="Goal Setting to the Now: North Star → Monthly → Weekly → Daily"
        action={
          <div className="flex items-center rounded-xl border border-rule bg-card p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${viewMode === 'tree' ? 'bg-brass text-white shadow-xs' : 'text-slate-600 hover:text-ink'}`}
            >
              <NavIcon name="routine" className="h-3.5 w-3.5" /> Tree View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${viewMode === 'graph' ? 'bg-brass text-white shadow-xs' : 'text-slate-600 hover:text-ink'}`}
            >
              <NavIcon name="layers" className="h-3.5 w-3.5" /> Mindmap View
            </button>
          </div>
        }
      >
        <GoalsOverviewDashboard data={data} />

        {viewMode === 'graph' ? (
          <div className="mt-4">
            <GoalGraphDiagram data={data} action={action} onRequestDelete={onRequestDelete} />
          </div>
        ) : (
          <>
            <GoalAddForm data={data} action={action} showLevelSelect />

            {roots.length === 0 ? <Empty tone="moss">No goals added yet. Add a North Star Goal above to build your tree!</Empty> : null}

            <div className="mt-6 space-y-6">
              {roots.map((goal, idx) => (
                <GoalTreeItem
                  key={goal.id}
                  data={data}
                  goal={goal}
                  depth={0}
                  isLast={idx === roots.length - 1}
                  expanded={expanded}
                  toggleExpanded={toggleExpanded}
                  action={action}
                  onRequestDelete={onRequestDelete}
                />
              ))}
            </div>
          </>
        )}
      </Parchment>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.label ?? 'Goal'}`}
        actionText="Delete"
        tone="danger"
        onConfirm={() => {
          if (deleteTarget) {
            action('goal.delete', {
              id: deleteTarget.id,
              label: deleteTarget.label,
            });
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget?.subCount && deleteTarget.subCount > 0
          ? `Are you sure you want to delete this ${deleteTarget.label}? This will also delete all ${deleteTarget.subCount} sub-goal(s) linked underneath it.`
          : `Are you sure you want to delete this ${deleteTarget?.label}?`}
      </Modal>
    </div>
  );
}

function GoalAddForm({ data, action, parentGoal, level: fixedLevel, showLevelSelect = false }: { data: Dashboard; action: ActionFn; parentGoal?: Row; level?: string; showLevelSelect?: boolean }) {
  const initialLevel = fixedLevel ?? 'north_star';
  const [level, setLevel] = useState(initialLevel);
  const [title, setTitle] = useState('');
  const [targetMetric, setTargetMetric] = useState('');
  const [targetDate, setTargetDate] = useState(initialLevel === 'monthly' ? monthEndDate(data.today) : '');
  const [definitionOfDone, setDefinitionOfDone] = useState('');
  const [whyThisMatters, setWhyThisMatters] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(initialLevel));
  const effectiveLevel = fixedLevel ?? level;
  const isNorthStar = ['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(effectiveLevel);
  const parentWhy = ['monthly', 'weekly'].includes(effectiveLevel) ? northStarWhyLine(data, parentGoal) : null;
  const prompt = goalPrompt(effectiveLevel);
  const parentContext = parentGoal ? String(parentGoal.title ?? '') : '';

  const parentOptions = useMemo(() => {
    if (parentGoal) return [];
    if (effectiveLevel === 'monthly') return data.goals.filter((g) => ['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(String(g.level)) && !g.deletedAt);
    if (effectiveLevel === 'weekly') return data.goals.filter((g) => g.level === 'monthly' && !g.deletedAt);
    if (effectiveLevel === 'daily') return data.goals.filter((g) => g.level === 'weekly' && !g.deletedAt);
    return [];
  }, [data.goals, effectiveLevel, parentGoal]);

  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const effectiveParentId = selectedParentId || (parentOptions[0] ? String(parentOptions[0].id) : '');

  const clearDetailsForLevel = (nextLevel: string) => {
    setDetailsOpen(['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(nextLevel));
    setTargetDate(nextLevel === 'monthly' ? monthEndDate(data.today) : '');
    setTargetMetric('');
    setDefinitionOfDone('');
    setWhyThisMatters('');
  };

  const reset = () => {
    setTitle('');
    setTargetMetric('');
    setTargetDate(effectiveLevel === 'monthly' ? monthEndDate(data.today) : '');
    setDefinitionOfDone('');
    setWhyThisMatters('');
    setDetailsOpen(isNorthStar);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        action('goal.add', {
          parentGoalId: parentGoal?.id ?? (effectiveParentId || undefined),
          level: effectiveLevel,
          title: title.trim(),
          targetMetric,
          targetDate,
          definitionOfDone,
          whyThisMatters,
        }).then(reset);
      }}
      className={`${parentGoal ? 'rounded-2xl border border-dashed border-brass/35 bg-brass/5 p-3' : 'mb-5 rounded-2xl border bg-background/60 p-4'}`}
    >
      <div className="mb-3 rounded-2xl border border-brass/20 bg-brass/5 p-4">
        <div className="label-caps mb-2">{isNorthStar ? 'Focusing question' : goalLevelLabel(effectiveLevel)}</div>
        <p className="text-base font-semibold leading-6 text-ink">{prompt}</p>
        {parentContext ? (
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            Parent: <span className="font-medium text-ink">{parentContext}</span>
          </p>
        ) : null}
      </div>

      {showLevelSelect && parentOptions.length > 0 && !parentGoal ? (
        <div className="mb-3 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="font-medium text-ink">Link to Parent Goal:</span>
          <Select value={effectiveParentId} onChange={(e) => setSelectedParentId(e.target.value)} className="text-xs py-1">
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({goalLevelLabel(String(p.level))})
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className={`grid gap-2 ${showLevelSelect ? 'md:grid-cols-[1fr_190px_auto]' : 'md:grid-cols-[1fr_auto]'}`}>
        <Field value={title} onChange={(event) => setTitle(event.target.value)} placeholder={isNorthStar ? 'Answer the focusing question...' : 'Answer with the next ONE thing...'} />
        {showLevelSelect ? (
          <Select
            value={level}
            onChange={(event) => {
              const nextLevel = event.target.value;
              setLevel(nextLevel);
              clearDetailsForLevel(nextLevel);
            }}
          >
            <option value="north_star">North Star Goal</option>
            <option value="monthly">Monthly Goal</option>
            <option value="weekly">Weekly Goal</option>
            <option value="daily">Daily Goal</option>
          </Select>
        ) : null}
        <button className="btn btn-primary">{isNorthStar ? 'Add North Star Goal' : addGoalLabel(effectiveLevel).replace('+ ', '')}</button>
      </div>

      {effectiveLevel !== 'daily' ? (
        <div className="mt-3">
          <button type="button" className="text-sm font-medium text-brass hover:text-brass-deep" onClick={() => setDetailsOpen((open) => !open)}>
            {detailsOpen ? 'Hide detail' : 'Add more detail'}
          </button>
          {detailsOpen ? (
            <GoalSmartFields
              data={data}
              level={effectiveLevel}
              parentGoal={parentGoal}
              targetMetric={targetMetric}
              setTargetMetric={setTargetMetric}
              targetDate={targetDate}
              setTargetDate={setTargetDate}
              definitionOfDone={definitionOfDone}
              setDefinitionOfDone={setDefinitionOfDone}
              whyThisMatters={whyThisMatters}
              setWhyThisMatters={setWhyThisMatters}
              parentWhy={parentWhy}
            />
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function GoalSmartFields({
  level,
  targetMetric,
  setTargetMetric,
  targetDate,
  setTargetDate,
  definitionOfDone,
  setDefinitionOfDone,
  whyThisMatters,
  setWhyThisMatters,
  parentWhy,
}: {
  data: Dashboard;
  level: string;
  parentGoal?: Row;
  targetMetric: string;
  setTargetMetric: (value: string) => void;
  targetDate: string;
  setTargetDate: (value: string) => void;
  definitionOfDone: string;
  setDefinitionOfDone: (value: string) => void;
  whyThisMatters: string;
  setWhyThisMatters: (value: string) => void;
  parentWhy?: string | null;
}) {
  if (level === 'daily') return null;
  const isNorthStar = ['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(level);

  return (
    <div className="mt-3 space-y-3 rounded-2xl border bg-card/70 p-3">
      {parentWhy ? <div className="text-xs leading-5 text-[var(--muted)]">{parentWhy}</div> : null}
      <div className={level === 'weekly' ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Target metric</span>
          <Field
            className="mt-1.5"
            value={targetMetric}
            onChange={(event) => setTargetMetric(event.target.value)}
            placeholder={level === 'weekly' ? 'e.g. 5 key tasks' : level === 'monthly' ? 'e.g. Complete project milestone' : 'e.g. Key milestone / metric target'}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Target Date / Horizon</span>
          <Field className="mt-1.5" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        </label>
      </div>
      {isNorthStar || level === 'monthly' ? (
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Definition of done</span>
          <Field className="mt-1.5" value={definitionOfDone} onChange={(event) => setDefinitionOfDone(event.target.value)} placeholder="What specifically counts as achieved?" />
        </label>
      ) : null}
      {isNorthStar ? (
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Why this matters</span>
          <TextArea className="mt-1.5 min-h-24" value={whyThisMatters} onChange={(event) => setWhyThisMatters(event.target.value)} placeholder="The reminder you want to see when motivation dips..." />
        </label>
      ) : null}
    </div>
  );
}

function GoalEditForm({ data, goal, action, onCancel, onRequestDelete }: { data: Dashboard; goal: Row; action: ActionFn; onCancel: () => void; onRequestDelete: (id: string, level: string) => void }) {
  const level = String(goal.level);
  const parentGoal = goal.parentGoalId ? data.goals.find((item) => item.id === goal.parentGoalId) : undefined;
  const [title, setTitle] = useState(String(goal.title ?? ''));
  const [targetMetric, setTargetMetric] = useState(String(goal.targetMetric ?? ''));
  const [targetDate, setTargetDate] = useState(goal.targetDate ? dateKey(goal.targetDate) : '');
  const [definitionOfDone, setDefinitionOfDone] = useState(goalDefinition(goal));
  const [whyThisMatters, setWhyThisMatters] = useState(String(goal.whyThisMatters ?? ''));
  const parentWhy = ['monthly', 'weekly'].includes(level) ? northStarWhyLine(data, parentGoal) : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        action('goal.update', {
          id: goal.id,
          title: title.trim(),
          targetMetric,
          targetDate,
          definitionOfDone,
          whyThisMatters,
        }).then(onCancel);
      }}
      className="mt-4 rounded-2xl border bg-background/60 p-3"
    >
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <Field value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Goal title" />
        <button className="btn btn-primary">Save</button>
        <button
          type="button"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 hover:border-red-300"
          onClick={() => {
            onRequestDelete(String(goal.id), level);
            onCancel();
          }}
        >
          Delete
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {level !== 'daily' ? (
        <GoalSmartFields
          data={data}
          level={level}
          parentGoal={parentGoal}
          targetMetric={targetMetric}
          setTargetMetric={setTargetMetric}
          targetDate={targetDate}
          setTargetDate={setTargetDate}
          definitionOfDone={definitionOfDone}
          setDefinitionOfDone={setDefinitionOfDone}
          whyThisMatters={whyThisMatters}
          setWhyThisMatters={setWhyThisMatters}
          parentWhy={parentWhy}
        />
      ) : null}
    </form>
  );
}

function GoalTreeItem({
  data,
  goal,
  depth = 0,
  isLast = false,
  expanded,
  toggleExpanded,
  action,
  onRequestDelete,
}: {
  data: Dashboard;
  goal: Row;
  depth?: number;
  isLast?: boolean;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  action: ActionFn;
  onRequestDelete: (id: string, level: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const children = goalChildren(data, goal.id);
  const isOpen = expanded.has(String(goal.id));
  const nextLevel = childGoalLevel(String(goal.level));
  const canComplete = true;
  const financeProgress = financeGoalProgress(data, goal);
  const progress = goalProgress(data, goal.id);
  const progressPct = financeProgress?.pct ?? (progress.total ? Math.round((progress.complete / progress.total) * 100) : 0);
  const isNorthStarGoal = ['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(String(goal.level));
  const hasProgress = Boolean(financeProgress) || (['north_star', 'one_year', 'five_year', 'someday', 'life', 'monthly'].includes(String(goal.level)) && progress.total > 0);
  const definition = goalDefinition(goal);
  const parentWhy = ['monthly', 'weekly'].includes(String(goal.level)) ? northStarWhyLine(data, goal) : null;

  const levelTheme = {
    north_star: {
      label: 'North Star Goal',
      icon: 'target',
      bg: 'bg-blue-600 text-white',
      card: 'border-blue-200 bg-gradient-to-r from-blue-50/50 via-card to-card shadow-2xs',
    },
    one_year: {
      label: 'North Star Goal',
      icon: 'target',
      bg: 'bg-blue-600 text-white',
      card: 'border-blue-200 bg-gradient-to-r from-blue-50/50 via-card to-card shadow-2xs',
    },
    five_year: {
      label: 'North Star Goal',
      icon: 'target',
      bg: 'bg-blue-600 text-white',
      card: 'border-blue-200 bg-gradient-to-r from-blue-50/50 via-card to-card shadow-2xs',
    },
    someday: {
      label: 'North Star Goal',
      icon: 'target',
      bg: 'bg-blue-600 text-white',
      card: 'border-blue-200 bg-gradient-to-r from-blue-50/50 via-card to-card shadow-2xs',
    },
    life: {
      label: 'North Star Goal',
      icon: 'target',
      bg: 'bg-blue-600 text-white',
      card: 'border-blue-200 bg-gradient-to-r from-blue-50/50 via-card to-card shadow-2xs',
    },
    monthly: {
      label: 'Monthly Goal',
      icon: 'calendar',
      bg: 'bg-[#4338CA] text-white',
      card: 'border-indigo-200 bg-card',
    },
    weekly: {
      label: 'Weekly Goal',
      icon: 'calendarRange',
      bg: 'bg-emerald-600 text-white',
      card: 'border-emerald-200 bg-card',
    },
    daily: {
      label: 'Daily Goal',
      icon: 'zap',
      bg: 'bg-teal-600 text-white',
      card: 'border-teal-200 bg-card',
    },
  }[String(goal.level)] ?? {
    label: String(goal.level),
    icon: 'target',
    bg: 'bg-slate-600 text-white',
    card: 'border-rule bg-card',
  };

  return (
    <div id={entityDomId('goal', String(goal.id))} className="relative transition">
      {depth > 0 && (
        <div className="absolute -left-5 top-5 h-full w-5 pointer-events-none">
          <div className="absolute left-0 top-0 h-4 w-4 rounded-bl-xl border-b-2 border-l-2 border-slate-300" />
          {!isLast && <div className="absolute left-0 top-4 bottom-0 w-0.5 bg-slate-300" />}
        </div>
      )}

      <div className={`relative rounded-2xl border p-4 transition duration-200 hover:shadow-md ${levelTheme.card}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {nextLevel ? (
              <button
                type="button"
                onClick={() => toggleExpanded(String(goal.id))}
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-brass hover:text-white active:scale-95"
                title={isOpen ? 'Collapse branch' : 'Expand branch'}
              >
                <span className="text-xs font-bold">{isOpen ? '▼' : '▲'}</span>
              </button>
            ) : (
              <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${levelTheme.bg}`}>
                  <NavIcon name={levelTheme.icon} className="h-3 w-3" />
                  {levelTheme.label}
                </span>
                {goal.targetDate ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 font-mono">Due {dateKey(goal.targetDate)}</span> : null}
              </div>

              <h3 className={`mt-1.5 text-base font-semibold leading-snug text-ink ${goal.completed ? 'line-through text-slate-400' : ''}`}>
                {canComplete && goal.completed ? <span className="mr-1 text-moss">✓</span> : null}
                {goal.title}
              </h3>

              {goal.targetMetric ? (
                <div className="mt-1 text-xs text-slate-500">
                  Target: <strong className="text-slate-700">{String(goal.targetMetric)}</strong>
                </div>
              ) : null}

              {hasProgress ? (
                <div className="mt-2.5 max-w-sm">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span>
                      {financeProgress
                        ? `${financeProgress.complete.toFixed(0)}/${financeProgress.total.toFixed(0)} ${financeProgress.label}`
                        : `${progress.complete}/${progress.total} actions completed`}
                    </span>
                    <span className="tabular-nums font-semibold">{progressPct}%</span>
                  </div>
                  <ProgressBar value={progressPct} max={100} tone={progressPct === 100 ? colors.moss : colors.brass} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {nextLevel ? (
              <button
                type="button"
                onClick={() => {
                  if (!isOpen) toggleExpanded(String(goal.id));
                  setAddingChild((prev) => !prev);
                }}
                className="rounded-xl border border-brass/30 bg-brass/10 px-2.5 py-1 text-xs font-semibold text-brass transition hover:bg-brass hover:text-white active:scale-95"
              >
                + {goalLevelLabel(nextLevel)}
              </button>
            ) : null}

            {canComplete ? (
              <button type="button" className={`btn text-xs px-3 py-1 ${goal.completed ? 'check-pop border-moss bg-moss text-white' : ''}`} onClick={() => action('goal.toggle', { id: goal.id })}>
                {goal.completed ? 'Done ✓' : 'Mark Done'}
              </button>
            ) : null}

            <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brass transition" onClick={() => setEditing((prev) => !prev)} title="Edit goal">
              ✎
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50/70 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100 hover:border-red-300 active:scale-95"
              onClick={() => onRequestDelete(String(goal.id), String(goal.level))}
              title={`Delete ${goalLevelLabel(String(goal.level))}`}
            >
              <span>✕</span> Delete
            </button>
          </div>
        </div>

        {editing ? <GoalEditForm data={data} goal={goal} action={action} onCancel={() => setEditing(false)} onRequestDelete={onRequestDelete} /> : null}

        {isOpen && !editing ? (
          <div>
            {definition || goal.whyThisMatters || parentWhy ? (
              <div className="mt-3 space-y-1.5 border-t pt-2.5 text-xs text-[var(--muted)]">
                {definition && ['north_star', 'one_year', 'five_year', 'someday', 'life', 'monthly'].includes(String(goal.level)) ? (
                  <div>
                    <span className="font-semibold text-ink">Done when:</span> {definition}
                  </div>
                ) : null}
                {goal.whyThisMatters && isNorthStarGoal ? (
                  <div>
                    <span className="font-semibold text-ink">Why it matters:</span> {String(goal.whyThisMatters)}
                  </div>
                ) : null}
                {parentWhy ? <div>{parentWhy}</div> : null}
              </div>
            ) : null}
            <EntityConnections data={data} entityType="goal" entityId={String(goal.id)} action={action} />
          </div>
        ) : null}

        {addingChild && nextLevel ? (
          <div className="mt-3 border-t pt-3">
            <GoalAddForm data={data} action={action} parentGoal={goal} level={nextLevel} />
          </div>
        ) : null}
      </div>

      {isOpen && children.length > 0 && (
        <div className="relative mt-3 ml-5 space-y-3 border-l-2 border-slate-200 pl-5">
          {children.map((child, idx) => (
            <GoalTreeItem
              key={child.id}
              data={data}
              goal={child}
              depth={depth + 1}
              isLast={idx === children.length - 1}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              action={action}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalGraphDiagram({ data, action, onRequestDelete }: { data: Dashboard; action: ActionFn; onRequestDelete: (id: string, level: string) => void }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inlineAddParentId, setInlineAddParentId] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');

  const validGoals = activeGoals(data);

  const northStarGoals = validGoals.filter((g) => ['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(String(g.level)));
  const monthlyGoals = validGoals.filter((g) => g.level === 'monthly');
  const weeklyGoals = validGoals.filter((g) => g.level === 'weekly');
  const dailyGoals = validGoals.filter((g) => g.level === 'daily');

  const selectedGoal = selectedNodeId ? (validGoals.find((g) => String(g.id) === selectedNodeId) ?? null) : null;

  const tiers = [northStarGoals, monthlyGoals, weeklyGoals, dailyGoals].filter((tier) => tier.length > 0);

  const containerWidth = 920;
  const nodeWidth = 170;
  const nodeHeight = 60;
  const rowGap = 85;
  const paddingTop = 35;
  const paddingLeft = 35;

  const nodePositions = new Map<string, { x: number; y: number; goal: Row }>();

  tiers.forEach((tier, tierIdx) => {
    const y = paddingTop + tierIdx * (nodeHeight + rowGap);
    const count = tier.length;
    const totalW = containerWidth - paddingLeft * 2;
    const step = totalW / Math.max(count, 1);

    tier.forEach((goal, itemIdx) => {
      const x = paddingLeft + (itemIdx + 0.5) * step - nodeWidth / 2;
      nodePositions.set(String(goal.id), { x, y, goal });
    });
  });

  const chartHeight = paddingTop * 2 + Math.max(tiers.length, 1) * (nodeHeight + rowGap);

  const connections: Array<{
    id: string;
    parentPos: { x: number; y: number };
    childPos: { x: number; y: number };
    parentId: string;
    childId: string;
  }> = [];

  validGoals.forEach((goal) => {
    let parentId = goal.parentGoalId ? String(goal.parentGoalId) : null;
    if (!parentId) {
      const levelAboveMap: Record<string, string[]> = {
        monthly: ['north_star', 'one_year', 'five_year', 'someday', 'life'],
        weekly: ['monthly'],
        daily: ['weekly'],
      };
      const candidateLevels = levelAboveMap[String(goal.level)] ?? [];
      const candidates = validGoals.filter((g) => candidateLevels.includes(String(g.level)));
      if (candidates.length === 1) {
        parentId = String(candidates[0].id);
      } else if (candidates.length > 1) {
        const childPos = nodePositions.get(String(goal.id));
        if (childPos) {
          let closestCandidate = candidates[0];
          let minDistance = Infinity;
          candidates.forEach((cand) => {
            const candPos = nodePositions.get(String(cand.id));
            if (candPos) {
              const dist = Math.abs(candPos.x - childPos.x);
              if (dist < minDistance) {
                minDistance = dist;
                closestCandidate = cand;
              }
            }
          });
          parentId = String(closestCandidate.id);
        }
      }
    }

    if (parentId) {
      const parentPos = nodePositions.get(parentId);
      const childPos = nodePositions.get(String(goal.id));
      if (parentPos && childPos) {
        connections.push({
          id: `${parentId}->${goal.id}`,
          parentPos: {
            x: parentPos.x + nodeWidth / 2,
            y: parentPos.y + nodeHeight,
          },
          childPos: { x: childPos.x + nodeWidth / 2, y: childPos.y },
          parentId: parentId,
          childId: String(goal.id),
        });
      }
    }
  });

  return (
    <div className="relative w-full overflow-x-auto rounded-2xl border border-rule bg-slate-50/50 p-5 text-ink shadow-2xs">
      <div className="mb-4 flex items-center justify-between border-b border-rule pb-3">
        <div className="flex items-center gap-2">
          <NavIcon name="target" className="h-4 w-4 text-brass" />
          <h4 className="text-xs font-bold text-ink">Mindmap Tree View</h4>
        </div>
        <div className="text-xs text-[var(--muted)]">
          Click <span className="font-bold text-brass">+</span> on any node to add a child goal
        </div>
      </div>

      {selectedGoal ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-2 min-w-0">
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase">Selected</span>
            <span className="font-semibold truncate">{selectedGoal.title}</span>
            <span className="text-amber-700">({goalLevelLabel(String(selectedGoal.level))})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => action('goal.toggle', { id: selectedGoal.id })}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 transition"
            >
              {selectedGoal.completed ? 'Mark Incomplete' : 'Mark Done ✓'}
            </button>
            <button
              type="button"
              onClick={() => {
                onRequestDelete(String(selectedGoal.id), String(selectedGoal.level));
                setSelectedNodeId(null);
              }}
              className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 transition flex items-center gap-1"
            >
              <span>✕</span> Delete {goalLevelLabel(String(selectedGoal.level))}
            </button>
            <button type="button" onClick={() => setSelectedNodeId(null)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:text-ink">
              Deselect
            </button>
          </div>
        </div>
      ) : null}

      {validGoals.length === 0 ? (
        <Empty tone="moss">No goals added yet. Add a North Star Goal to see your mindmap!</Empty>
      ) : (
        <div className="relative min-w-[860px]" style={{ height: `${chartHeight + 20}px` }}>
          <svg className="absolute inset-0 h-full w-full pointer-events-none overflow-visible" viewBox={`0 0 ${containerWidth} ${chartHeight}`}>
            <defs>
              <marker id="graph-arrow-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#94A3B8" />
              </marker>
            </defs>

            {connections.map((conn) => {
              const isHighlighted = selectedNodeId === conn.parentId || selectedNodeId === conn.childId;
              const yMid = conn.parentPos.y + (conn.childPos.y - conn.parentPos.y) / 2;
              const pathD = `M ${conn.parentPos.x} ${conn.parentPos.y} C ${conn.parentPos.x} ${yMid}, ${conn.childPos.x} ${yMid}, ${conn.childPos.x} ${conn.childPos.y}`;

              return (
                <path
                  key={conn.id}
                  d={pathD}
                  fill="none"
                  stroke={isHighlighted ? '#F59E0B' : '#CBD5E1'}
                  strokeWidth={isHighlighted ? 3 : 2}
                  markerEnd="url(#graph-arrow-head)"
                  className="transition-all duration-300"
                />
              );
            })}
          </svg>

          {Array.from(nodePositions.values()).map(({ x, y, goal }) => {
            const isSelected = selectedNodeId === String(goal.id);
            const childLevel = childGoalLevel(String(goal.level));
            const isAddingChild = inlineAddParentId === String(goal.id);
            const levelStyle = {
              north_star: {
                badge: 'bg-blue-600 text-white',
                icon: 'target',
                card: 'border-blue-200 bg-white hover:border-blue-400',
              },
              one_year: {
                badge: 'bg-blue-600 text-white',
                icon: 'target',
                card: 'border-blue-200 bg-white hover:border-blue-400',
              },
              five_year: {
                badge: 'bg-blue-600 text-white',
                icon: 'target',
                card: 'border-blue-200 bg-white hover:border-blue-400',
              },
              someday: {
                badge: 'bg-blue-600 text-white',
                icon: 'target',
                card: 'border-blue-200 bg-white hover:border-blue-400',
              },
              life: {
                badge: 'bg-blue-600 text-white',
                icon: 'target',
                card: 'border-blue-200 bg-white hover:border-blue-400',
              },
              monthly: {
                badge: 'bg-[#4338CA] text-white',
                icon: 'calendar',
                card: 'border-indigo-200 bg-white hover:border-indigo-400',
              },
              weekly: {
                badge: 'bg-emerald-600 text-white',
                icon: 'calendarRange',
                card: 'border-emerald-200 bg-white hover:border-emerald-400',
              },
              daily: {
                badge: 'bg-teal-600 text-white',
                icon: 'zap',
                card: 'border-teal-200 bg-white hover:border-teal-400',
              },
            }[String(goal.level)] ?? {
              badge: 'bg-slate-600 text-white',
              icon: 'target',
              card: 'border-rule bg-white',
            };

            return (
              <React.Fragment key={goal.id}>
                <div
                  onClick={() => setSelectedNodeId((prev) => (prev === String(goal.id) ? null : String(goal.id)))}
                  className={`absolute cursor-pointer rounded-2xl border-2 px-3 py-2 shadow-2xs transition-all duration-200 ${levelStyle.card} ${isSelected ? 'ring-2 ring-brass border-brass scale-105 z-30' : 'z-10'}`}
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${nodeWidth}px`,
                    height: `${nodeHeight}px`,
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider ${levelStyle.badge}`}>
                      <NavIcon name={levelStyle.icon} className="h-2.5 w-2.5" />
                      {goalLevelLabel(String(goal.level))}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          action('goal.toggle', { id: goal.id });
                        }}
                        className={`h-4 w-4 shrink-0 rounded-full border text-[9px] font-bold flex items-center justify-center transition ${goal.completed ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 hover:border-slate-500'}`}
                        title={goal.completed ? 'Mark Incomplete' : 'Mark Done'}
                      >
                        {goal.completed ? '✓' : ''}
                      </button>
                    </div>
                  </div>
                  <div className={`mt-1 truncate text-xs font-semibold leading-tight text-ink ${goal.completed ? 'line-through text-slate-400' : ''}`}>{goal.title}</div>

                  {childLevel ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineAddParentId((prev) => (prev === String(goal.id) ? null : String(goal.id)));
                        setInlineTitle('');
                      }}
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-40 flex h-5 w-5 items-center justify-center rounded-full border border-brass bg-brass text-xs font-bold text-white shadow-xs transition hover:scale-125"
                      title={`Add ${goalLevelLabel(childLevel)} below`}
                    >
                      +
                    </button>
                  ) : null}
                </div>

                {isAddingChild && childLevel ? (
                  <div
                    className="absolute z-50 w-[220px] rounded-2xl border border-rule bg-card p-3 shadow-xl space-y-2"
                    style={{
                      left: `${Math.max(x - 25, 10)}px`,
                      top: `${y + nodeHeight + 12}px`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brass">
                      <span>+ {goalLevelLabel(childLevel)}</span>
                      <button type="button" onClick={() => setInlineAddParentId(null)} className="text-slate-400 hover:text-ink text-xs font-bold">
                        ✕
                      </button>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!inlineTitle.trim()) return;
                        action('goal.add', {
                          parentGoalId: goal.id,
                          level: childLevel,
                          title: inlineTitle.trim(),
                        }).then(() => {
                          setInlineTitle('');
                          setInlineAddParentId(null);
                        });
                      }}
                      className="space-y-2"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        placeholder="Answer with next ONE thing..."
                        className="w-full rounded-xl border border-rule bg-background px-2.5 py-1.5 text-xs text-ink placeholder:text-[var(--muted)] focus:border-brass focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => setInlineAddParentId(null)} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-ink">
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary text-xs py-1 px-2.5">
                          Add Goal
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
