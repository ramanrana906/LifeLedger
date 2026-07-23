'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { NavIcon } from './nav-icon';
import { colors, rangeOptions } from '@/lib/ledger/constants';
import { skillStageIndex, skillStageLabel } from '@/lib/ledger/utils';
import { skillStages } from '@/lib/ledger/constants';

const openModalIds: string[] = [];
let bodyOverflowBeforeModals: string | null = null;

// ── Card / Layout ─────────────────────────────────────────────────────────────

export function Parchment({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="parchment p-6">
      <header className="mb-4 flex items-end justify-between gap-4 border-b pb-4">
        <div>
          {eyebrow ? <div className="label-caps mb-2">{eyebrow}</div> : null}
          <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function SubTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel = 'Module sections',
}: {
  tabs: readonly T[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-1 shadow-sm" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={`min-h-10 rounded-xl px-4 text-sm font-medium transition active:scale-95 ${value === tab ? 'bg-brass text-white shadow-sm' : 'text-[var(--muted)] hover:bg-background hover:text-ink'}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, tone = 'text-brass' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-rule/80 bg-card/60 p-3.5 shadow-2xs">
      <div className="label-caps truncate">{label}</div>
      <div className={`stat-number mt-1 truncate font-semibold tabular-nums ${tone}`} title={typeof value === 'string' ? value : undefined}>{value}</div>
    </div>
  );
}

// ── Form inputs ───────────────────────────────────────────────────────────────

export function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`field min-h-28 resize-y leading-7 ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`field ${props.className ?? ''}`} />;
}

export function InlineForm({
  value,
  setValue,
  onAdd,
  placeholder,
  button = 'Add',
  type = 'text',
}: {
  value: string;
  setValue: (value: string) => void;
  onAdd: (value: string) => Promise<unknown>;
  placeholder: string;
  button?: string;
  type?: string;
}) {
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (value.trim()) onAdd(value.trim()).then(() => setValue(''));
    }} className="mb-4 flex gap-2">
      <Field type={type} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />
        <button className="btn btn-primary">{button}</button>
    </form>
  );
}

// ── List / Row ────────────────────────────────────────────────────────────────

export function ListItem({
  title,
  note,
  muted,
  right,
  onEdit,
  onDelete,
}: {
  title: string;
  note?: string;
  muted?: boolean;
  right?: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="ledger-row flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1 basis-48">
        <div className={`truncate text-base font-medium ${muted ? 'text-[var(--muted)] line-through' : ''}`}>{title}</div>
        {note ? <div className="mt-1 text-xs text-[var(--muted)]">{note}</div> : null}
      </div>
      {right ? <div className="flex flex-wrap shrink-0 items-center gap-2">{right}</div> : null}
      {onEdit ? <button className="rounded px-2 py-1 text-sm text-brass hover:bg-brass hover:text-white" onClick={onEdit}>Edit</button> : null}
      {onDelete ? <button className="rounded px-2 py-1 text-sm text-wax hover:bg-wax hover:text-white" onClick={onDelete}>Delete</button> : null}
    </div>
  );
}

export function Empty({ children, tone = 'brass' }: { children: React.ReactNode; tone?: 'brass' | 'moss' | 'wax' | 'ink' }) {
  return (
    <div className={`empty-state empty-state-${tone}`}>
      <span className="empty-state-icon"><NavIcon name="inbox" className="h-4 w-4" /></span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

// ── Progress / Metrics ────────────────────────────────────────────────────────

export function ProgressBar({ value, max, tone = colors.brass }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-rule">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: tone }} />
      </div>
      <div className="mt-1 text-xs text-[var(--muted)]">{pct}%</div>
    </div>
  );
}

export function MiniLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function SkillStageProgress({ stage }: { stage?: string }) {
  const current = skillStageIndex(stage);
  return (
    <div className="mt-2 max-w-xs">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span>{skillStageLabel(stage)}</span>
        <span className="tabular-nums">{current + 1}/5</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {skillStages.map((item, index) => (
          <span
            key={item.value}
            className={`h-1.5 rounded-full transition ${index <= current ? 'bg-brass' : 'bg-rule'}`}
            title={item.label}
          />
        ))}
      </div>
    </div>
  );
}

export function RangeToggle({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex rounded-2xl border bg-background p-1">
      {rangeOptions.map((item) => (
        <button
          key={item}
          className={`rounded-xl px-2.5 py-1 text-xs transition duration-150 active:scale-95 ${value === item ? 'bg-brass text-white shadow-sm' : 'text-[var(--muted)] hover:bg-card hover:text-brass'}`}
          onClick={() => onChange(item)}
          type="button"
        >
          {item === 9999 ? 'All' : `${item}d`}
        </button>
      ))}
    </div>
  );
}

// ── Modal Component ──────────────────────────────────────────────────────────

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  actionText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  tone = 'brass',
  showFooter = true,
  maxWidth = 'md',
  id,
  closeLabel = 'Close dialog',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actionText?: string;
  cancelText?: string | null;
  onConfirm?: () => void;
  tone?: 'brass' | 'danger' | 'warning';
  showFooter?: boolean;
  maxWidth?: 'md' | 'lg';
  id?: string;
  closeLabel?: string;
}) {
  const generatedId = React.useId();
  const dialogId = id ?? `modal-${generatedId.replaceAll(':', '')}`;
  const titleId = `${dialogId}-title`;
  const panelRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!openModalIds.includes(dialogId)) openModalIds.push(dialogId);
    if (openModalIds.length === 1) {
      bodyOverflowBeforeModals = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusInitialControl = window.requestAnimationFrame(() => {
      if (openModalIds.at(-1) !== dialogId) return;
      const panel = panelRef.current;
      if (!panel) return;
      const preferred = panel.querySelector<HTMLElement>('[data-modal-autofocus]');
      const firstFocusable = panel.querySelector<HTMLElement>(focusableSelector);
      (preferred ?? firstFocusable ?? panel).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openModalIds.at(-1) !== dialogId) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (element) => element.getClientRects().length > 0,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusInitialControl);
      document.removeEventListener('keydown', handleKeyDown);
      const wasTopModal = openModalIds.at(-1) === dialogId;
      const stackIndex = openModalIds.lastIndexOf(dialogId);
      if (stackIndex >= 0) openModalIds.splice(stackIndex, 1);
      if (openModalIds.length === 0) {
        document.body.style.overflow = bodyOverflowBeforeModals ?? '';
        bodyOverflowBeforeModals = null;
      }
      const previousFocus = previouslyFocusedRef.current;
      if (wasTopModal && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [dialogId, isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const btnTone = {
    brass: 'bg-brass hover:bg-brass-deep text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    warning: 'bg-amber-600 hover:bg-amber-500 text-white',
  }[tone];

  const widthClass = maxWidth === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-3xl border border-rule bg-card p-6 shadow-2xl space-y-4 ${widthClass}`}
      >
        <div className="flex items-center justify-between border-b pb-3">
          <h3 id={titleId} className="text-base font-bold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-rule text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-ink transition"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="text-xs leading-relaxed text-slate-600">{children}</div>
        {showFooter ? (
          <div className="flex items-center justify-end gap-2 border-t pt-3">
            {cancelText ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-rule bg-background px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition active:scale-95"
              >
                {cancelText}
              </button>
            ) : null}
            {onConfirm ? (
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition active:scale-95 ${btnTone}`}
              >
                {actionText}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className={`rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition active:scale-95 ${btnTone}`}
              >
                OK
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
