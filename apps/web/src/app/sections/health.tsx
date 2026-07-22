'use client';

import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors, gridStroke } from '@/lib/ledger/constants';
import { dateKey, daysBack, filterRange, submit, ask } from '@/lib/ledger/utils';
import { Parchment, SubTabs, Stat, Field, Select, InlineForm, ListItem, Empty, MiniLegend, RangeToggle } from '@/components/ledger/ui';
import { SvgCanvasTrendChart, ChartTooltip, ChartBox, Heatmap, ChartPlaceholder, AxisLabel } from '@/components/ledger/charts';

type ActionFn = (type: string, payload?: Row) => Promise<void>;

export function Health({ data, action }: { data: Dashboard; action: ActionFn }) {
  const healthTabs = ['Weight', 'Diet', 'Workouts', 'Sleep'] as const;
  const [activeHealthTab, setActiveHealthTab] = useState<(typeof healthTabs)[number]>(() => {
    if (typeof window === 'undefined') return 'Weight';
    const saved = window.sessionStorage.getItem('life-ledger-health-tab');
    window.sessionStorage.removeItem('life-ledger-health-tab');
    return healthTabs.includes(saved as (typeof healthTabs)[number]) ? saved as (typeof healthTabs)[number] : 'Weight';
  });
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [range, setRange] = useState(90);
  const [diet, setDiet] = useState({ calories: data.diet?.calories ?? '', protein: data.diet?.protein ?? '' });
  const [workout, setWorkout] = useState({ exercise: '', sets: '', reps: '', weight: '' });
  const unit = data.profile?.unitsWeight ?? 'kg';
  const latest = data.weights.at(-1)?.weight;
  const goal = data.profile?.goalWeight;
  const weightData = filterRange(data.weights, 'logDate', range, data.today).map((row) => ({ date: row.logDate, weight: Number(row.weight) }));
  const dietByDate = new Map(data.dietLogs.map((row) => [dateKey(row.logDate), row]));
  const dietBars = daysBack(data.today, 14).map((date) => ({
    date,
    calories: Number(dietByDate.get(date)?.calories ?? 0),
    protein: Number(dietByDate.get(date)?.protein ?? 0),
  }));
  const workoutCounts = new Map<string, number>();
  data.workouts.forEach((row) => workoutCounts.set(dateKey(row.logDate), (workoutCounts.get(dateKey(row.logDate)) ?? 0) + 1));
  const workoutHeat = daysBack(data.today, 90).map((date) => ({ date, count: workoutCounts.get(date) ?? 0 }));
  const startWeight = weightData[0]?.weight;
  const currentWeight = weightData.at(-1)?.weight;

  return (
    <div className="space-y-6">
      <SubTabs tabs={healthTabs} value={activeHealthTab} onChange={setActiveHealthTab} ariaLabel="Health sections" />

      {activeHealthTab === 'Weight' ? (
      <Parchment title="Weight" eyebrow="Trend toward goal" action={<RangeToggle value={range} onChange={setRange} />}>
        <div className="mb-5 grid grid-cols-3 gap-6">
          <Stat label="Current" value={latest ? `${latest} ${unit}` : '-'} />
          <Stat label="Goal" value={goal ? `${goal} ${unit}` : '-'} tone="text-brass" />
          <Stat label="Delta" value={latest && goal ? (Number(latest) - Number(goal)).toFixed(1) : '-'} tone="text-moss" />
        </div>
        <SvgCanvasTrendChart
          data={weightData}
          valueKey="weight"
          unit={unit}
          strokeColor={colors.moss}
          fillGradientId="weightGradient"
          referenceValue={goal ? Number(goal) : undefined}
          referenceLabel="Goal Weight"
          height={210}
        />
        {startWeight && currentWeight && goal ? (
          <div className="mt-3 text-xs text-[var(--muted)]">
            Progress made: {Math.abs(startWeight - currentWeight).toFixed(1)} {unit}; remaining: {Math.abs(currentWeight - Number(goal)).toFixed(1)} {unit}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <InlineForm value={weight} setValue={setWeight} type="number" placeholder={`Weight (${unit})`} button="Log" onAdd={(value) => action('weight.add', { weight: value })} />
          <InlineForm value={goalWeight} setValue={setGoalWeight} type="number" placeholder={`Goal (${unit})`} button="Set goal" onAdd={(value) => action('profile.goalWeight', { goalWeight: value })} />
        </div>
        {data.weights.length ? (
          <div className="mt-5 border-t pt-4">
            <div className="label-caps mb-2">Recent weight logs</div>
            {[...data.weights].reverse().slice(0, 5).map((item) => (
              <ListItem
                key={item.id}
                title={`${item.logDate} · ${item.weight} ${unit}`}
                onEdit={() => {
                  const next = ask('Edit weight', item.weight);
                  if (next != null) action('weight.update', { id: item.id, weight: next });
                }}
                onDelete={() => action('weight.delete', { id: item.id, label: 'Weight log' })}
              />
            ))}
          </div>
        ) : null}
      </Parchment>
      ) : null}

      {activeHealthTab === 'Diet' ? (
        <Parchment title="Diet Today" eyebrow="Calories & protein">
          <MiniLegend items={[{ label: 'Calories', color: colors.brass }, { label: 'Protein', color: colors.moss }]} />
          <ChartBox>
            {data.dietLogs.length ? (
              <ResponsiveContainer>
                <BarChart data={dietBars} margin={{ bottom: 16, left: 8 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: colors.muted }} tickLine={false} axisLine={false}>
                    <AxisLabel value="Date" />
                  </XAxis>
                  <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={44}>
                    <AxisLabel value="Intake" axis="y" />
                  </YAxis>
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine y={1800} stroke={colors.brass} strokeDasharray="4 4" />
                  <Bar dataKey="calories" name="Calories" fill={colors.brass} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="protein" name="Protein" fill={colors.moss} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <ChartPlaceholder>Log calories or protein to see intake trends.</ChartPlaceholder>}
          </ChartBox>
          <form onSubmit={(e) => submit(e, () => action('diet.save', diet))} className="grid gap-2 md:grid-cols-3">
            <Field placeholder="Calories" type="number" value={diet.calories} onChange={(e) => setDiet({ ...diet, calories: e.target.value })} />
            <Field placeholder="Protein (g)" type="number" value={diet.protein} onChange={(e) => setDiet({ ...diet, protein: e.target.value })} />
            <button className="btn btn-primary">Save</button>
          </form>
          {data.dietLogs.length ? (
            <div className="mt-5 border-t pt-4">
              <div className="label-caps mb-2">Recent diet logs</div>
              {[...data.dietLogs].reverse().slice(0, 5).map((item) => (
                <ListItem
                  key={item.id}
                  title={item.logDate}
                  note={`${item.calories} cal · ${item.protein}g protein`}
                  onEdit={() => {
                    const calories = ask('Calories', item.calories);
                    if (calories == null) return;
                    const protein = ask('Protein', item.protein);
                    if (protein == null) return;
                    action('diet.update', { id: item.id, calories, protein });
                  }}
                  onDelete={() => action('diet.delete', { id: item.id, label: 'Diet log' })}
                />
              ))}
            </div>
          ) : null}
        </Parchment>
      ) : null}

      {activeHealthTab === 'Workouts' ? (
      <>
        <Parchment title="Workout Consistency" eyebrow="Last 90 days">
          <Heatmap days={workoutHeat} />
        </Parchment>
      <Parchment title="Workouts" eyebrow="Log">
        <form onSubmit={(e) => submit(e, () => action('workout.add', workout).then(() => setWorkout({ exercise: '', sets: '', reps: '', weight: '' })))} className="mb-4 grid gap-2 md:grid-cols-5">
          <Field className="md:col-span-2" placeholder="Exercise" value={workout.exercise} onChange={(e) => setWorkout({ ...workout, exercise: e.target.value })} />
          <Field placeholder="Sets" type="number" value={workout.sets} onChange={(e) => setWorkout({ ...workout, sets: e.target.value })} />
          <Field placeholder="Reps" type="number" value={workout.reps} onChange={(e) => setWorkout({ ...workout, reps: e.target.value })} />
          <button className="btn btn-primary">Log</button>
        </form>
        {data.workouts.length === 0 ? <Empty>No workouts logged yet.</Empty> : null}
        {data.workouts.map((item) => (
          <ListItem
            key={item.id}
            title={item.exercise}
            note={`${item.logDate} · ${item.sets} x ${item.reps} @ ${item.weight}`}
            onEdit={() => {
              const exercise = ask('Exercise', item.exercise);
              if (!exercise) return;
              const sets = ask('Sets', item.sets);
              if (sets == null) return;
              const reps = ask('Reps', item.reps);
              if (reps == null) return;
              const nextWeight = ask('Weight', item.weight);
              if (nextWeight == null) return;
              action('workout.update', { id: item.id, exercise, sets, reps, weight: nextWeight });
            }}
            onDelete={() => action('workout.delete', { id: item.id, label: 'Workout log' })}
          />
        ))}
      </Parchment>
      </>
      ) : null}

      {activeHealthTab === 'Sleep' ? <Sleep data={data} action={action} /> : null}
    </div>
  );
}

function Sleep({ data, action }: { data: Dashboard; action: ActionFn }) {
  const [sleep, setSleep] = useState({ hours: '', quality: '3' });
  const [range, setRange] = useState(30);
  const sleepRows = filterRange([...data.sleep].reverse(), 'logDate', range, data.today);
  const avg = sleepRows.length ? sleepRows.reduce((sum, item) => sum + Number(item.hours), 0) / sleepRows.length : 0;
  return (
    <Parchment title="Sleep" eyebrow="Recovery" action={<RangeToggle value={range} onChange={setRange} />}>
      <div className="mb-5 grid grid-cols-2 gap-6">
        <Stat label="Average" value={avg ? avg.toFixed(1) : '-'} tone="text-brass" />
        <Stat label="Logs" value={sleepRows.length} />
      </div>
      <ChartBox>
        {sleepRows.length ? (
          <ResponsiveContainer>
            <BarChart data={sleepRows.map((row) => ({ date: row.logDate, hours: Number(row.hours) }))} margin={{ bottom: 16, left: 8 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}>
                <AxisLabel value="Date" />
              </XAxis>
              <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={42} domain={[0, 'dataMax + 1']}>
                <AxisLabel value="Hours" axis="y" />
              </YAxis>
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={7} stroke={colors.brass} strokeDasharray="4 4" />
              <Bar dataKey="hours" name="Hours" radius={[4, 4, 0, 0]}>
                {sleepRows.map((row) => <Cell key={row.id} fill={Number(row.hours) >= 7 ? colors.moss : colors.wax} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartPlaceholder>Log sleep to see recovery trends.</ChartPlaceholder>}
      </ChartBox>
      <form onSubmit={(e) => submit(e, () => action('sleep.add', sleep).then(() => setSleep({ hours: '', quality: '3' })))} className="mb-4 grid gap-2 md:grid-cols-3">
        <Field placeholder="Hours" type="number" value={sleep.hours} onChange={(e) => setSleep({ ...sleep, hours: e.target.value })} />
        <Select value={sleep.quality} onChange={(e) => setSleep({ ...sleep, quality: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Quality {n}</option>)}</Select>
        <button className="btn btn-primary">Log sleep</button>
      </form>
      {data.sleep.length === 0 ? <Empty>No sleep logs yet.</Empty> : null}
      {data.sleep.map((item) => (
        <ListItem
          key={item.id}
          title={`${item.hours} hours`}
          note={`${item.logDate} · quality ${item.quality}/5`}
          onEdit={() => {
            const hours = ask('Sleep hours', item.hours);
            if (hours == null) return;
            const quality = ask('Quality 1-5', item.quality);
            if (quality == null) return;
            action('sleep.update', { id: item.id, hours, quality, logDate: item.logDate });
          }}
          onDelete={() => action('sleep.delete', { id: item.id, label: 'Sleep log' })}
        />
      ))}
    </Parchment>
  );
}
