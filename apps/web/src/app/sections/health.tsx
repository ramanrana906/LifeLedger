'use client';

import React, { useState, useEffect } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors, gridStroke } from '@/lib/ledger/constants';
import { dateKey, daysBack, filterRange, submit, ask, activeGoals } from '@/lib/ledger/utils';
import { Parchment, SubTabs, Stat, Field, Select, InlineForm, ListItem, Empty, MiniLegend, RangeToggle } from '@/components/ledger/ui';
import { EntityConnections } from '@/components/ledger/entity-connections';
import { SvgCanvasTrendChart, ChartTooltip, ChartBox, Heatmap, ChartPlaceholder, AxisLabel } from '@/components/ledger/charts';

type ActionFn = (type: string, payload?: Row) => Promise<boolean>;

export function Health({ data, action }: { data: Dashboard; action: ActionFn }) {
  const healthTabs = ['Weight', 'Diet', 'Workouts', 'Sleep', 'Pain/Symptoms'] as const;
  const [activeHealthTab, setActiveHealthTab] = useState<(typeof healthTabs)[number]>(() => {
    if (typeof window === 'undefined') return 'Weight';
    const saved = window.sessionStorage.getItem('life-ledger-health-tab');
    window.sessionStorage.removeItem('life-ledger-health-tab');
    return healthTabs.includes(saved as (typeof healthTabs)[number]) ? saved as (typeof healthTabs)[number] : 'Weight';
  });
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState(String(data.profile?.goalWeight ?? ''));
  const [range, setRange] = useState(90);
  const [diet, setDiet] = useState({ calories: data.diet?.calories ?? '', protein: data.diet?.protein ?? '' });
  const [goalCalories, setGoalCalories] = useState(String(data.profile?.goalCalories ?? ''));
  const [goalProtein, setGoalProtein] = useState(String(data.profile?.goalProtein ?? ''));
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
          <div className="flex rounded-2xl border bg-background p-1 focus-within:ring-2 focus-within:ring-brass/30">
            <input
              type="number"
              value={goalWeight}
              onChange={(e) => setGoalWeight(e.target.value)}
              placeholder={`Goal (${unit})`}
              className="w-full bg-transparent px-3 py-1 text-sm outline-none placeholder:text-[var(--muted)]"
            />
            <button
              type="button"
              onClick={() => {
                if (goalWeight) action('profile.goalWeight', { goalWeight });
              }}
              className="rounded-xl bg-card px-4 py-1 text-xs font-semibold text-ink shadow-sm transition hover:bg-card-hover active:scale-95"
            >
              Set
            </button>
          </div>
          <div className="flex items-center gap-2">
            <EntityConnections data={data} entityType="profile" entityId={String(data.profile.id)} action={action} compact />
          </div>
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
          <div className="mb-4 flex items-center gap-3 bg-card p-2 rounded-xl shadow-2xs text-xs">
            <div className="flex flex-col gap-1 w-32">
              <span className="font-semibold text-slate-500">Calorie Target</span>
              <div className="flex gap-1">
                <input type="number" value={goalCalories} onChange={e => setGoalCalories(e.target.value)} className="w-full bg-background border rounded px-2 py-1" placeholder="e.g. 2000" />
              </div>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <span className="font-semibold text-slate-500">Protein Target</span>
              <div className="flex gap-1">
                <input type="number" value={goalProtein} onChange={e => setGoalProtein(e.target.value)} className="w-full bg-background border rounded px-2 py-1" placeholder="e.g. 150" />
              </div>
            </div>
            <button type="button" onClick={() => { if(goalCalories) action('profile.goalCalories', { goalCalories }); if(goalProtein) action('profile.goalProtein', { goalProtein }); }} className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 py-1 px-3 mt-4 self-end">Set Targets</button>
            {!data.profile?.goalProtein && <span className="ml-2 text-slate-400 mt-4 italic self-end">Set a daily target to track your progress</span>}
          </div>
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
                  {data.profile?.goalCalories ? <ReferenceLine y={Number(data.profile.goalCalories)} stroke={colors.brass} strokeDasharray="4 4" /> : null}
                  {data.profile?.goalProtein ? <ReferenceLine y={Number(data.profile.goalProtein)} stroke={colors.moss} strokeDasharray="4 4" /> : null}
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

      {activeHealthTab === 'Workouts' ? (() => {
        const matchingPastWorkout = workout.exercise.trim() ? [...data.workouts].reverse().find(w => w.exercise.toLowerCase() === workout.exercise.trim().toLowerCase()) : null;
        return (
        <>
          <Parchment title="Workout Consistency" eyebrow="Last 90 days">
            <Heatmap days={workoutHeat} />
            <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-[var(--muted)] font-medium">
              <span>Less</span>
              <span className="h-2.5 w-2.5 rounded-sm bg-rule" />
              <span className="h-2.5 w-2.5 rounded-sm bg-brass/30" />
              <span className="h-2.5 w-2.5 rounded-sm bg-brass/65" />
              <span className="h-2.5 w-2.5 rounded-sm bg-brass" />
              <span>More</span>
            </div>
          </Parchment>
        <Parchment title="Workouts" eyebrow="Log">
          <form onSubmit={(e) => submit(e, () => action('workout.add', workout).then(() => setWorkout({ exercise: '', sets: '', reps: '', weight: '' })))} className="mb-4">
            <div className="grid gap-2 md:grid-cols-5 mb-2">
              <Field className="md:col-span-2" placeholder="Exercise" value={workout.exercise} onChange={(e) => setWorkout({ ...workout, exercise: e.target.value })} />
              <Field placeholder="Sets" type="number" value={workout.sets} onChange={(e) => setWorkout({ ...workout, sets: e.target.value })} />
              <Field placeholder="Reps" type="number" value={workout.reps} onChange={(e) => setWorkout({ ...workout, reps: e.target.value })} />
              <button className="btn btn-primary">Log</button>
            </div>
            {matchingPastWorkout && (
              <div className="text-[11px] text-brass/80 font-medium">
                Last time: {matchingPastWorkout.exercise} — {matchingPastWorkout.sets} sets × {matchingPastWorkout.reps} reps @ {matchingPastWorkout.weight}, logged on {matchingPastWorkout.logDate}
              </div>
            )}
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
      )})() : null}

      {activeHealthTab === 'Sleep' ? <Sleep data={data} action={action} /> : null}
      {activeHealthTab === 'Pain/Symptoms' ? <Symptoms data={data} action={action} /> : null}
    </div>
  );
}

function Sleep({ data, action }: { data: Dashboard; action: ActionFn }) {
  const [sleep, setSleep] = useState({ hours: '', quality: '' });
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
      <form onSubmit={(e) => submit(e, () => action('sleep.add', sleep).then(() => setSleep({ hours: '', quality: '' })))} className="mb-4 grid gap-2 md:grid-cols-3">
        <Field placeholder="Hours" type="number" value={sleep.hours} onChange={(e) => setSleep({ ...sleep, hours: e.target.value })} />
        <Select value={sleep.quality} onChange={(e) => setSleep({ ...sleep, quality: e.target.value })}>
          <option value="" disabled>Quality</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Quality {n}</option>)}
        </Select>
        <button className="btn btn-primary" disabled={!sleep.quality}>Log sleep</button>
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

function Symptoms({ data, action }: { data: Dashboard; action: ActionFn }) {
  const [log, setLog] = useState({ bodyAreaType: '', bodyAreaOther: '', severity: '', note: '' });
  const [range, setRange] = useState(30);
  const [chartArea, setChartArea] = useState('Lower back');

  const areas = ['Lower back', 'Hip', 'Pelvis', 'Knee', 'Shoulder', 'Neck', 'Other'];
  const logs = filterRange([...(data.symptomLogs || [])].reverse(), 'logDate', range, data.today);
  
  // Extract unique areas for the chart dropdown from actual data + defaults
  const loggedAreas = Array.from(new Set((data.symptomLogs || []).map((l) => l.bodyArea))).sort();
  const chartAreaOptions = Array.from(new Set([...areas.filter(a => a !== 'Other'), ...loggedAreas]));
  
  // Ensure selected chart area exists in options
  useEffect(() => {
    if (chartAreaOptions.length > 0 && !chartAreaOptions.includes(chartArea)) {
      setChartArea(chartAreaOptions[0]);
    }
  }, [chartAreaOptions, chartArea]);

  const chartData = logs
    .filter((l) => l.bodyArea === chartArea)
    .map((l) => ({ date: l.logDate, severity: Number(l.severity) }));

  const handleSubmit = (e: React.FormEvent) => {
    submit(e, () => {
      const finalArea = log.bodyAreaType === 'Other' ? log.bodyAreaOther : log.bodyAreaType;
      return action('symptom.add', {
        bodyArea: finalArea,
        severity: log.severity,
        note: log.note,
      }).then(() => setLog({ bodyAreaType: '', bodyAreaOther: '', severity: '', note: '' }));
    });
  };

  return (
    <Parchment title="Pain & Symptoms" eyebrow="Tracking" action={<RangeToggle value={range} onChange={setRange} />}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-ink">Severity Trend</div>
        <Select value={chartArea} onChange={(e) => setChartArea(e.target.value)} className="w-auto py-1 text-xs">
          {chartAreaOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      </div>
      
      <div className="mb-8">
        <ChartBox>
        {chartData.length ? (
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ bottom: 16, left: 8 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}>
                <AxisLabel value="Date" />
              </XAxis>
              <YAxis tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={42} domain={[0, 5]} ticks={[1, 2, 3, 4, 5]}>
                <AxisLabel value="Severity" axis="y" />
              </YAxis>
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="severity" name="Severity" radius={[4, 4, 0, 0]}>
                {chartData.map((row, i) => <Cell key={i} fill={row.severity >= 4 ? colors.warning : row.severity >= 3 ? colors.brass : colors.wax} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <ChartPlaceholder>Log a symptom to see trends.</ChartPlaceholder>}
        </ChartBox>
      </div>

      <div className="label-caps mb-3">Log a symptom</div>
      <form onSubmit={handleSubmit} className="mb-8 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select required value={log.bodyAreaType} onChange={(e) => setLog({ ...log, bodyAreaType: e.target.value })}>
            <option value="" disabled>Body Area</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          
          {log.bodyAreaType === 'Other' && (
            <Field required placeholder="Specify area" value={log.bodyAreaOther} onChange={(e) => setLog({ ...log, bodyAreaOther: e.target.value })} />
          )}

          <Select required value={log.severity} onChange={(e) => setLog({ ...log, severity: e.target.value })}>
            <option value="" disabled>Severity (1-5)</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} - {n === 1 ? 'Mild' : n === 5 ? 'Severe' : 'Moderate'}</option>)}
          </Select>
        </div>
        
        <div className="flex gap-3">
          <Field className="flex-1" placeholder="Note (optional)" value={log.note} onChange={(e) => setLog({ ...log, note: e.target.value })} />
          <button className="btn btn-primary whitespace-nowrap" disabled={!log.bodyAreaType || !log.severity || (log.bodyAreaType === 'Other' && !log.bodyAreaOther)}>
            Log symptom
          </button>
        </div>
      </form>

      <div className="label-caps mb-3 border-t pt-5">History</div>
      {(data.symptomLogs || []).length === 0 ? <Empty>No symptoms logged yet.</Empty> : null}
      {(data.symptomLogs || []).slice(0, 10).map((item) => (
        <ListItem
          key={item.id}
          title={item.bodyArea}
          note={`${item.logDate} · Severity: ${item.severity}/5${item.note ? ` · ${item.note}` : ''}`}
          onDelete={() => action('symptom.delete', { id: item.id, label: 'Symptom log' })}
        />
      ))}
    </Parchment>
  );
}
