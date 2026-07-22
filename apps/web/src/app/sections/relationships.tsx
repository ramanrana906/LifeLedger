'use client';

import React, { useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { submit, ask } from '@/lib/ledger/utils';
import { Parchment, SubTabs, Field, Select, ListItem, Empty } from '@/components/ledger/ui';

type ActionFn = (type: string, payload?: Row) => Promise<void>;

export function Relationships({ data, action }: { data: Dashboard; action: ActionFn }) {
  const relationshipTabs = ['Check-ins', 'Important Dates'] as const;
  const [activeRelationshipTab, setActiveRelationshipTab] = useState<(typeof relationshipTabs)[number]>('Check-ins');
  const [checkin, setCheckin] = useState({ personName: '', category: 'Friend', rating: '3', note: '' });
  const [date, setDate] = useState({ personName: '', kind: '', date: '' });
  return (
    <div className="space-y-6">
      <SubTabs tabs={relationshipTabs} value={activeRelationshipTab} onChange={setActiveRelationshipTab} ariaLabel="Relationship sections" />

      <div className={activeRelationshipTab === 'Check-ins' ? 'space-y-5' : 'hidden'}>
      <Parchment title="Weekly Check-ins" eyebrow={`Week of ${data.weekStart}`}>
        <form onSubmit={(e) => submit(e, () => action('relationship.add', checkin).then(() => setCheckin({ personName: '', category: 'Friend', rating: '3', note: '' })))} className="mb-4 grid gap-2 md:grid-cols-5">
          <Field placeholder="Person" value={checkin.personName} onChange={(e) => setCheckin({ ...checkin, personName: e.target.value })} />
          <Field placeholder="Category" value={checkin.category} onChange={(e) => setCheckin({ ...checkin, category: e.target.value })} />
          <Select value={checkin.rating} onChange={(e) => setCheckin({ ...checkin, rating: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}</Select>
          <Field placeholder="Note" value={checkin.note} onChange={(e) => setCheckin({ ...checkin, note: e.target.value })} />
          <button className="btn btn-primary">Add</button>
        </form>
        {data.checkins.length === 0 ? <Empty>No check-ins yet this week.</Empty> : null}
        {data.checkins.map((item) => (
          <ListItem
            key={item.id}
            title={item.personName}
            note={`${item.category} · ${item.rating}/5${item.note ? ` · ${item.note}` : ''}`}
            onEdit={() => {
              const personName = ask('Person', item.personName);
              if (!personName) return;
              const rating = ask('Rating 1-5', item.rating);
              if (rating == null) return;
              const note = ask('Note', item.note ?? '');
              action('relationship.update', { ...item, personName, rating, note });
            }}
            onDelete={() => action('relationship.delete', { id: item.id, label: 'Relationship check-in' })}
          />
        ))}
      </Parchment>
      </div>

      <div className={activeRelationshipTab === 'Important Dates' ? 'space-y-5' : 'hidden'}>
      <Parchment title="Important Dates" eyebrow="Remember">
        <form onSubmit={(e) => submit(e, () => action('importantDate.add', date).then(() => setDate({ personName: '', kind: '', date: '' })))} className="mb-4 grid gap-2 md:grid-cols-4">
          <Field placeholder="Person" value={date.personName} onChange={(e) => setDate({ ...date, personName: e.target.value })} />
          <Field placeholder="Kind" value={date.kind} onChange={(e) => setDate({ ...date, kind: e.target.value })} />
          <Field type="date" value={date.date} onChange={(e) => setDate({ ...date, date: e.target.value })} />
          <button className="btn btn-primary">Add date</button>
        </form>
        {data.dates.length === 0 ? <Empty>No important dates added.</Empty> : null}
        {data.dates.map((item) => (
          <ListItem
            key={item.id}
            title={item.personName}
            note={`${item.kind} · ${item.date}`}
            onEdit={() => {
              const personName = ask('Person', item.personName);
              if (!personName) return;
              const kind = ask('Kind', item.kind);
              if (!kind) return;
              const dateValue = ask('Date', item.date);
              if (!dateValue) return;
              action('importantDate.update', { id: item.id, personName, kind, date: dateValue });
            }}
            onDelete={() => action('importantDate.delete', { id: item.id, label: 'Important date' })}
          />
        ))}
      </Parchment>
      </div>
    </div>
  );
}
