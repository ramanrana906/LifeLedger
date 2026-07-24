'use client';

import React, { useId, useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { allLinkableEntities, EntityType, getLinkedEntities, navigateToEntity } from '@/lib/ledger/utils';
import { NavIcon } from './nav-icon';
import { LinkToPicker } from './link-to-picker';
import { Modal } from './ui';

type ActionFn = (type: string, payload?: Row) => Promise<boolean>;

const entityTypeLabels: Record<EntityType, string> = {
  profile: 'Health Profile',
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
  entityLabel,
  className = '',
}: {
  data: Dashboard;
  entityType: EntityType;
  entityId: string;
  action: ActionFn;
  title?: string;
  compact?: boolean;
  entityLabel?: string;
  className?: string;
}) {
  const generatedId = useId();
  const dialogId = `entity-connections-${generatedId.replaceAll(':', '')}`;
  const [isOpen, setIsOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const linkCount = (data.entityLinks ?? []).reduce(
    (count, link) =>
      (link.sourceType === entityType && String(link.sourceId) === entityId) ||
      (link.targetType === entityType && String(link.targetId) === entityId)
        ? count + 1
        : count,
    0,
  );
  const links = isOpen ? getLinkedEntities(data, entityType, entityId) : [];
  const sourceEntity = isOpen
    ? allLinkableEntities(data).find(
        (entity) => entity.entityType === entityType && String(entity.entityId) === String(entityId),
      )
    : undefined;
  const sourceLabel =
    entityLabel ??
    sourceEntity?.title ??
    entityType
      .replace('finance_', '')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  const groupedLinks = links.reduce((groups, link) => {
    const group = groups.get(link.entityType) ?? [];
    group.push(link);
    groups.set(link.entityType, group);
    return groups;
  }, new Map<EntityType, typeof links>());

  const handleAddLink = async (targetType: EntityType, targetId: string, relationshipType: string) => {
    const saved = await action('entityLink.add', {
      sourceType: entityType,
      sourceId: entityId,
      targetType,
      targetId,
      relationshipType,
    });
    if (saved) setShowPicker(false);
  };

  const handleRemoveLink = async (linkId: string) => {
    setRemovingId(linkId);
    try {
      await action('entityLink.delete', { id: linkId });
    } finally {
      setRemovingId('');
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setShowPicker(false);
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogId}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        className={`${compact ? 'rounded-lg px-2 py-1 text-[11px]' : 'rounded-xl px-3 py-1.5 text-xs'} inline-flex items-center gap-1.5 border border-brass/25 bg-brass/10 font-semibold text-brass transition hover:border-brass/40 hover:bg-brass/20 active:scale-95 ${className}`}
      >
        <span aria-hidden="true">
          <NavIcon name="link" className="h-3.5 w-3.5" />
        </span>
        <span>{title}</span>
        <span className="tabular-nums">({linkCount})</span>
      </button>

      <Modal
        id={dialogId}
        isOpen={isOpen}
        onClose={closeModal}
        title={`${title} for ${sourceLabel}`}
        closeLabel={`Close ${title.toLowerCase()}`}
        maxWidth="lg"
        showFooter={false}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--muted)]">
              {links.length === 0 ? 'No connections yet' : `${links.length} ${links.length === 1 ? 'connection' : 'connections'}`}
            </div>
            <button
              type="button"
              onClick={() => setShowPicker((current) => !current)}
              aria-expanded={showPicker}
              className="rounded-lg bg-brass/10 px-2.5 py-1 text-xs font-semibold text-brass transition hover:bg-brass/20 active:scale-95"
            >
              {showPicker ? 'Cancel' : '+ Add Connection'}
            </button>
          </div>

          {showPicker ? (
            <LinkToPicker
              data={data}
              sourceType={entityType}
              sourceId={entityId}
              onSelect={handleAddLink}
              onClose={() => setShowPicker(false)}
              heading={`Link ${sourceLabel} to…`}
            />
          ) : null}

          {links.length === 0 && !showPicker ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-background/50 px-3 py-4 text-xs italic text-[var(--muted)]">
              Link this item to any goal, habit, skill, routine, finance record, or journal entry.
            </div>
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
                          <button
                            type="button"
                            onClick={() => {
                              closeModal();
                              navigateToEntity(link.entityType, link.entityId);
                            }}
                            className="min-w-0 flex-1 text-left"
                            title={`Open ${link.title}`}
                          >
                            <div className="truncate font-medium text-ink transition hover:text-brass">{link.title}</div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                              <span className="font-medium capitalize text-brass">{String(link.relationshipType).replaceAll('_', ' ')}</span>
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
                              className="p-1 text-[var(--muted)] transition hover:text-red-600 disabled:opacity-40"
                              aria-label={`Remove connection to ${link.title}`}
                            >
                              <span aria-hidden="true">{removingId === link.linkId ? '…' : '✕'}</span>
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
      </Modal>
    </>
  );
}
