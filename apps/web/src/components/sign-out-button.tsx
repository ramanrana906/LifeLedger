'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      className="min-h-11 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 transition duration-150 hover:border-white/25 hover:bg-white/10 hover:text-white active:scale-[0.98]"
      onClick={() => signOut({ callbackUrl: '/login' })}
      type="button"
    >
      Sign out
    </button>
  );
}
