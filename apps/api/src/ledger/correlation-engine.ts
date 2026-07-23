import {
  buildEntityLinkGraph,
  entityRefKey,
  traverseEntityLinks,
} from './entity-link-graph';
import type { EntityLinkGraph } from './entity-link-graph';
import type { EntityTypeValue } from './entity-linking';

type Row = Record<string, unknown>;

export interface CorrelationPattern {
  id: string;
  pair: string;
  windowDays: number;
  coefficient: number;
  sampleSize: number;
  effectSize: number;
  sentence: string;
}

export interface CorrelationInput {
  today: Date;
  journals: Row[];
  sleep: Row[];
  diet: Row[];
  weights: Row[];
  sessions: Row[];
  dailyGoals: Row[];
  habits: Row[];
  routineDayLogs?: Row[];
  entityLinks?: Row[];
  goals?: Row[];
  transactions?: Row[];
  habitActivity?: Row[];
}

interface MetricPair {
  id: string;
  label: string;
  xLabel: string;
  yLabel: string;
  x: Map<string, number>;
  y: Map<string, number>;
  minOverlap?: number;
  sentence: (args: SentenceArgs) => string;
}

interface SentenceArgs {
  coefficient: number;
  effectPercent: number;
  windowDays: number;
  sampleSize: number;
}

const WINDOWS = [30, 60, 90];
const MIN_OVERLAP = 14;
const MIN_LINKED_CHAIN_OVERLAP = 60;
const MIN_ABS_CORRELATION = 0.4;

const moodScores: Record<string, number> = {
  Low: 1,
  Tired: 2,
  Restless: 3,
  Steady: 4,
  Strong: 5,
};

export function pearsonCorrelation(points: { x: number; y: number }[]) {
  if (points.length < 2) return null;

  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;

  for (const point of points) {
    const xDiff = point.x - xMean;
    const yDiff = point.y - yMean;
    numerator += xDiff * yDiff;
    xVariance += xDiff * xDiff;
    yVariance += yDiff * yDiff;
  }

  const denominator = Math.sqrt(xVariance * yVariance);
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function computeCorrelationPatterns(
  input: CorrelationInput,
): CorrelationPattern[] {
  const pairs = buildMetricPairs(input);
  const patterns: CorrelationPattern[] = [];

  for (const pair of pairs) {
    for (const windowDays of WINDOWS) {
      const start = addDays(input.today, -(windowDays - 1));
      const points = overlappingPoints(pair.x, pair.y, start, input.today);
      if (points.length < (pair.minOverlap ?? MIN_OVERLAP)) continue;

      const coefficient = pearsonCorrelation(points);
      if (coefficient == null || Math.abs(coefficient) <= MIN_ABS_CORRELATION)
        continue;

      const effectPercent = relativeEffectPercent(points);
      if (!Number.isFinite(effectPercent)) continue;

      patterns.push({
        id: `${pair.id}-${windowDays}`,
        pair: pair.label,
        windowDays,
        coefficient: Number(coefficient.toFixed(3)),
        sampleSize: points.length,
        effectSize: Number(effectPercent.toFixed(1)),
        sentence: pair.sentence({
          coefficient,
          effectPercent,
          windowDays,
          sampleSize: points.length,
        }),
      });
    }
  }

  return patterns
    .sort(
      (a, b) =>
        Math.abs(b.coefficient) - Math.abs(a.coefficient) ||
        b.sampleSize - a.sampleSize,
    )
    .slice(0, 3);
}

function buildMetricPairs(input: CorrelationInput): MetricPair[] {
  const sleepHours = averageByDate(input.sleep, 'logDate', 'hours');
  const mood = scoreByDate(
    input.journals,
    'entryDate',
    (row) => moodScores[String(row.mood)],
  );
  const nextDayMood = shiftSeries(mood, -1);
  const goalCompletion = dailyGoalCompletion(input.dailyGoals);
  const nextDayGoalCompletion = shiftSeries(goalCompletion, -1);
  const protein = averageByDate(input.diet, 'logDate', 'protein');
  const nextWeightChange = nextLoggedWeightChange(input.weights);
  const studyMinutes = sumByDate(input.sessions, 'logDate', 'minutes');
  const habitStreak = habitStreakByDate(input.habits, input.today);
  const nextDayRoutineCompletion = shiftSeries(
    routineCompletionByDate(input.routineDayLogs ?? []),
    -1,
  );

  return [
    {
      id: 'sleep-next-mood',
      label: 'Sleep and next-day mood',
      xLabel: 'sleep hours',
      yLabel: 'next-day mood',
      x: sleepHours,
      y: nextDayMood,
      sentence: ({ coefficient, effectPercent, windowDays, sampleSize }) =>
        `${directionPhrase(coefficient, 'More sleep tends to line up with better next-day mood', 'Shorter sleep tends to line up with better next-day mood')} over the last ${windowDays} days (${sampleSize} matching days, ~${Math.abs(effectPercent).toFixed(0)}% difference between low and high sleep days).`,
    },
    {
      id: 'sleep-habit-completion',
      label: 'Sleep and next-day completion',
      xLabel: 'sleep hours',
      yLabel: 'next-day completion',
      x: sleepHours,
      y: nextDayGoalCompletion,
      sentence: ({ coefficient, effectPercent, windowDays, sampleSize }) =>
        `${directionPhrase(coefficient, 'Higher sleep is associated with better next-day completion', 'Lower sleep is associated with better next-day completion')} over the last ${windowDays} days (${sampleSize} matching days, ~${Math.abs(effectPercent).toFixed(0)}% swing).`,
    },
    {
      id: 'protein-weight-trend',
      label: 'Protein and weight trend',
      xLabel: 'protein',
      yLabel: 'next weight change',
      x: protein,
      y: nextWeightChange,
      sentence: ({ coefficient, effectPercent, windowDays, sampleSize }) =>
        `${directionPhrase(coefficient, 'Higher protein days tend to be followed by higher weight changes', 'Higher protein days tend to be followed by lower weight changes')} over the last ${windowDays} days (${sampleSize} matching days, ~${Math.abs(effectPercent).toFixed(0)}% difference in next logged weight movement).`,
    },
    {
      id: 'study-habit-streak',
      label: 'Study time and habit streak',
      xLabel: 'study minutes',
      yLabel: 'habit streak',
      x: studyMinutes,
      y: habitStreak,
      sentence: ({ coefficient, effectPercent, windowDays, sampleSize }) =>
        `${directionPhrase(coefficient, 'More study time tends to line up with stronger habit streaks', 'Less study time tends to line up with stronger habit streaks')} over the last ${windowDays} days (${sampleSize} matching days, ~${Math.abs(effectPercent).toFixed(0)}% difference).`,
    },
    {
      id: 'sleep-routine-completion',
      label: 'Sleep and next-day routine completion',
      xLabel: 'sleep hours',
      yLabel: 'routine completion',
      x: sleepHours,
      y: nextDayRoutineCompletion,
      sentence: ({ coefficient, effectPercent, windowDays, sampleSize }) =>
        `${directionPhrase(coefficient, 'Higher sleep is associated with stronger next-day routine completion', 'Lower sleep is associated with stronger next-day routine completion')} over the last ${windowDays} days (${sampleSize} matching days, ~${Math.abs(effectPercent).toFixed(0)}% swing).`,
    },
    ...northStarMomentumPairs(input, mood),
  ];
}

function northStarMomentumPairs(
  input: CorrelationInput,
  mood: Map<string, number>,
): MetricPair[] {
  const links = input.entityLinks ?? [];
  if (!links.length || !input.goals?.length) return [];

  const graph = buildEntityLinkGraph(links);
  return input.goals
    .filter((goal) => isNorthStarLevel(goal.level))
    .flatMap((goal): MetricPair[] => {
      const goalId = stringValue(goal.id);
      if (!goalId) return [];

      const momentum = linkedGoalMomentumByDate(input, goalId, graph);
      if (!momentum.size) return [];
      const title = stringValue(goal.title) ?? 'North Star';

      return [
        {
          id: `north-star-momentum-mood-${goalId}`,
          label: `${title} momentum and mood`,
          xLabel: 'linked-chain momentum',
          yLabel: 'mood',
          x: momentum,
          y: mood,
          minOverlap: MIN_LINKED_CHAIN_OVERLAP,
          sentence: ({ coefficient, effectPercent, windowDays, sampleSize }) =>
            `${directionPhrase(coefficient, `More activity across the links supporting "${title}" tends to line up with better mood`, `Less activity across the links supporting "${title}" tends to line up with better mood`)} over the last ${windowDays} days (${sampleSize} matching days, ~${Math.abs(effectPercent).toFixed(0)}% difference).`,
        },
      ];
    });
}

/**
 * Builds a daily activity series from the full entity-link component reachable
 * from a goal. It intentionally treats links as undirected and de-duplicates
 * events, so reverse-stored links, duplicate paths, and cycles do not inflate
 * momentum.
 */
export function linkedGoalMomentumByDate(
  input: CorrelationInput,
  goalId: string,
  existingGraph?: EntityLinkGraph,
) {
  const graph = existingGraph ?? buildEntityLinkGraph(input.entityLinks ?? []);
  const connected = traverseEntityLinks({ type: 'goal', id: goalId }, graph);
  const reachable = new Set(connected.map(entityRefKey));
  const momentum = new Map<string, number>();
  const countedEvents = new Set<string>();

  const isReachable = (type: EntityTypeValue, id: unknown) => {
    const parsedId = stringValue(id);
    return parsedId
      ? reachable.has(entityRefKey({ type, id: parsedId }))
      : false;
  };
  const record = (
    eventType: string,
    eventId: string,
    date: unknown,
    value: number,
  ) => {
    const day = dateKey(date);
    if (!day || !Number.isFinite(value)) return;
    const eventKey = `${eventType}:${eventId}:${day}`;
    if (countedEvents.has(eventKey)) return;
    countedEvents.add(eventKey);
    momentum.set(day, (momentum.get(day) ?? 0) + Math.max(0, value));
  };

  const goalRows = uniqueRowsById([
    ...(input.goals ?? []),
    ...input.dailyGoals,
  ]);
  goalRows.forEach((goal, index) => {
    if (!isReachable('goal', goal.id)) return;
    const date = goal.entryDate ?? goal.targetDate;
    if (!date) return;
    record(
      'goal',
      stringValue(goal.id) ?? String(index),
      date,
      goal.completed ? 1 : 0,
    );
  });

  input.journals.forEach((journal, index) => {
    if (!isReachable('journal_entry', journal.id)) return;
    record(
      'journal',
      stringValue(journal.id) ?? String(index),
      journal.entryDate,
      1,
    );
  });

  input.sessions.forEach((session, index) => {
    if (!isReachable('learning_skill', session.skillId)) return;
    record(
      'learning-session',
      stringValue(session.id) ?? String(index),
      session.logDate,
      1,
    );
  });

  (input.transactions ?? []).forEach((transaction, index) => {
    if (
      !isReachable('finance_transaction', transaction.id) ||
      (transaction.status &&
        String(transaction.status).toLowerCase() !== 'confirmed')
    ) {
      return;
    }
    record(
      'finance-transaction',
      stringValue(transaction.id) ?? String(index),
      transaction.transactionDate,
      1,
    );
  });

  (input.routineDayLogs ?? []).forEach((log, index) => {
    if (!isReachable('routine', log.routineId)) return;
    const completion =
      log.completionPct == null ? null : toNumber(log.completionPct);
    if (completion == null) return;
    record(
      'routine-day',
      stringValue(log.id) ??
        `${stringValue(log.routineId) ?? 'routine'}:${String(index)}`,
      log.logDate,
      Math.min(100, Math.max(0, completion)) / 100,
    );
  });

  if (input.habitActivity) {
    input.habitActivity.forEach((activity, index) => {
      if (!isReachable('habit', activity.habitId)) return;
      const date =
        activity.checkinDate ??
        activity.logDate ??
        activity.completedOn ??
        activity.entryDate;
      record(
        'habit-activity',
        stringValue(activity.id) ?? String(index),
        date,
        habitActivityValue(activity),
      );
    });
  } else {
    input.habits.forEach((habit, index) => {
      if (!isReachable('habit', habit.id)) return;
      const streak = Math.max(
        0,
        Math.floor(toNumber(habit.currentStreak) ?? 0),
      );
      const lastCheckin = parseOptionalDate(habit.lastCheckin);
      if (!lastCheckin) return;
      for (let offset = 0; offset < streak; offset += 1) {
        record(
          'habit-streak',
          `${stringValue(habit.id) ?? String(index)}:${offset}`,
          addDays(lastCheckin, -offset),
          1,
        );
      }
    });
  }

  return momentum;
}

function overlappingPoints(
  x: Map<string, number>,
  y: Map<string, number>,
  start: Date,
  end: Date,
) {
  const points: { x: number; y: number }[] = [];
  for (const [date, xValue] of x) {
    const current = parseDate(date);
    const yValue = y.get(date);
    if (current < start || current > end || yValue == null) continue;
    if (Number.isFinite(xValue) && Number.isFinite(yValue)) {
      points.push({ x: xValue, y: yValue });
    }
  }
  return points;
}

function relativeEffectPercent(points: { x: number; y: number }[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const bucketSize = Math.max(3, Math.floor(sorted.length * 0.33));
  const low = sorted.slice(0, bucketSize);
  const high = sorted.slice(-bucketSize);
  const lowAverage = average(low.map((point) => point.y));
  const highAverage = average(high.map((point) => point.y));
  const baseline = Math.max(Math.abs(lowAverage), 0.001);
  return ((highAverage - lowAverage) / baseline) * 100;
}

function dailyGoalCompletion(rows: Row[]) {
  const grouped = new Map<string, { total: number; completed: number }>();
  for (const row of rows) {
    const date = dateKey(row.entryDate ?? row.targetDate);
    if (!date) continue;
    const current = grouped.get(date) ?? { total: 0, completed: 0 };
    current.total += 1;
    current.completed += row.completed ? 1 : 0;
    grouped.set(date, current);
  }
  return new Map(
    [...grouped].map(([date, value]) => [
      date,
      value.total ? value.completed / value.total : 0,
    ]),
  );
}

function nextLoggedWeightChange(rows: Row[]) {
  const sorted = rows
    .map((row) => ({
      date: dateKey(row.logDate),
      weight: toNumber(row.weight),
    }))
    .filter(
      (row): row is { date: string; weight: number } =>
        Boolean(row.date) && row.weight != null,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const result = new Map<string, number>();
  for (let index = 0; index < sorted.length - 1; index += 1) {
    result.set(
      sorted[index].date,
      sorted[index + 1].weight - sorted[index].weight,
    );
  }
  return result;
}

function habitStreakByDate(rows: Row[], today: Date) {
  const result = new Map<string, number>();
  for (const habit of rows) {
    const streak = Math.max(0, Math.floor(toNumber(habit.currentStreak) ?? 0));
    const lastCheckin = parseOptionalDate(habit.lastCheckin) ?? today;
    for (let offset = 0; offset < streak; offset += 1) {
      const date = dateKey(addDays(lastCheckin, -offset));
      if (!date) continue;
      result.set(date, (result.get(date) ?? 0) + 1);
    }
  }
  return result;
}

function routineCompletionByDate(rows: Row[]) {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const date = dateKey(row.logDate);
    const completion = toNumber(row.completionPct);
    if (!date || completion == null) continue;
    grouped.set(date, [...(grouped.get(date) ?? []), completion / 100]);
  }
  return new Map([...grouped].map(([date, values]) => [date, average(values)]));
}

function averageByDate(rows: Row[], dateField: string, valueField: string) {
  return aggregateByDate(
    rows,
    dateField,
    (row) => toNumber(row[valueField]),
    average,
  );
}

function sumByDate(rows: Row[], dateField: string, valueField: string) {
  return aggregateByDate(
    rows,
    dateField,
    (row) => toNumber(row[valueField]),
    (values) => values.reduce((sum, value) => sum + value, 0),
  );
}

function scoreByDate(
  rows: Row[],
  dateField: string,
  scorer: (row: Row) => number | undefined,
) {
  return aggregateByDate(rows, dateField, scorer, average);
}

function aggregateByDate(
  rows: Row[],
  dateField: string,
  valueFor: (row: Row) => number | undefined | null,
  aggregate: (values: number[]) => number,
) {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const date = dateKey(row[dateField]);
    const value = valueFor(row);
    if (!date || value == null || !Number.isFinite(value)) continue;
    grouped.set(date, [...(grouped.get(date) ?? []), value]);
  }
  return new Map(
    [...grouped].map(([date, values]) => [date, aggregate(values)]),
  );
}

function shiftSeries(series: Map<string, number>, days: number) {
  return new Map(
    [...series].map(([date, value]) => [
      dateKey(addDays(parseDate(date), days))!,
      value,
    ]),
  );
}

function directionPhrase(
  coefficient: number,
  positive: string,
  negative: string,
) {
  return coefficient >= 0 ? positive : negative;
}

function isNorthStarLevel(value: unknown) {
  return ['north_star', 'one_year', 'five_year', 'someday', 'life'].includes(
    String(value),
  );
}

function habitActivityValue(row: Row) {
  const completion =
    row.completionPct == null ? null : toNumber(row.completionPct);
  if (completion != null) {
    return Math.min(100, Math.max(0, completion)) / 100;
  }

  const value = row.value == null ? null : toNumber(row.value);
  if (value != null) return Math.max(0, value);
  if (row.completed != null) return row.completed ? 1 : 0;

  const status = String(row.status ?? '').toLowerCase();
  return ['missed', 'not_done', 'skipped'].includes(status) ? 0 : 1;
}

function uniqueRowsById(rows: Row[]) {
  const result: Row[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = stringValue(row.id);
    if (!id || !seen.has(id)) {
      result.push(row);
      if (id) seen.add(id);
    }
  }
  return result;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function dateKey(value: unknown) {
  const date = parseOptionalDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function parseDate(value: string | Date) {
  const parsed =
    typeof value === 'string' ? new Date(`${value}T00:00:00.000Z`) : value;
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return parseDate(value);
  if (typeof value === 'string') return parseDate(value.slice(0, 10));
  return null;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}
