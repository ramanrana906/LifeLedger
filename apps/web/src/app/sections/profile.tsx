'use client';

import React, { useState } from 'react';
import { Dashboard, Row } from '@/lib/ledger/types';
import { Parchment, Field } from '@/components/ledger/ui';
import { SignOutButton } from '@/components/sign-out-button';

type ActionFn = (type: string, payload?: Row) => Promise<boolean>;

export function Profile({ data, action }: { data: Dashboard; action: ActionFn }) {
  const profile = data.profile || {};
  const [displayName, setDisplayName] = useState(String(profile.displayName ?? ''));
  const [avatarUrl, setAvatarUrl] = useState(String(profile.avatarUrl ?? ''));
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '');
  const [location, setLocation] = useState(String(profile.location ?? ''));
  const [occupation, setOccupation] = useState(String(profile.occupation ?? ''));
  const [saving, setSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Section 2: Physical Baseline
  const [height, setHeight] = useState(profile.height ? String(profile.height) : '');
  const [startingWeight, setStartingWeight] = useState(profile.startingWeight ? String(profile.startingWeight) : '');
  const [goalWeight, setGoalWeight] = useState(profile.goalWeight ? String(profile.goalWeight) : '');
  const [goalProtein, setGoalProtein] = useState(profile.goalProtein ? String(profile.goalProtein) : '');
  const [goalCalories, setGoalCalories] = useState(profile.goalCalories ? String(profile.goalCalories) : '');
  const [editingStartingWeight, setEditingStartingWeight] = useState(!profile.startingWeight);

  // Section 3: Financial Baseline
  const [unitsCurrency, setUnitsCurrency] = useState(profile.unitsCurrency || '$');
  const [targetSavingsRate, setTargetSavingsRate] = useState(profile.targetSavingsRate ? String(profile.targetSavingsRate) : '');

  // Section 4: About Me
  const [aboutMe, setAboutMe] = useState(String(profile.aboutMe ?? ''));

  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const diff = new Date().getTime() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simple check to ensure it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      setAvatarUrl(base64String);
    };
    reader.readAsDataURL(file);
  };

  const age = calculateAge(dateOfBirth);

  const saveProfile = async () => {
    setSaving(true);
    await action('profile.save', {
      displayName,
      avatarUrl,
      dateOfBirth: dateOfBirth || null,
      location,
      occupation,
      height: height || undefined,
      startingWeight: startingWeight || undefined,
      goalWeight: goalWeight || undefined,
      goalProtein: goalProtein || undefined,
      goalCalories: goalCalories || undefined,
      unitsCurrency: unitsCurrency || undefined,
      targetSavingsRate: targetSavingsRate || undefined,
      aboutMe: aboutMe || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Parchment title="Identity & Basics" eyebrow="Personal Profile">
        <div className="mb-8 flex flex-col items-center">
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-card ring-1 ring-rule shadow-md transition-all hover:ring-brass"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-brass text-4xl font-semibold text-white">
                {displayName ? displayName[0]?.toUpperCase() : 'LL'}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </button>
          
          <div className="mt-4 flex items-center gap-3">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              className="rounded-full bg-rule/50 px-4 py-1.5 text-xs font-semibold text-ink transition hover:bg-brass hover:text-white"
            >
              Change Picture
            </button>
            {avatarUrl && (
              <button 
                type="button" 
                onClick={() => setAvatarUrl('')} 
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:bg-wax/10 hover:text-wax"
              >
                Remove
              </button>
            )}
          </div>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden" 
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="label-caps mb-2">Display Name</div>
            <Field value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <div className="label-caps mb-2">Date of Birth</div>
            <div className="flex items-center gap-3">
              <Field type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              {age !== null ? <span className="text-sm font-semibold tabular-nums text-brass">{age} years old</span> : null}
            </div>
          </div>
          <div>
            <div className="label-caps mb-2">Location</div>
            <Field value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Region" />
          </div>
          <div className="md:col-span-2">
            <div className="label-caps mb-2">Occupation</div>
            <Field value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="What do you do?" />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={saveProfile} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </Parchment>

      <Parchment title="Physical Baseline" eyebrow="Health Targets">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="label-caps mb-2">Height (cm)</div>
            <Field type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 175" />
          </div>
          <div>
            <div className="label-caps mb-2">Starting Weight ({profile.unitsWeight || 'kg'})</div>
            {!editingStartingWeight ? (
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold text-ink">{startingWeight} {profile.unitsWeight || 'kg'}</span>
                <button type="button" onClick={() => setEditingStartingWeight(true)} className="text-sm font-medium text-brass hover:underline">
                  Edit
                </button>
              </div>
            ) : (
              <Field type="number" step="0.1" value={startingWeight} onChange={(e) => setStartingWeight(e.target.value)} placeholder="e.g. 80.5" />
            )}
            <p className="mt-1 text-xs text-[var(--muted)]">Captured once as a historical baseline.</p>
          </div>
          <div>
            <div className="label-caps mb-2">Goal Weight ({profile.unitsWeight || 'kg'})</div>
            <Field type="number" step="0.1" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} placeholder="e.g. 70.0" />
          </div>
          <div className="md:col-span-2 grid gap-6 md:grid-cols-2 pt-4 border-t border-brass/10">
            <div>
              <div className="label-caps mb-2">Daily Protein Target (g)</div>
              <Field type="number" value={goalProtein} onChange={(e) => setGoalProtein(e.target.value)} placeholder="e.g. 150" />
            </div>
            <div>
              <div className="label-caps mb-2">Daily Calorie Target (kcal)</div>
              <Field type="number" value={goalCalories} onChange={(e) => setGoalCalories(e.target.value)} placeholder="e.g. 2500" />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={saveProfile} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </Parchment>

      <Parchment title="Financial Baseline" eyebrow="Wealth Targets">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="label-caps mb-2">Preferred Currency</div>
            <select
              value={unitsCurrency}
              onChange={(e) => setUnitsCurrency(e.target.value)}
              className="flex min-h-11 w-full rounded-xl border border-rule bg-card px-4 py-2.5 text-sm text-ink shadow-sm outline-none transition focus:border-brass focus:ring-1 focus:ring-brass"
            >
              <option value="$">US Dollar ($)</option>
              <option value="₹">Indian Rupee (₹)</option>
              <option value="€">Euro (€)</option>
              <option value="£">British Pound (£)</option>
            </select>
          </div>
          <div>
            <div className="label-caps mb-2">Target Savings Rate (%)</div>
            <Field type="number" step="1" value={targetSavingsRate} onChange={(e) => setTargetSavingsRate(e.target.value)} placeholder="e.g. 20" />
            <p className="mt-1 text-xs text-[var(--muted)]">Your benchmark for the Finance module.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={saveProfile} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </Parchment>

      <Parchment title="Life Snapshot" eyebrow="About Me">
        <textarea
          value={aboutMe}
          onChange={(e) => setAboutMe(e.target.value)}
          placeholder="Who you are, what you're working toward..."
          className="w-full rounded-2xl border border-rule bg-card p-4 text-sm text-ink shadow-sm outline-none transition focus:border-brass focus:ring-1 focus:ring-brass"
          rows={6}
          maxLength={2000}
        />
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={saveProfile} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </Parchment>

      <Parchment title="Stats & Achievements" eyebrow="Trophy Case">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-brass/10 bg-card p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-brass">{data.stats?.level ?? 1}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">Current Level</div>
          </div>
          <div className="rounded-2xl border border-brass/10 bg-card p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-ink">{data.stats?.xp ?? 0}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">Total XP</div>
          </div>
          <div className="rounded-2xl border border-brass/10 bg-card p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-moss">{data.stats?.longestStreak ?? 0}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">Longest Streak (days)</div>
          </div>
          <div className="rounded-2xl border border-brass/10 bg-card p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-sky-500">
              {data.user?.createdAt ? Math.max(1, Math.floor((new Date().getTime() - new Date(String(data.user.createdAt)).getTime()) / (1000 * 60 * 60 * 24))) : 0}
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">Days Logged</div>
          </div>
        </div>
        <div className="mt-6 border-t border-rule pt-4">
          <div className="label-caps mb-4">Milestone Badges</div>
          <div className="flex flex-wrap gap-4">
            {(data.stats?.longestStreak ?? 0) >= 7 ? <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brass text-white shadow-sm ring-4 ring-brass/20" title="7-Day Streak">7</div> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rule text-[var(--muted)]" title="Locked: 7-Day Streak">?</div>}
            {(data.stats?.longestStreak ?? 0) >= 30 ? <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brass text-white shadow-sm ring-4 ring-brass/20" title="30-Day Streak">30</div> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rule text-[var(--muted)]" title="Locked: 30-Day Streak">?</div>}
            {(data.stats?.longestStreak ?? 0) >= 100 ? <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brass text-white shadow-sm ring-4 ring-brass/20" title="100-Day Streak">100</div> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rule text-[var(--muted)]" title="Locked: 100-Day Streak">?</div>}
            {(data.stats?.longestStreak ?? 0) >= 365 ? <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brass text-white shadow-sm ring-4 ring-brass/20" title="365-Day Streak">365</div> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rule text-[var(--muted)]" title="Locked: 365-Day Streak">?</div>}
          </div>
        </div>
      </Parchment>

      <Parchment title="Account Information" eyebrow="Read Only">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="label-caps mb-2">Email Address</div>
            <div className="rounded-xl bg-rule/50 px-4 py-2.5 text-sm text-[var(--muted)]">{data.user?.email ?? 'Unknown'}</div>
          </div>
          <div>
            <div className="label-caps mb-2">Member Since</div>
            <div className="rounded-xl bg-rule/50 px-4 py-2.5 text-sm text-[var(--muted)]">
              {data.user?.createdAt ? new Date(String(data.user.createdAt)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">Email and security settings can be changed in the Settings tab.</p>
      </Parchment>

      <div className="flex justify-end border-t border-rule pt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
