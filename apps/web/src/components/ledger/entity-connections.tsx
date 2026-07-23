'use client';

import React, { useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { EntityType, getLinkedEntities, navigateToEntity } from '@/lib/ledger/utils';
import { NavIcon } from './nav-icon';
import { LinkToPicker } from './link-to-picker';

type ActionFn = (type: string, payload?: Row) => Promise<void>;

const entityTypeLabels: Record<EntityType, string> = {
  goal: 'Linked Goals',
  habit: 'Linked Habits',
  learning_skill: 'Linked Learning Skills',
  routine: 'Linked Routines',
  routine_step: 'Linked Routine Steps',
  finance_debt: 'Linked Debts',
  finance_savings: 'Linked Savings',
  finance_transaction: 'Related Transactions',
  journal_entry: 'Related Journal Entries',
};

export function EntityConnections({
  data,
  entityType,
  entityId,
  action,
  title = 'Connections',
  compact = false,
}: {
  data: Dashboard;
  entityType: EntityType;
  entityId: string;
  action: ActionFn;
  title?: string;
  compact?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const links = getLinkedEntities(data, entityType, entityId);
  const groupedLinks = links.reduce((groups, link) => {
    const group = groups.get(link.entityType) ?? [];
    group.push(link);
    groups.set(link.entityType, group);
    return groups;
  }, new Map<EntityType, typeof links>());

  const handleAddLink = async (targetType: EntityType, targetId: string, relationshipType: string) => {
    await action('entityLink.add', {
      sourceType: entityType,
      sourceId: entityId,
      targetType,
      targetId,
      relationshipType,
    });
    setShowPicker(false);
  };

  const handleRemoveLink = async (linkId: string) => {
    setRemovingId(linkId);
    try {
      await action('entityLink.delete', { id: linkId });
    } finally {
      setRemovingId('');
    }
  };

  return (
    <div className={`${compact ? 'mt-3 rounded-xl p-3' : 'mt-4 rounded-2xl p-4'} border border-[var(--border)] bg-card/60 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="font-semibold text-xs text-ink flex items-center gap-1.5">
          <NavIcon name="link" className="h-4 w-4 text-brass" />
          {title} ({links.length})
        </div>
        <button type="button" onClick={() => setShowPicker(!showPicker)} className="rounded-lg bg-brass/10 px-2.5 py-1 text-xs font-semibold text-brass transition hover:bg-brass/20 active:scale-95">
          {showPicker ? 'Cancel' : '+ Add Connection'}
        </button>
      </div>

      {showPicker ? (
        <div className="pt-2">
          <LinkToPicker data={data} sourceType={entityType} sourceId={entityId} onSelect={handleAddLink} onClose={() => setShowPicker(false)} />
        </div>
      ) : null}

      {links.length === 0 && !showPicker ? (
        <div className="text-xs text-[var(--muted)] italic">No connections yet. Link this item to any goal, habit, skill, routine, finance record, or journal entry.</div>
      ) : null}

      {links.length > 0 ? (
        <div className="space-y-3">
          {[...groupedLinks].map(([linkedType, group]) => (
            <div key={linkedType} className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{entityTypeLabels[linkedType] ?? 'Connections'}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.map((link) => {
                  const managedRoutineTarget = link.relationshipType === 'triggered_by' && (entityType === 'routine_step' || link.entityType === 'routine_step');
                  const transactionId = entityType === 'finance_transaction' ? entityId : link.entityType === 'finance_transaction' ? link.entityId : null;
                  const managedDebtPayment =
                    transactionId != null &&
                    (entityType === 'finance_debt' || link.entityType === 'finance_debt') &&
                    data.transactions.some((transaction) => String(transaction.id) === transactionId && Boolean(transaction.debtPaymentId));
                  const managedLink = managedRoutineTarget || managedDebtPayment;
                  return (
                    <div key={link.linkId} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-card p-2.5 text-xs transition hover:border-brass/40">
                      <button type="button" onClick={() => navigateToEntity(link.entityType, link.entityId)} className="text-left flex-1 min-w-0" title={`Open ${link.title}`}>
                        <div className="font-medium text-ink truncate hover:text-brass transition">{link.title}</div>
                        <div className="text-[10px] text-[var(--muted)] flex items-center gap-1.5">
                          <span className="capitalize text-brass font-medium">{String(link.relationshipType).replaceAll('_', ' ')}</span>
                          <span>·</span>
                          <span className="truncate">{link.subtitle}</span>
                        </div>
                      </button>
                      {managedLink ? (
                        <span className="shrink-0 rounded-md bg-brass/10 px-2 py-1 text-[10px] font-semibold text-brass" title="Change this target from the routine step editor">
                          Managed
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={removingId === link.linkId}
                          onClick={() => handleRemoveLink(link.linkId)}
                          className="text-[var(--muted)] hover:text-red-600 p-1 transition disabled:opacity-40"
                          title="Remove link"
                        >
                          {removingId === link.linkId ? '…' : '✕'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
