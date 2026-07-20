'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLogoMark } from '@/components/app-logo';

type Mode = 'signin' | 'signup';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function AuthCard({ initialMode = 'signin' }: { initialMode?: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '');

    if (mode === 'signup') {
      const created = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!created.ok) {
        const body = await created.json().catch(() => null);
        setError(body?.message ?? 'Could not create account.');
        setBusy(false);
        return;
      }
    }

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setBusy(false);

    if (result?.error) {
      setError(mode === 'signup' ? 'Account created, but sign in failed.' : 'Invalid email or password.');
      return;
    }

    router.push(searchParams.get('callbackUrl') ?? '/');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_440px]">
        <section className="hidden lg:block">
          <div className="label-caps mb-4">Personal operating system</div>
          <h1 className="max-w-xl text-[44px] font-semibold leading-[1.05] tracking-tight text-ink">
            A calm command center for your health, money, goals, and momentum.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[var(--muted)]">
            Life Ledger turns daily inputs into a focused, private dashboard that feels intelligent without becoming noisy.
          </p>
          <div className="mt-8 grid max-w-lg gap-3">
            {['Private by default', 'Goal-linked habits and journal context', 'Premium dashboards without clutter'].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm font-medium text-ink shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-brass" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <div className="w-full">
          <div className="mb-8 text-center lg:text-left">
            <AppLogoMark className="mx-auto h-12 w-12 drop-shadow-[0_14px_32px_rgba(79,70,229,0.24)] lg:mx-0" />
            <h2 className="mt-5 text-[32px] font-semibold tracking-tight text-ink">Life Ledger</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Sign in to your personal OS.</p>
          </div>

          <section className="parchment p-8">
            <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border bg-background p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                }}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  mode === 'signin'
                    ? 'bg-card text-brass shadow-sm'
                    : 'text-[var(--muted)] hover:text-ink'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  mode === 'signup'
                    ? 'bg-card text-brass shadow-sm'
                    : 'text-[var(--muted)] hover:text-ink'
                }`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={submit} className="space-y-5 text-ink">
              {mode === 'signup' && (
                <label className="block">
                  <span className="text-xs font-medium text-[var(--muted)]">Name</span>
                  <input
                    autoComplete="name"
                    className="field mt-1.5"
                    name="name"
                    placeholder="Demo User"
                    type="text"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Email</span>
                <input
                  autoComplete="email"
                  className="field mt-1.5"
                  name="email"
                  placeholder="demo@journal.local"
                  required
                  type="email"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-[var(--muted)]">Password</span>
                <input
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="field mt-1.5"
                  minLength={6}
                  name="password"
                  placeholder="Password123!"
                  required
                  type="password"
                />
              </label>

              {error && <p className="text-sm text-wax">{error}</p>}

              <button
                className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                type="submit"
              >
                {busy ? '...' : mode === 'signin' ? 'Enter' : 'Begin'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
