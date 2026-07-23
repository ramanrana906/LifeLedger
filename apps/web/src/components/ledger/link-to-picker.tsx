'use client';

import React, { useId, useState } from 'react';
import { Dashboard } from '@/lib/ledger/types';
import { allLinkableEntities, EntityType, LinkableEntity } from '@/lib/ledger/utils';
import { NavIcon } from './nav-icon';
import { Field } from './ui';

const filterOptions: Array<{
  label: string;
  value: string;
  types?: EntityType[];
}> = [
  { label: 'All', value: 'all' },
  { label: 'Goals', value: 'goals', types: ['goal'] },
  { label: 'Habits', value: 'habits', types: ['habit'] },
  { label: 'Skills', value: 'skills', types: ['learning_skill'] },
  {
    label: 'Routines',
    value: 'routines',
    types: ['routine', 'routine_step'],
  },
  {
    label: 'Finance',
    value: 'finance',
    types: ['finance_debt', 'finance_savings', 'finance_transaction'],
  },
  { label: 'Journal', value: 'journal', types: ['journal_entry'] },
];

export function LinkToPicker({
  data,
  sourceType,
  sourceId,
  onSelect,
  onClose,
  allowedTypes,
  candidateFilter,
  heading = 'Link to entity',
}: {
  data: Dashboard;
  sourceType: EntityType;
  sourceId: string;
  onSelect: (targetType: EntityType, targetId: string, relationshipType: string, entity: LinkableEntity) => void | Promise<void>;
  onClose?: () => void;
  allowedTypes?: EntityType[];
  candidateFilter?: (entity: LinkableEntity) => boolean;
  heading?: string;
}) {
  const headingId = `link-picker-${useId().replaceAll(':', '')}`;
  const [query, setQuery] = useState('');
  const [relationshipType, setRelationshipType] = useState('linked');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectingKey, setSelectingKey] = useState('');

  const alreadyLinked = new Set<string>();
  (data.entityLinks ?? []).forEach((link) => {
    if (link.sourceType === sourceType && String(link.sourceId) === sourceId) {
      alreadyLinked.add(`${link.targetType}:${link.targetId}`);
    }
    if (link.targetType === sourceType && String(link.targetId) === sourceId) {
      alreadyLinked.add(`${link.sourceType}:${link.sourceId}`);
    }
  });

  const candidates = allLinkableEntities(data).filter((item) => {
    if (item.selectable === false) return false;
    if (item.entityType === sourceType && item.entityId === sourceId) return false;
    if (alreadyLinked.has(`${item.entityType}:${item.entityId}`)) return false;
    if (allowedTypes && !allowedTypes.includes(item.entityType)) return false;
    return candidateFilter ? candidateFilter(item) : true;
  });

  const filtered = candidates.filter((item) => {
    const selectedTypes = filterOptions.find((option) => option.value === selectedFilter)?.types;
    if (selectedTypes && !selectedTypes.includes(item.entityType)) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLocaleLowerCase();
    return String(item.title).toLocaleLowerCase().includes(q) || String(item.subtitle).toLocaleLowerCase().includes(q);
  });

  return (
    <section aria-labelledby={headingId} className="w-full max-w-lg space-y-3 rounded-2xl border border-[var(--border)] bg-card p-4 shadow-lg">
      <div className="flex items-center justify-between border-b pb-2">
        <div id={headingId} className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span aria-hidden="true">
            <NavIcon name="link" className="h-4 w-4 text-brass" />
          </span>
          {heading}
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close link picker" className="text-xs text-[var(--muted)] hover:text-ink transition">
            <span aria-hidden="true">✕</span> Close
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs" role="group" aria-label="Relationship type">
        <span className="flex items-center gap-1 self-center font-medium text-[var(--muted)]">Relationship:</span>
        {['linked', 'supports', 'feeds', 'triggered_by'].map((rel) => (
          <button
            key={rel}
            type="button"
            onClick={() => setRelationshipType(rel)}
            aria-pressed={relationshipType === rel}
            className={`rounded-lg border px-2.5 py-1 text-xs capitalize transition ${relationshipType === rel ? 'border-brass bg-brass text-white shadow-2xs font-semibold' : 'bg-card text-[var(--muted)] hover:border-brass'}`}
          >
            {rel.replace('_', ' ')}
          </button>
        ))}
      </div>

      <Field
        autoFocus
        data-modal-autofocus
        aria-label="Search entities to link"
        placeholder="Search entities to link (Goals, Habits, Skills, Debts...)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="text-xs"
      />

      <div className="flex flex-wrap gap-1 text-[11px]" role="group" aria-label="Filter entities by type">
        {filterOptions
          .filter((filter) => filter.value === 'all' || !allowedTypes || filter.types?.some((type) => allowedTypes.includes(type)))
          .map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setSelectedFilter(f.value)}
              aria-pressed={selectedFilter === f.value}
              className={`rounded-md px-2 py-0.5 transition ${selectedFilter === f.value ? 'bg-brass/20 text-brass font-bold' : 'text-[var(--muted)] hover:bg-card-hover'}`}
            >
              {f.label}
            </button>
          ))}
      </div>

      <div className="sr-only" aria-live="polite">
        {selectingKey ? 'Adding connection' : `${filtered.length} linkable ${filtered.length === 1 ? 'entity' : 'entities'} found`}
      </div>

      <div className="max-h-56 space-y-1.5 divide-y divide-[var(--border)]/40 overflow-y-auto pr-1" aria-busy={Boolean(selectingKey)}>
        {filtered.length === 0 ? <div className="p-3 text-center text-xs text-[var(--muted)]">No linkable entities found.</div> : null}
        {filtered.map((item) => {
          const key = `${item.entityType}-${item.entityId}`;
          return (
            <button
              key={key}
              type="button"
              disabled={Boolean(selectingKey)}
              aria-label={`Link to ${item.title}`}
              onClick={async () => {
                setSelectingKey(key);
                try {
                  await onSelect(item.entityType, item.entityId, relationshipType, item);
                } finally {
                  setSelectingKey('');
                }
              }}
              className="w-full text-left p-2 rounded-xl hover:bg-brass/10 transition flex items-center justify-between group"
            >
              <div>
                <div className="font-medium text-xs text-ink group-hover:text-brass">{item.title}</div>
                <div className="text-[10px] text-[var(--muted)]">{item.subtitle}</div>
              </div>
              <span className="text-xs font-semibold text-brass opacity-0 group-hover:opacity-100 transition">{selectingKey === key ? 'Linking…' : '+ Link'}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
