'use client';

import { useEffect, useRef, useState } from 'react';
import { AppLogoMark } from '@/components/app-logo';
import { SignOutButton } from '@/components/sign-out-button';
import { Dashboard, Row, normalizeDashboard } from '@/lib/ledger/types';
import { tabs } from '@/lib/ledger/constants';
import { Parchment, Modal } from '@/components/ledger/ui';
import { NavIcon } from '@/components/ledger/nav-icon';

// Modular Sections
import { Today } from './sections/today';
import { Goals } from './sections/goals';
import { Finance } from './sections/finance';
import { Health } from './sections/health';
import { Relationships } from './sections/relationships';
import { Learning } from './sections/learning';
import { Habits } from './sections/habits';
import { Routines } from './sections/routines';
import { Review, CycleSettings } from './sections/review';

export function LedgerDashboard({ name }: { name?: string | null }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [active, setActive] = useState('Today');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [undo, setUndo] = useState<{
    type: string;
    id: string;
    label: string;
  } | null>(null);
  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
    tone?: 'brass' | 'danger' | 'warning';
  } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch('/api/ledger/dashboard', {
      cache: 'no-store',
    });
    if (response.ok) setData(normalizeDashboard(await response.json()));
    setLoading(false);
  }

  async function action(type: string, payload: Row = {}) {
    if (type === 'goal.toggle' && payload.id && data) {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          goals: prev.goals.map((g) => (String(g.id) === String(payload.id) ? { ...g, completed: !g.completed } : g)),
        };
      });
      fetch('/api/ledger/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      }).catch((err) => {
        console.error('Failed to toggle goal:', err);
        load();
      });
      return true;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/ledger/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
      });
      if (!res.ok) {
        let msg = `Action failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.message) msg = Array.isArray(body.message) ? body.message.join(', ') : String(body.message);
        } catch {
          /* ignore parse error */
        }
        setAlertModal({
          title: 'Could Not Save',
          message: msg,
          tone: 'warning',
        });
        setSaving(false);
        return false;
      }
    } catch (err) {
      setAlertModal({
        title: 'Network Error',
        message: err instanceof Error ? err.message : 'Unknown network error',
        tone: 'danger',
      });
      setSaving(false);
      return false;
    }
    await load();
    setSaving(false);

    if (type.endsWith('.delete') && payload.id) {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo({
        type: type.replace('.delete', '.restore'),
        id: String(payload.id),
        label: String(payload.label ?? 'Entry'),
      });
      undoTimer.current = setTimeout(() => setUndo(null), 7000);
    }
    return true;
  }

  async function restoreDeleted() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const pending = undo;
    setUndo(null);
    setSaving(true);
    await fetch('/api/ledger/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: pending.type, payload: { id: pending.id } }),
    });
    await load();
    setSaving(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const xpToNext = Math.max((data?.stats?.level ?? 1) * 100, 100);
  const xp = data?.stats?.xp ?? 0;
  const xpPct = Math.min(100, Math.round((xp / xpToNext) * 100));
  const initials =
    (name ?? 'LL')
      .split(/\s|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'LL';
  const firstName = name?.split(/\s|@/).filter(Boolean)[0] ?? 'Raman';

  return (
    <div className="min-h-screen bg-background text-foreground md:flex">
      {/* Mobile Backdrop */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity md:hidden" />}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full flex-col bg-[var(--sidebar)] text-white shadow-2xl transition-all duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:shadow-none ${sidebarOpen ? 'translate-x-0 w-[260px] md:w-[260px] md:opacity-100 md:pointer-events-auto' : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:pointer-events-none overflow-hidden'}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <AppLogoMark className="h-10 w-10 shrink-0 shadow-[0_16px_34px_rgba(79,70,229,0.26)]" />
            <div className="min-w-0">
              <div className="text-base font-semibold tracking-tight text-white">Life Ledger</div>
              <div className="text-xs text-slate-400">Personal operating system</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
            title="Close navigation"
          >
            <NavIcon name="close" className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              data-tab={tab.key}
              onClick={() => {
                setActive(tab.key);
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setSidebarOpen(false);
                }
              }}
              className={`flex min-h-11 w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${active === tab.key ? 'bg-[#EEF2FF] text-[#4338CA] font-semibold shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white active:scale-[0.99]'}`}
            >
              <NavIcon name={tab.icon} className={`h-4 w-4 shrink-0 ${active === tab.key ? 'text-[#4338CA]' : 'text-slate-400'}`} />
              <span className="truncate">{tab.key}</span>
            </button>
          ))}
        </nav>

        {/* Profile Footer */}
        <div className="shrink-0 border-t border-white/10 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-sm font-semibold text-white ring-2 ring-white/10">{initials}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{name ?? 'Life Ledger'}</div>
              <div className="text-xs text-slate-400">Signed in</div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-rule bg-background/85 px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur-xl md:px-8">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rule bg-card text-slate-700 shadow-sm transition hover:border-brass hover:bg-indigo-50/50 hover:text-brass active:scale-95"
              title={sidebarOpen ? 'Hide sidebar navigation' : 'Open sidebar navigation'}
              aria-label="Toggle sidebar drawer"
            >
              <NavIcon name={sidebarOpen ? 'chevronLeft' : 'menu'} className="h-5 w-5" />
            </button>

            <div className="mr-auto min-w-48">
              <div className="label-caps">Personal OS</div>
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">Welcome back, {firstName}</h1>
            </div>

            <label className="hidden min-h-11 w-full max-w-md items-center gap-3 rounded-2xl border border-rule bg-card px-4 text-sm text-[var(--muted)] shadow-sm lg:flex">
              <NavIcon name="search" className="h-4 w-4 text-[var(--muted)]" />
              <input className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--muted)]" placeholder="Search goals, notes, habits..." aria-label="Search" />
            </label>

            <div className="hidden min-w-48 rounded-2xl border bg-card px-4 py-3 shadow-sm xl:block">
              <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>Level {data?.stats?.level ?? 1}</span>
                <span>
                  {xp}/{xpToNext} XP
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-rule">
                <div className="h-full rounded-full bg-brass transition-all" style={{ width: `${xpPct}%` }} />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-card text-[var(--muted)] shadow-sm transition hover:border-brass hover:text-brass active:scale-95"
                aria-label="Notifications"
              >
                <NavIcon name="bell" className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="hidden min-h-11 items-center gap-2 rounded-2xl border border-[#8B5CF6]/25 bg-gradient-to-r from-[#8B5CF6] to-[#6366F1] px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(99,102,241,0.24)] transition hover:scale-[1.01] md:inline-flex"
              >
                <NavIcon name="sparkles" className="h-4 w-4" />
                AI Assistant
              </button>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brass text-sm font-semibold text-white shadow-sm">{initials}</div>
            </div>

            <div className="flex w-full items-center gap-3 text-sm text-[var(--muted)] lg:hidden">
              <label className="flex min-h-11 flex-1 items-center gap-3 rounded-2xl border bg-card px-4 shadow-sm">
                <NavIcon name="search" className="h-4 w-4" />
                <input className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--muted)]" placeholder="Search ledger..." aria-label="Search" />
              </label>
              <div className="rounded-2xl border bg-card px-3 py-2 shadow-sm">
                <div className="text-xs">Streak</div>
                <div className="font-semibold tabular-nums text-brass">{data?.stats?.currentStreak ?? 0}d</div>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
          {loading && <Parchment title="Loading">Opening the ledger...</Parchment>}
          {!loading && data && (
            <>
              {active === 'Today' && <Today key={data.journal?.id ?? 'new-entry'} data={data} action={action} saving={saving} />}
              {active === 'Goals' && <Goals data={data} action={action} />}
              {active === 'Finance' && <Finance data={data} action={action} />}
              {active === 'Health' && <Health data={data} action={action} />}
              {active === 'Relationships' && <Relationships data={data} action={action} />}
              {active === 'Learning' && <Learning data={data} action={action} />}
              {active === 'Habits' && <Habits data={data} action={action} />}
              {active === 'Routines' && <Routines data={data} action={action} />}
              {active === 'Review' && <Review key={data.weeklyReflection?.id ?? data.weekStart} data={data} action={action} />}
              {active === 'Settings' && <CycleSettings key={data.focusCycle?.id ?? 'cycle'} data={data} action={action} />}
            </>
          )}
        </div>
      </main>
      {undo && (
        <div className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border bg-card px-4 py-3 text-sm shadow-lg">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 text-ink">{undo.label} moved to archive.</div>
            <button className="rounded-xl border border-brass px-3 py-1.5 text-xs font-medium text-brass hover:bg-brass hover:text-white" onClick={restoreDeleted}>
              Undo
            </button>
          </div>
        </div>
      )}
      <Modal isOpen={Boolean(alertModal)} onClose={() => setAlertModal(null)} title={alertModal?.title ?? 'Notice'} tone={alertModal?.tone ?? 'warning'} cancelText={null} actionText="Close">
        {alertModal?.message}
      </Modal>
    </div>
  );
}
