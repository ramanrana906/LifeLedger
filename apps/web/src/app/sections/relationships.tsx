'use client';

import React, { useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { submit, ask, dateKey, daysBack } from '@/lib/ledger/utils';
import { Parchment, SubTabs, Field, Select, ListItem, Empty } from '@/components/ledger/ui';

type ActionFn = (type: string, payload?: Row) => Promise<boolean>;

const RELATIONSHIP_TYPES = ['Spouse', 'Family', 'Friend', 'Colleague', 'Other'];
const DATE_KINDS = ['Birthday', 'Anniversary', 'Other'];

export function Relationships({ data, action }: { data: Dashboard; action: ActionFn }) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  
  const [newPerson, setNewPerson] = useState({ name: '', relationshipType: 'Friend' });
  const [checkin, setCheckin] = useState({ personId: '', rating: '3', note: '' });
  const [date, setDate] = useState({ personId: '', kind: 'Birthday', kindOther: '', date: '' });

  const getUpcomingDays = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date(data.today);
    d.setFullYear(today.getFullYear());
    if (d.getTime() < today.getTime()) {
      d.setFullYear(today.getFullYear() + 1);
    }
    const diffTime = d.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const selectedPerson = data.people.find(p => p.id === selectedPersonId);
  const personCheckins = data.checkins.filter(c => c.personId === selectedPersonId).sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
  const personDates = data.dates.filter(d => d.personId === selectedPersonId).sort((a, b) => getUpcomingDays(a.date) - getUpcomingDays(b.date));

  if (selectedPerson) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedPersonId(null)} className="text-sm text-[var(--muted)] hover:text-ink flex items-center gap-1 mb-4">
          ← Back to People
        </button>

        <Parchment title={selectedPerson.name} eyebrow={selectedPerson.relationshipType}>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-bold text-ink mb-3 label-caps">Log Check-in</h3>
              <form onSubmit={(e) => submit(e, () => action('relationship.add', { ...checkin, personId: selectedPerson.id, personName: selectedPerson.name, category: selectedPerson.relationshipType }).then(() => setCheckin({ personId: '', rating: '3', note: '' })))} className="mb-6 grid gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Quality of time together this week</label>
                  <Select value={checkin.rating} onChange={(e) => setCheckin({ ...checkin, rating: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5 Rating</option>)}</Select>
                </div>
                <Field placeholder="Note (Optional)" value={checkin.note} onChange={(e) => setCheckin({ ...checkin, note: e.target.value })} />
                <button className="btn btn-primary">Add Check-in</button>
              </form>
              
              <h3 className="font-bold text-ink mb-3 label-caps">Check-in History</h3>
              {personCheckins.length === 0 ? <Empty>No check-ins yet.</Empty> : null}
              {personCheckins.map((item) => (
                <ListItem
                  key={item.id}
                  title={item.weekStart}
                  note={`${item.rating}/5${item.note ? ` · ${item.note}` : ''}`}
                  onEdit={() => {
                    const rating = ask('Rating 1-5', item.rating);
                    if (rating == null) return;
                    const note = ask('Note', item.note ?? '');
                    action('relationship.update', { ...item, rating, note });
                  }}
                  onDelete={() => action('relationship.delete', { id: item.id, label: 'Relationship check-in' })}
                />
              ))}
            </div>

            <div>
              <h3 className="font-bold text-ink mb-3 label-caps">Add Important Date</h3>
              <form onSubmit={(e) => submit(e, () => action('importantDate.add', { ...date, personId: selectedPerson.id, personName: selectedPerson.name, kind: date.kind === 'Other' ? date.kindOther : date.kind }).then(() => setDate({ personId: '', kind: 'Birthday', kindOther: '', date: '' })))} className="mb-6 grid gap-2">
                <Select value={date.kind} onChange={(e) => setDate({ ...date, kind: e.target.value })}>
                  {DATE_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                </Select>
                {date.kind === 'Other' && <Field placeholder="Custom kind" value={date.kindOther} onChange={(e) => setDate({ ...date, kindOther: e.target.value })} />}
                <Field type="date" value={date.date} onChange={(e) => setDate({ ...date, date: e.target.value })} />
                <button className="btn btn-primary">Add Date</button>
              </form>

              <h3 className="font-bold text-ink mb-3 label-caps">Important Dates</h3>
              {personDates.length === 0 ? <Empty>No dates added.</Empty> : null}
              {personDates.map((item) => {
                const days = getUpcomingDays(item.date);
                return (
                  <ListItem
                    key={item.id}
                    title={item.kind}
                    note={`${item.date} ${days <= 30 ? `(in ${days} days)` : ''}`}
                    onEdit={() => {
                      const kind = ask('Kind', item.kind);
                      if (!kind) return;
                      const dateValue = ask('Date', item.date);
                      if (!dateValue) return;
                      action('importantDate.update', { id: item.id, kind, date: dateValue });
                    }}
                    onDelete={() => action('importantDate.delete', { id: item.id, label: 'Important date' })}
                  />
                );
              })}
            </div>
          </div>
        </Parchment>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Parchment title="People" eyebrow="Relationships">
        <form onSubmit={(e) => submit(e, () => action('person.add', newPerson).then(() => setNewPerson({ name: '', relationshipType: 'Friend' })))} className="mb-6 grid gap-2 md:grid-cols-3">
          <Field placeholder="New person's name" value={newPerson.name} onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })} />
          <Select value={newPerson.relationshipType} onChange={(e) => setNewPerson({ ...newPerson, relationshipType: e.target.value })}>
            {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <button className="btn btn-primary" disabled={!newPerson.name}>+ Add Person</button>
        </form>

        <div className="grid gap-3 md:grid-cols-2">
          {data.people.map(person => {
            const lastCheckin = data.checkins.filter(c => c.personId === person.id).sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())[0];
            const dates = data.dates.filter(d => d.personId === person.id).map(d => ({ ...d, days: getUpcomingDays(d.date) })).sort((a, b) => a.days - b.days);
            const nextDate = dates.find(d => d.days <= 30);
            
            return (
              <div key={person.id} onClick={() => setSelectedPersonId(person.id)} className="cursor-pointer rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-ink">{person.name}</h4>
                  <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">{person.relationshipType}</span>
                </div>
                <div className="text-xs text-slate-500 flex flex-col gap-1">
                  <span>Last check-in: {lastCheckin ? lastCheckin.weekStart : 'Never'}</span>
                  {nextDate && <span className="text-indigo-600 font-semibold">{String((nextDate as any).kind)} in {nextDate.days} days</span>}
                </div>
              </div>
            );
          })}
        </div>
        {data.people.length === 0 ? <Empty>No people added yet.</Empty> : null}
      </Parchment>
    </div>
  );
}
