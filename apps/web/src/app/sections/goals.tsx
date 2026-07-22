'use client';

import React, { useState, useMemo } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors } from '@/lib/ledger/constants';
import {
  dateKey,
  goalChildren,
  childGoalLevel,
  goalLevelLabel,
  addGoalLabel,
  northStarWhyLine,
  currentFocusGoal,
  goalProgress,
  financeGoalProgress,
  goalDefinition,
  monthEndDate,
} from '@/lib/ledger/utils';
import { Parchment, Field, TextArea, Select, ProgressBar, Empty } from '@/components/ledger/ui';

type ActionFn = (type: string, payload?: Row) => Promise<void>;

export function Goals({ data, action }: { data: Dashboard; action: ActionFn }) {
  const [viewMode, setViewMode] = useState<'tree' | 'graph'>('tree');
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

  const expandAll = () => setExpanded(new Set(allGoalIds));
  const collapseAll = () => setExpanded(new Set());

  const lifeCount = data.goals.filter((g) => g.level === 'life').length;
  const monthlyCount = data.goals.filter((g) => g.level === 'monthly').length;
  const weeklyCount = data.goals.filter((g) => g.level === 'weekly').length;
  const dailyCount = data.goals.filter((g) => g.level === 'daily').length;

  return (
    <div className="space-y-6">
      <Parchment
        title="Goal Tree"
        eyebrow="North Star → Monthly → Weekly → Daily"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-rule bg-card p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  viewMode === 'tree' ? 'bg-brass text-white shadow-xs' : 'text-slate-600 hover:text-ink'
                }`}
              >
                🌳 Outline Tree
              </button>
              <button
                type="button"
                onClick={() => setViewMode('graph')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  viewMode === 'graph' ? 'bg-brass text-white shadow-xs' : 'text-slate-600 hover:text-ink'
                }`}
              >
                🕸️ Flowchart Graph
              </button>
            </div>
            {viewMode === 'tree' ? (
              <>
                <button
                  type="button"
                  onClick={expandAll}
                  className="rounded-xl border border-rule bg-card px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="rounded-xl border border-rule bg-card px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95"
                >
                  Collapse All
                </button>
              </>
            ) : null}
          </div>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border bg-slate-50/60 p-3 text-xs">
          <span className="font-semibold text-slate-600">Tree Hierarchy:</span>
          <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 font-semibold text-white">{lifeCount} North Star</span>
          <span className="text-slate-400">→</span>
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 font-semibold text-indigo-800 border border-indigo-200">{monthlyCount} Monthly</span>
          <span className="text-slate-400">→</span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800 border border-emerald-200">{weeklyCount} Weekly</span>
          <span className="text-slate-400">→</span>
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 font-semibold text-slate-700">{dailyCount} Daily</span>
        </div>

        <GoalAddForm data={data} action={action} showLevelSelect />

        {roots.length === 0 ? <Empty tone="moss">No goals added yet. Add a North Star goal above to build your tree!</Empty> : null}

        {viewMode === 'graph' ? (
          <div className="mt-6">
            <GoalGraphDiagram data={data} action={action} />
          </div>
        ) : (
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
              />
            ))}
          </div>
        )}
      </Parchment>
    </div>
  );
}

function GoalAddForm({
  data,
  action,
  parentGoal,
  level: fixedLevel,
  showLevelSelect = false,
}: {
  data: Dashboard;
  action: ActionFn;
  parentGoal?: Row;
  level?: string;
  showLevelSelect?: boolean;
}) {
  const initialLevel = fixedLevel ?? 'life';
  const [level, setLevel] = useState(initialLevel);
  const [title, setTitle] = useState('');
  const [targetMetric, setTargetMetric] = useState('');
  const [targetDate, setTargetDate] = useState(initialLevel === 'monthly' ? monthEndDate(data.today) : '');
  const [definitionOfDone, setDefinitionOfDone] = useState('');
  const [whyThisMatters, setWhyThisMatters] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(initialLevel === 'life');
  const effectiveLevel = fixedLevel ?? level;
  const parentWhy = ['monthly', 'weekly'].includes(effectiveLevel) ? northStarWhyLine(data, parentGoal) : null;
  const promptByLevel: Record<string, string> = {
    life: "What's the ONE thing you can do such that by doing it, everything else becomes easier or unnecessary?",
    monthly: "What's your one thing this month, given your North Star?",
    weekly: "What's your one thing this week?",
    daily: "What's your one thing today?",
  };
  const prompt = promptByLevel[effectiveLevel] ?? 'What is the next clear goal?';
  const parentContext = parentGoal ? String(parentGoal.title ?? '') : '';

  const parentOptions = useMemo(() => {
    if (parentGoal) return [];
    if (effectiveLevel === 'monthly') return data.goals.filter((g) => g.level === 'life');
    if (effectiveLevel === 'weekly') return data.goals.filter((g) => g.level === 'monthly');
    if (effectiveLevel === 'daily') return data.goals.filter((g) => g.level === 'weekly');
    return [];
  }, [data.goals, effectiveLevel, parentGoal]);

  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const effectiveParentId = selectedParentId || (parentOptions[0] ? String(parentOptions[0].id) : '');

  const clearDetailsForLevel = (nextLevel: string) => {
    setDetailsOpen(nextLevel === 'life');
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
    setDetailsOpen(effectiveLevel === 'life');
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
        <div className="label-caps mb-2">{effectiveLevel === 'life' ? 'Focusing question' : goalLevelLabel(effectiveLevel)}</div>
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
          <Select
            value={effectiveParentId}
            onChange={(e) => setSelectedParentId(e.target.value)}
            className="text-xs py-1"
          >
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({goalLevelLabel(String(p.level))})
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className={`grid gap-2 ${showLevelSelect ? 'md:grid-cols-[1fr_190px_auto]' : 'md:grid-cols-[1fr_auto]'}`}>
        <Field value={title} onChange={(event) => setTitle(event.target.value)} placeholder={effectiveLevel === 'life' ? 'Answer the focusing question...' : 'Answer with the next one thing...'} />
        {showLevelSelect ? (
          <Select value={level} onChange={(event) => {
            const nextLevel = event.target.value;
            setLevel(nextLevel);
            clearDetailsForLevel(nextLevel);
          }}>
            <option value="life">North Star</option>
            <option value="monthly">Monthly milestone</option>
            <option value="weekly">Weekly goal</option>
            <option value="daily">Daily goal</option>
          </Select>
        ) : null}
        <button className="btn btn-primary">{effectiveLevel === 'life' ? 'Add North Star' : addGoalLabel(effectiveLevel).replace('+ ', '')}</button>
      </div>

      {effectiveLevel !== 'daily' ? (
        <div className="mt-3">
          <button
            type="button"
            className="text-sm font-medium text-brass hover:text-brass-deep"
            onClick={() => setDetailsOpen((open) => !open)}
          >
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
  return (
    <div className="mt-3 space-y-3 rounded-2xl border bg-card/70 p-3">
      {parentWhy ? <div className="text-xs leading-5 text-[var(--muted)]">{parentWhy}</div> : null}
      <div className={level === 'weekly' ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}>
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Target metric</span>
          <Field className="mt-1.5" value={targetMetric} onChange={(event) => setTargetMetric(event.target.value)} placeholder={level === 'weekly' ? 'e.g. 5 key tasks' : level === 'monthly' ? 'e.g. Complete project milestone' : 'e.g. Primary target metric'} />
        </label>
        {['life', 'monthly'].includes(level) ? (
          <label className="block">
            <span className="text-xs font-medium text-[var(--muted)]">Deadline</span>
            <Field className="mt-1.5" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
          </label>
        ) : null}
      </div>
      {['life', 'monthly'].includes(level) ? (
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Definition of done</span>
          <Field className="mt-1.5" value={definitionOfDone} onChange={(event) => setDefinitionOfDone(event.target.value)} placeholder="What specifically counts as achieved?" />
        </label>
      ) : null}
      {level === 'life' ? (
        <label className="block">
          <span className="text-xs font-medium text-[var(--muted)]">Why this matters</span>
          <TextArea className="mt-1.5 min-h-24" value={whyThisMatters} onChange={(event) => setWhyThisMatters(event.target.value)} placeholder="The reminder you want to see when motivation dips..." />
        </label>
      ) : null}
    </div>
  );
}

function GoalEditForm({
  data,
  goal,
  action,
  onCancel,
}: {
  data: Dashboard;
  goal: Row;
  action: ActionFn;
  onCancel: () => void;
}) {
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
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <Field value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Goal title" />
        <button className="btn btn-primary">Save</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
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
}: {
  data: Dashboard;
  goal: Row;
  depth?: number;
  isLast?: boolean;
  expanded: Set<string>;
  toggleExpanded: (id: string) => void;
  action: ActionFn;
}) {
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const children = goalChildren(data, goal.id);
  const isOpen = expanded.has(String(goal.id));
  const nextLevel = childGoalLevel(String(goal.level));
  const canComplete = goal.level === 'daily' || goal.level === 'weekly';
  const financeProgress = financeGoalProgress(data, goal);
  const progress = goalProgress(data, goal.id);
  const progressPct = financeProgress?.pct ?? (progress.total ? Math.round((progress.complete / progress.total) * 100) : 0);
  const hasProgress = Boolean(financeProgress) || ((goal.level === 'life' || goal.level === 'monthly') && progress.total > 0);
  const definition = goalDefinition(goal);
  const parentWhy = ['monthly', 'weekly'].includes(String(goal.level)) ? northStarWhyLine(data, goal) : null;

  const levelTheme = {
    life: { label: '🌟 North Star', bg: 'bg-indigo-600 text-white', card: 'border-indigo-300 bg-gradient-to-r from-indigo-50/70 via-card to-purple-50/30 shadow-sm' },
    monthly: { label: '📅 Monthly', bg: 'bg-[#4338CA] text-white', card: 'border-indigo-200 bg-card' },
    weekly: { label: '🗓️ Weekly', bg: 'bg-emerald-600 text-white', card: 'border-emerald-200 bg-card' },
    daily: { label: '🎯 Daily', bg: 'bg-slate-600 text-white', card: 'border-rule bg-card' },
  }[String(goal.level)] ?? { label: String(goal.level), bg: 'bg-slate-600 text-white', card: 'border-rule bg-card' };

  return (
    <div className="relative">
      {depth > 0 && (
        <div className="absolute -left-5 top-5 h-full w-5 pointer-events-none">
          <div className="absolute left-0 top-0 h-4 w-4 rounded-bl-xl border-b-2 border-l-2 border-slate-300" />
          {!isLast && <div className="absolute left-0 top-4 bottom-0 w-0.5 bg-slate-300" />}
        </div>
      )}

      <div className={`relative rounded-2xl border p-4 transition duration-200 hover:shadow-md ${levelTheme.card}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {children.length > 0 || nextLevel ? (
              <button
                type="button"
                onClick={() => toggleExpanded(String(goal.id))}
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-brass hover:text-white active:scale-95"
                title={isOpen ? "Collapse branch" : "Expand branch"}
              >
                <span className={`text-xs font-bold transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
              </button>
            ) : (
              <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${levelTheme.bg}`}>
                  {levelTheme.label}
                </span>
                {goal.targetDate ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 font-mono">
                    Due {dateKey(goal.targetDate)}
                  </span>
                ) : null}
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
                    <span>{financeProgress ? `${financeProgress.complete.toFixed(0)}/${financeProgress.total.toFixed(0)} ${financeProgress.label}` : `${progress.complete}/${progress.total} actions completed`}</span>
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
              <button
                type="button"
                className={`btn text-xs px-3 py-1 ${goal.completed ? 'check-pop border-moss bg-moss text-white' : ''}`}
                onClick={() => action('goal.toggle', { id: goal.id })}
              >
                {goal.completed ? 'Done ✓' : 'Mark Done'}
              </button>
            ) : null}

            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brass transition"
              onClick={() => setEditing((prev) => !prev)}
              title="Edit goal"
            >
              ✎
            </button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
              onClick={() => action('goal.delete', { id: goal.id, label: 'Goal' })}
              title="Delete goal"
            >
              ✕
            </button>
          </div>
        </div>

        {editing ? (
          <GoalEditForm data={data} goal={goal} action={action} onCancel={() => setEditing(false)} />
        ) : null}

        {isOpen && !editing && (definition || goal.whyThisMatters || parentWhy) ? (
          <div className="mt-3 space-y-1.5 border-t pt-2.5 text-xs text-[var(--muted)]">
            {definition && ['life', 'monthly'].includes(String(goal.level)) ? <div><span className="font-semibold text-ink">Done when:</span> {definition}</div> : null}
            {goal.whyThisMatters && goal.level === 'life' ? <div><span className="font-semibold text-ink">Why it matters:</span> {String(goal.whyThisMatters)}</div> : null}
            {parentWhy ? <div>{parentWhy}</div> : null}
          </div>
        ) : null}

        {addingChild && nextLevel ? (
          <div className="mt-3 border-t pt-3">
            <GoalAddForm
              data={data}
              action={action}
              parentGoal={goal}
              level={nextLevel}
            />
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalGraphDiagram({ data, action }: { data: Dashboard; action: ActionFn }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const lifeGoals = data.goals.filter((g) => g.level === 'life');
  const monthlyGoals = data.goals.filter((g) => g.level === 'monthly');
  const weeklyGoals = data.goals.filter((g) => g.level === 'weekly');
  const dailyGoals = data.goals.filter((g) => g.level === 'daily');

  const tiers = [lifeGoals, monthlyGoals, weeklyGoals, dailyGoals].filter((tier) => tier.length > 0);

  if (data.goals.length === 0) {
    return <Empty tone="moss">No goals added yet. Create a North Star goal to see the graph diagram.</Empty>;
  }

  const containerWidth = 920;
  const nodeWidth = 160;
  const nodeHeight = 56;
  const rowGap = 90;
  const paddingTop = 40;
  const paddingLeft = 40;

  const nodePositions = new Map<string, { x: number; y: number; goal: Row }>();

  tiers.forEach((tier, tierIdx) => {
    const y = paddingTop + tierIdx * (nodeHeight + rowGap);
    const count = tier.length;
    const totalW = containerWidth - paddingLeft * 2;
    const step = totalW / count;

    tier.forEach((goal, itemIdx) => {
      const x = paddingLeft + (itemIdx + 0.5) * step - nodeWidth / 2;
      nodePositions.set(String(goal.id), { x, y, goal });
    });
  });

  const chartHeight = paddingTop * 2 + tiers.length * (nodeHeight + rowGap);

  const connections: Array<{
    id: string;
    parentPos: { x: number; y: number };
    childPos: { x: number; y: number };
    parentId: string;
    childId: string;
  }> = [];

  data.goals.forEach((goal) => {
    if (goal.parentGoalId) {
      const parentPos = nodePositions.get(String(goal.parentGoalId));
      const childPos = nodePositions.get(String(goal.id));
      if (parentPos && childPos) {
        connections.push({
          id: `${goal.parentGoalId}->${goal.id}`,
          parentPos: { x: parentPos.x + nodeWidth / 2, y: parentPos.y + nodeHeight },
          childPos: { x: childPos.x + nodeWidth / 2, y: childPos.y },
          parentId: String(goal.parentGoalId),
          childId: String(goal.id),
        });
      }
    }
  });

  return (
    <div className="relative w-full overflow-x-auto rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse" />
          <h4 className="text-sm font-semibold tracking-wide text-slate-200">Flowchart Mindmap Graph</h4>
        </div>
        <div className="text-xs text-slate-400">
          Click any goal node to highlight connection pathways
        </div>
      </div>

      <div className="relative min-w-[860px]" style={{ height: `${chartHeight}px` }}>
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none overflow-visible"
          viewBox={`0 0 ${containerWidth} ${chartHeight}`}
        >
          <defs>
            <marker
              id="graph-arrow-head"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#818CF8" />
            </marker>
            <linearGradient id="curveLineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#818CF8" />
            </linearGradient>
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
                stroke={isHighlighted ? "#F59E0B" : "url(#curveLineGrad)"}
                strokeWidth={isHighlighted ? 3.5 : 2}
                markerEnd="url(#graph-arrow-head)"
                className="transition-all duration-300"
              />
            );
          })}
        </svg>

        {Array.from(nodePositions.values()).map(({ x, y, goal }) => {
          const isSelected = selectedNodeId === String(goal.id);
          const canComplete = goal.level === 'daily' || goal.level === 'weekly';
          const levelColor = {
            life: 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-500/30',
            monthly: 'bg-indigo-700 border-indigo-500 text-white shadow-indigo-500/20',
            weekly: 'bg-emerald-700 border-emerald-500 text-white shadow-emerald-500/20',
            daily: 'bg-slate-800 border-slate-600 text-slate-200 shadow-slate-900/60',
          }[String(goal.level)] ?? 'bg-slate-800 border-slate-600 text-white';

          return (
            <div
              key={goal.id}
              onClick={() => setSelectedNodeId((prev) => (prev === String(goal.id) ? null : String(goal.id)))}
              className={`absolute cursor-pointer rounded-2xl border-2 px-3 py-2.5 shadow-lg transition-all duration-300 hover:scale-105 ${levelColor} ${
                isSelected ? 'ring-4 ring-amber-400 border-amber-300 scale-105 z-30' : 'z-10'
              }`}
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${nodeWidth}px`,
                height: `${nodeHeight}px`,
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[9px] font-bold uppercase tracking-wider opacity-85">
                  {goalLevelLabel(String(goal.level))}
                </span>
                {canComplete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      action('goal.toggle', { id: goal.id });
                    }}
                    className={`h-4 w-4 shrink-0 rounded-full border text-[9px] font-bold flex items-center justify-center transition ${
                      goal.completed ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-400 hover:border-white'
                    }`}
                  >
                    {goal.completed ? '✓' : ''}
                  </button>
                )}
              </div>
              <div className={`mt-1 truncate text-xs font-semibold leading-tight ${goal.completed ? 'line-through opacity-60' : ''}`}>
                {goal.title}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
