'use client';

import React, { useState, useEffect } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dashboard, Row } from '@/lib/ledger/types';
import { colors, gridStroke, skillStages } from '@/lib/ledger/constants';
import { dateKey, entityDomId, focusEntityInView, listenForEntityNavigation, studyStreak, moduleCountsByDay, submit, ask, activeGoals, getLinkedEntities, goalTitle } from '@/lib/ledger/utils';
import { Parchment, SubTabs, Stat, Field, TextArea, Select, ListItem, Empty, SkillStageProgress } from '@/components/ledger/ui';
import { ChartTooltip, ChartBox, Heatmap, ChartPlaceholder, AxisLabel } from '@/components/ledger/charts';
import { EntityConnections } from '@/components/ledger/entity-connections';

type ActionFn = (type: string, payload?: Row) => Promise<boolean>;

interface FlashcardItem {
  id: string;
  question: string;
  answer: string;
  subject: string;
  intervalDays: number;
  nextReviewDate: string;
  lastReviewedDate?: string;
  timesReviewed: number;
}

interface LearningResourceItem {
  id: string;
  title: string;
  type: 'Book' | 'Course' | 'Video' | 'Article' | 'Document';
  url?: string;
  status: 'To Read/Watch' | 'In Progress' | 'Completed';
  rating: number;
  notes?: string;
}

export function Learning({ data, action }: { data: Dashboard; action: ActionFn }) {
  const learningTabs = ['Overview', 'Subjects & Skills', 'Flashcards & Memory', 'Study Log', 'Resources'] as const;
  const [activeLearningTab, setActiveLearningTab] = useState<(typeof learningTabs)[number]>(() => {
    if (typeof window === 'undefined') return 'Overview';
    const saved = window.sessionStorage.getItem('life-ledger-learning-tab');
    window.sessionStorage.removeItem('life-ledger-learning-tab');
    return learningTabs.includes(saved as (typeof learningTabs)[number]) ? (saved as (typeof learningTabs)[number]) : 'Overview';
  });

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [reviewModeActive, setReviewModeActive] = useState(false);
  const [reviewCardIndex, setReviewCardIndex] = useState(0);
  const [reviewCardRevealed, setReviewCardRevealed] = useState(false);

  const [skill, setSkill] = useState({ name: '', status: 'DONT_KNOW_HOW' });
  const [session, setSession] = useState({
    skillId: '',
    minutes: '',
    focusLevel: 'Deep Focus',
    notes: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const localCards = localStorage.getItem('life-ledger-flashcards');
    const localRes = localStorage.getItem('life-ledger-resources-v2');
    
    if (localCards || localRes) {
      let flashcards = [];
      let resources = [];
      try { flashcards = JSON.parse(localCards || '[]'); } catch {}
      try { resources = JSON.parse(localRes || '[]'); } catch {}
      
      if (flashcards.length > 0 || resources.length > 0) {
        action('learning.migrate_local', { flashcards, resources }).then(() => {
          localStorage.removeItem('life-ledger-flashcards');
          localStorage.removeItem('life-ledger-resources-v2');
        });
      } else {
        localStorage.removeItem('life-ledger-flashcards');
        localStorage.removeItem('life-ledger-resources-v2');
      }
    }
  }, [action]);

  const flashcards = data.flashcards || [];
  const resources = data.learningResources || [];

  const [newCard, setNewCard] = useState({
    question: '',
    answer: '',
    subject: '',
  });
  const [newRes, setNewRes] = useState({
    title: '',
    type: 'Book' as LearningResourceItem['type'],
    url: '',
    status: 'In Progress' as LearningResourceItem['status'],
    rating: 5,
    notes: '',
    skillId: '',
  });
  const [cardSearch, setCardSearch] = useState('');
  const [cardSubjectFilter, setCardSubjectFilter] = useState('All');
  const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({});

  const totalMinutes = data.sessions.reduce((sum, s) => sum + Number(s.minutes || 0), 0);
  const totalHours = Number((totalMinutes / 60).toFixed(1));
  const activeSkillsCount = data.skills.length;
  const masteredSkillsCount = data.skills.filter((s) => ['CAN_APPLY', 'MASTERED'].includes(String(s.status))).length;

  const skillHours = data.skills
    .map((skillRow) => ({
      name: skillRow.name,
      hours: Number((data.sessions.filter((row) => row.skillId === skillRow.id).reduce((sum, row) => sum + Number(row.minutes), 0) / 60).toFixed(1)),
    }))
    .filter((row) => row.hours > 0);

  const dueFlashcards = flashcards.filter((card) => {
    if (!card.nextReviewDate) return true;
    return card.nextReviewDate <= dateKey(data.today);
  });

  const uniqueSubjects = Array.from(new Set(flashcards.map((c) => c.subject).filter(Boolean)));

  const filteredCards = flashcards.filter((c) => {
    const matchSubject = cardSubjectFilter === 'All' || c.subject === cardSubjectFilter;
    const matchQuery =
      !cardSearch.trim() ||
      c.question.toLowerCase().includes(cardSearch.toLowerCase()) ||
      c.answer.toLowerCase().includes(cardSearch.toLowerCase()) ||
      c.subject.toLowerCase().includes(cardSearch.toLowerCase());
    return matchSubject && matchQuery;
  });

  const reviewCard = (cardId: string, quality: number) => {
    const card = flashcards.find((c) => c.id === cardId);
    if (!card) return;

    let interval = 0;
    const oldEase = Number(card.easeFactor) || 2.5;
    const timesReviewed = Number(card.timesReviewed) || 0;
    let oldInterval = Number(card.interval) || 0;

    if (quality < 3) {
      interval = 1;
    } else {
      if (timesReviewed === 0) interval = 1;
      else if (timesReviewed === 1) interval = 6;
      else interval = Math.round(oldInterval * oldEase);
    }

    let newEase = oldEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEase < 1.3) newEase = 1.3;

    const nextDate = dateKey(new Date(new Date(data.today).getTime() + interval * 86400000).toISOString());
    
    action('flashcard.review', {
      id: cardId,
      easeFactor: newEase,
      interval: interval,
      timesReviewed: timesReviewed + 1,
      nextReviewDate: nextDate,
    });
    action('xp.award', {
      amount: 10,
      source: 'learning',
      note: 'Reviewed flashcard memory',
    });
  };

  useEffect(
    () =>
      listenForEntityNavigation((target) => {
        if (target.entityType !== 'learning_skill') return;
        if (!data.skills.some((item) => String(item.id) === target.entityId)) return;
        setActiveLearningTab('Subjects & Skills');
        focusEntityInView(target);
      }),
    [data.skills],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Focus Time</div>
          <div className="mt-1 text-2xl font-bold text-ink">{totalHours} hrs</div>
          <div className="mt-1 text-xs text-emerald-600 font-medium">⚡ Cumulative Study & Practice</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Learning Streak</div>
          <div className="mt-1 text-2xl font-bold text-moss">{studyStreak(data)} days</div>
          <div className="mt-1 text-xs text-slate-500 font-medium">🔥 Active Learning Habit</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mastered Subjects</div>
          <div className="mt-1 text-2xl font-bold text-brass">
            {masteredSkillsCount} / {activeSkillsCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium">🎯 Practitioner & Master Stage</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Memory Queue Due</div>
          <div className="mt-1 text-2xl font-bold text-indigo-600">{dueFlashcards.length} cards</div>
          <div className="mt-1 text-xs text-indigo-500 font-medium">🧠 Spaced Repetition Due Today</div>
        </div>
      </div>

      <SubTabs tabs={learningTabs} value={activeLearningTab} onChange={setActiveLearningTab} ariaLabel="Learning sections" />

      {/* OVERVIEW */}
      <div className={activeLearningTab === 'Overview' ? 'space-y-6' : 'hidden'}>
        {dueFlashcards.length > 0 ? (
          <div className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-purple-50/50 to-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-white text-xs font-bold">🧠</span>
                <div>
                  <h3 className="text-sm font-semibold text-indigo-950">Spaced Repetition Review Queue</h3>
                  <p className="text-xs text-indigo-700">Cards and memory items scheduled for review today based on your forgetting curve</p>
                </div>
              </div>
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">{dueFlashcards.length} Cards Due Today</span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {dueFlashcards.map((card) => {
                const isRevealed = revealedCards[card.id];
                return (
                  <div key={card.id} className="rounded-2xl border border-indigo-200/80 bg-white p-4 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800">{card.subject || 'General'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Reviewed {card.timesReviewed || 0} times</span>
                      </div>
                      <h4 className="mt-2 text-sm font-bold text-slate-900">{card.question}</h4>

                      {isRevealed ? (
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-800 border border-slate-200/60 leading-relaxed animate-in fade-in duration-200">
                          <span className="font-bold text-indigo-900 block mb-1">Answer / Explanation:</span>
                          {card.answer}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedCards((prev) => ({
                              ...prev,
                              [card.id]: true,
                            }))
                          }
                          className="mt-3 w-full rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100/60 transition"
                        >
                          👁️ Show Answer / Reveal
                        </button>
                      )}
                    </div>

                    {isRevealed ? (
                      <div className="mt-4 border-t pt-3 flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold text-slate-500">Grade Memory:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => reviewCard(card.id, 0)}
                            className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-600 hover:text-white transition"
                            title="Forget / Again"
                          >
                            Again
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewCard(card.id, 3)}
                            className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-600 hover:text-white transition"
                            title="Hard"
                          >
                            Hard
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewCard(card.id, 4)}
                            className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-600 hover:text-white transition"
                            title="Good"
                          >
                            Good
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewCard(card.id, 5)}
                            className="rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-600 hover:text-white transition"
                            title="Easy"
                          >
                            Easy
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card p-4 text-center text-xs text-slate-500">
            ✅ All memory flashcards reviewed for today! Add new cards under the <span className="font-semibold text-ink">&quot;Flashcards & Memory&quot;</span> tab.
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <Parchment title="Hours by Skill / Subject" eyebrow="Cumulative study & practice">
            {skillHours.length ? (
              <ChartBox>
                <ResponsiveContainer>
                  <BarChart data={skillHours} layout="vertical" margin={{ left: 18, bottom: 14 }}>
                    <CartesianGrid stroke={gridStroke} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false}>
                      <AxisLabel value="Hours" />
                    </XAxis>
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: colors.muted }} tickLine={false} axisLine={false} width={90}>
                      <AxisLabel value="Skill" axis="y" />
                    </YAxis>
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="hours" name="Hours" fill={colors.brass} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
            ) : (
              <ChartBox>
                <ChartPlaceholder>Log a study or practice session to view progress.</ChartPlaceholder>
              </ChartBox>
            )}
          </Parchment>

          <Parchment title="Study Streak" eyebrow="Consecutive days">
            <Stat label="Current Streak" value={`${studyStreak(data)}d`} tone="text-moss" />
            <div className="mt-5">
              <Heatmap
                days={moduleCountsByDay(
                  {
                    ...data,
                    journalEntries: [],
                    weights: [],
                    workouts: [],
                    sleep: [],
                    debtPayments: [],
                    dietLogs: [],
                    xpEvents: data.xpEvents.filter((row) => row.source === 'learning'),
                  },
                  42,
                )}
                compact
              />
            </div>
          </Parchment>
        </div>
      </div>

      {/* SUBJECTS & SKILLS */}
      <div className={activeLearningTab === 'Subjects & Skills' ? 'space-y-6' : 'hidden'}>
        {selectedSkillId ? (() => {
          const item = data.skills.find(s => s.id === selectedSkillId);
          if (!item) {
            setSelectedSkillId(null);
            return null;
          }
          const hours = Number((data.sessions.filter((row) => row.skillId === item.id).reduce((sum, row) => sum + Number(row.minutes), 0) / 60).toFixed(1));
          const linkedGoal = getLinkedEntities(data, 'learning_skill', String(item.id)).find(link => link.entityType === 'goal');
          const skillSessions = data.sessions.filter(s => s.skillId === item.id).sort((a, b) => String(b.logDate).localeCompare(String(a.logDate)));
          const skillFlashcards = flashcards.filter(c => c.skillId === item.id || (c.subject && item.name && c.subject.toLowerCase() === item.name.toLowerCase()));
          const skillResources = resources.filter(r => r.skillId === item.id);

          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button type="button" onClick={() => setSelectedSkillId(null)} className="text-xs font-semibold text-[var(--muted)] hover:text-ink transition flex items-center gap-1">
                ← Back to Subjects & Skills
              </button>
              
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-bold text-ink">{item.name}</h2>
                    <div className="mt-2 text-sm text-[var(--muted)] font-mono">{hours} total hours logged</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <EntityConnections data={data} entityType="learning_skill" entityId={String(item.id)} action={action} compact />
                  </div>
                </div>

                <div className="mt-6 border-t pt-5">
                  <h3 className="text-sm font-semibold text-ink mb-3">Current Mastery Level</h3>
                  <SkillStageProgress 
                    stage={String(item.status ?? 'DONT_KNOW_HOW')} 
                    onChange={(newStatus) => 
                      action('skill.update', {
                        id: item.id,
                        name: item.name,
                        status: newStatus,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                <div className="space-y-6">
                  <Parchment title="Study History">
                    {skillSessions.length === 0 ? <Empty tone="moss">No sessions logged for this skill yet.</Empty> : null}
                    <div className="space-y-3">
                      {skillSessions.map((sessionItem) => (
                        <ListItem
                          key={sessionItem.id}
                          title={`${sessionItem.minutes} minutes`}
                          note={`${sessionItem.logDate}${sessionItem.notes ? ` · ${sessionItem.notes}` : ''}`}
                        />
                      ))}
                    </div>
                  </Parchment>

                  <Parchment title="Linked Resources">
                    {skillResources.length === 0 ? <Empty tone="ink">No resources linked to this skill.</Empty> : null}
                    <div className="space-y-3">
                      {skillResources.map((res) => (
                        <div key={res.id} className="rounded-xl border bg-card p-3 shadow-2xs">
                          <div className="font-semibold text-sm text-ink">{res.title}</div>
                          <div className="text-xs text-[var(--muted)] mt-1">{res.type} · {res.status}</div>
                        </div>
                      ))}
                    </div>
                  </Parchment>
                </div>

                <div>
                  <Parchment title="Related Flashcards" eyebrow={`${skillFlashcards.length} cards`}>
                    {skillFlashcards.length === 0 ? <Empty tone="ink">No flashcards found for this subject.</Empty> : null}
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {skillFlashcards.map(c => (
                        <div key={c.id} className="rounded-xl border bg-card p-3 shadow-2xs">
                          <div className="text-xs font-bold text-ink">{c.question}</div>
                          <div className="mt-1.5 text-[10px] text-[var(--muted)] font-mono">Next review: {c.nextReviewDate}</div>
                        </div>
                      ))}
                    </div>
                  </Parchment>
                </div>
              </div>
            </div>
          );
        })() : (
          <Parchment title="Subjects & Skill Trees" eyebrow="Track Progression Across Any Discipline">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!skill.name.trim()) return;
              action('skill.add', {
                name: skill.name.trim(),
                status: skill.status,
              }).then(() => {
                setSkill({ name: '', status: 'DONT_KNOW_HOW' });
              });
            }}
            className="mb-6 rounded-2xl border bg-background/60 p-4 space-y-3"
          >
            <div className="grid gap-2 md:grid-cols-[1fr_220px]">
              <Field value={skill.name} onChange={(event) => setSkill({ ...skill, name: event.target.value })} placeholder="Subject or skill title..." />
              <Select value={skill.status} onChange={(event) => setSkill({ ...skill, status: event.target.value })}>
                {skillStages.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <button className="btn btn-primary">+ Add Subject / Skill</button>
            </div>
          </form>

          {data.skills.length === 0 ? <Empty tone="ink">No subjects or skills added yet. Add a subject above to begin tracking your learning roadmap!</Empty> : null}

          <div className="grid gap-4 md:grid-cols-2">
            {data.skills.map((item) => {
              const hours = Number((data.sessions.filter((row) => row.skillId === item.id).reduce((sum, row) => sum + Number(row.minutes), 0) / 60).toFixed(1));
              const linkedGoal = getLinkedEntities(data, 'learning_skill', String(item.id)).find((link) => link.entityType === 'goal');
              
              return (
                <button 
                  id={entityDomId('learning_skill', String(item.id))} 
                  key={item.id} 
                  type="button"
                  onClick={(e) => {
                    // Prevent navigation if clicking on progress bar or edit/delete buttons
                    if ((e.target as HTMLElement).closest('.mt-3, .mt-4')) return;
                    setSelectedSkillId(String(item.id));
                  }}
                  className="rounded-2xl border bg-card p-4 shadow-2xs hover:shadow-md hover:border-brass/30 transition text-left group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-base font-bold text-ink group-hover:text-brass transition">{item.name}</h4>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 font-mono">{hours} hrs logged</span>
                  </div>

                  <div className="mt-3">
                    <SkillStageProgress 
                      stage={String(item.status ?? 'DONT_KNOW_HOW')} 
                      onChange={(newStatus) => 
                        action('skill.update', {
                          id: item.id,
                          name: item.name,
                          status: newStatus,
                        })
                      }
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <div className="flex items-center gap-2">
                      <EntityConnections data={data} entityType="learning_skill" entityId={String(item.id)} action={action} compact />
                      <button
                        className="rounded-lg px-2 py-1 text-xs text-brass hover:bg-brass/10"
                        onClick={() => {
                          const name = ask('Skill name', item.name);
                          if (name)
                            action('skill.update', {
                              id: item.id,
                              name,
                              status: item.status,
                            });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg px-2 py-1 text-xs text-wax hover:bg-wax/10"
                        onClick={() =>
                          action('skill.delete', {
                            id: item.id,
                            label: 'Skill',
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Parchment>
        )}
      </div>

      {/* FLASHCARDS */}
      <div className={activeLearningTab === 'Flashcards & Memory' ? 'space-y-6' : 'hidden'}>
        <Parchment title="Flashcards & Memory Vault" eyebrow="Spaced Repetition Memory System">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCard.question.trim() || !newCard.answer.trim()) return;
              action('flashcard.add', {
                question: newCard.question.trim(),
                answer: newCard.answer.trim(),
                subject: newCard.subject.trim() || 'General',
              });
              setNewCard({ question: '', answer: '', subject: '' });
              action('xp.award', {
                amount: 15,
                source: 'learning',
                note: `Added Flashcard ${newCard.question}`,
              });
            }}
            className="mb-6 rounded-2xl border bg-background/60 p-4 space-y-3"
          >
            <div className="grid gap-2 md:grid-cols-[1fr_180px]">
              <Field placeholder="Question, prompt, or concept title..." value={newCard.question} onChange={(e) => setNewCard({ ...newCard, question: e.target.value })} />
              <Field placeholder="Subject / Tag..." value={newCard.subject} onChange={(e) => setNewCard({ ...newCard, subject: e.target.value })} />
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <TextArea
                placeholder="Answer, key explanation, formula, or solution details..."
                value={newCard.answer}
                onChange={(e) => setNewCard({ ...newCard, answer: e.target.value })}
                className="min-h-16"
              />
              <button className="btn btn-primary self-end">+ Create Card</button>
            </div>
          </form>

          {reviewModeActive && dueFlashcards.length > 0 ? (
            <div className="mb-6 rounded-2xl border border-indigo-200 bg-card p-6 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                  <span>🧠</span> Review Session
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  Card {reviewCardIndex + 1} of {dueFlashcards.length}
                </div>
              </div>

              {dueFlashcards[reviewCardIndex] ? (() => {
                const c = dueFlashcards[reviewCardIndex];
                return (
                  <div className="min-h-[200px] flex flex-col justify-center text-center">
                    <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 self-center mb-4">{c.subject || 'General'}</span>
                    <h3 className="text-xl font-bold text-ink mb-6">{c.question}</h3>
                    
                    {reviewCardRevealed ? (
                      <div className="animate-in fade-in duration-200">
                        <div className="w-16 h-px bg-slate-200 mx-auto mb-6"></div>
                        <div className="text-sm text-slate-800 leading-relaxed max-w-2xl mx-auto mb-8">
                          {c.answer}
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <button type="button" onClick={() => { reviewCard(c.id, 0); setReviewCardRevealed(false); }} className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-600 hover:text-white transition">Again (1d)</button>
                          <button type="button" onClick={() => { reviewCard(c.id, 3); setReviewCardRevealed(false); }} className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-600 hover:text-white transition">Hard</button>
                          <button type="button" onClick={() => { reviewCard(c.id, 4); setReviewCardRevealed(false); }} className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-600 hover:text-white transition">Good</button>
                          <button type="button" onClick={() => { reviewCard(c.id, 5); setReviewCardRevealed(false); }} className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-600 hover:text-white transition">Easy</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setReviewCardRevealed(true)} className="mx-auto rounded-xl bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition shadow-sm">
                        Show Answer
                      </button>
                    )}
                  </div>
                );
              })() : (
                <div className="text-center py-8">
                  <div className="text-2xl mb-2">🎉</div>
                  <h3 className="text-lg font-bold text-ink">Session Complete!</h3>
                  <p className="text-sm text-slate-500 mt-1">You've reviewed all due cards.</p>
                  <button type="button" onClick={() => setReviewModeActive(false)} className="mt-6 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">
                    Close Session
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {!reviewModeActive && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {dueFlashcards.length > 0 && (
                  <button 
                    type="button" 
                    onClick={() => { setReviewCardIndex(0); setReviewCardRevealed(false); setReviewModeActive(true); }}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition flex items-center gap-1.5"
                  >
                    <span>🧠</span> Review Due Cards ({dueFlashcards.length})
                  </button>
                )}
                <div className="flex items-center gap-2 border-l pl-3 ml-1">
                  <Field placeholder="Search flashcards..." value={cardSearch} onChange={(e) => setCardSearch(e.target.value)} className="w-56 text-xs" />
                  <Select value={cardSubjectFilter} onChange={(e) => setCardSubjectFilter(e.target.value)} className="text-xs py-1">
                    <option value="All">All Subjects</option>
                    {uniqueSubjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <span className="text-xs text-slate-500 font-mono">{filteredCards.length} Cards Total</span>
            </div>
          )}

          {!reviewModeActive && filteredCards.length === 0 ? <Empty tone="ink">No flashcards found. Create a flashcard above to start building your memory vault!</Empty> : null}

          {!reviewModeActive && (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredCards.map((c) => {
              const isRevealed = revealedCards[c.id];
              return (
                <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-2xs hover:shadow-md transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">{c.subject || 'General'}</span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>Reviewed {c.timesReviewed || 0}x</span>
                        <button type="button" onClick={() => action('flashcard.delete', { id: c.id, label: 'Flashcard' })} className="hover:text-red-600 transition" title="Delete card">
                          ✕
                        </button>
                      </div>
                    </div>

                    <h4 className="mt-2.5 text-base font-bold text-ink">{c.question}</h4>

                    {isRevealed ? (
                      <div className="mt-3 rounded-xl bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-800 border border-slate-200/60 animate-in fade-in duration-200">
                        <span className="font-bold text-slate-900 block mb-1">Answer / Details:</span>
                        {c.answer}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 border-t pt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedCards((prev) => ({
                          ...prev,
                          [c.id]: !prev[c.id],
                        }))
                      }
                      className="text-xs font-semibold text-brass hover:underline"
                    >
                      {isRevealed ? '🙈 Hide Answer' : '👁️ Reveal Answer'}
                    </button>
                    <span className="text-[10px] text-slate-400 font-mono">Next review: {c.nextReviewDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </Parchment>
      </div>

      {/* STUDY LOG */}
      <div className={activeLearningTab === 'Study Log' ? 'space-y-6' : 'hidden'}>
        <Parchment title="Study & Practice Sessions" eyebrow="Timer & Session Logger">
          <form
            onSubmit={(e) =>
              submit(e, () =>
                action('learning.add', {
                  skillId: session.skillId,
                  minutes: session.minutes,
                  notes: `${session.focusLevel ? `[${session.focusLevel}] ` : ''}${session.notes}`,
                }).then(() =>
                  setSession({
                    skillId: '',
                    minutes: '',
                    focusLevel: 'Deep Focus',
                    notes: '',
                  }),
                ),
              )
            }
            className="mb-6 rounded-2xl border bg-background/60 p-4 space-y-3"
          >
            <div className="grid gap-2 md:grid-cols-[1fr_160px_160px_auto]">
              <Select value={session.skillId} onChange={(e) => setSession({ ...session, skillId: e.target.value })}>
                <option value="">Select Subject / Skill</option>
                {data.skills.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
              <Field placeholder="Duration (Minutes)" type="number" value={session.minutes} onChange={(e) => setSession({ ...session, minutes: e.target.value })} />
              <Select value={session.focusLevel} onChange={(e) => setSession({ ...session, focusLevel: e.target.value })}>
                <option value="Deep Focus">⚡ Deep Focus</option>
                <option value="Light Review">📖 Light Review</option>
                <option value="Practice Problems">📝 Practice Problems</option>
                <option value="Reading">📚 Reading</option>
                <option value="Casual">☕ Casual</option>
                <option value="Group Study">👥 Group Study</option>
              </Select>
              <button className="btn btn-primary">Log Session</button>
            </div>
            <Field placeholder="Session notes, takeaways, or exercises completed..." value={session.notes} onChange={(e) => setSession({ ...session, notes: e.target.value })} />
          </form>

          {data.sessions.length === 0 ? <Empty tone="moss">No study sessions logged yet. Log your first session above!</Empty> : null}

          <div className="space-y-3">
            {data.sessions.map((item) => (
              <ListItem
                key={item.id}
                title={`${item.minutes} minutes`}
                note={`${item.logDate}${item.skill?.name ? ` · ${item.skill.name}` : ''}${item.notes ? ` · ${item.notes}` : ''}`}
                onEdit={() => {
                  const minutes = ask('Minutes studied', item.minutes);
                  if (minutes == null) return;
                  const notes = ask('Notes', item.notes ?? '');
                  action('learning.update', {
                    id: item.id,
                    skillId: item.skillId ?? null,
                    minutes,
                    notes,
                  });
                }}
                onDelete={() =>
                  action('learning.delete', {
                    id: item.id,
                    label: 'Learning session',
                  })
                }
              />
            ))}
          </div>
        </Parchment>
      </div>

      {/* RESOURCES */}
      <div className={activeLearningTab === 'Resources' ? 'space-y-6' : 'hidden'}>
        <Parchment title="Resource Library & Bookmarks" eyebrow="Learning Materials & References">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newRes.title.trim()) return;
              action('learningResource.add', {
                title: newRes.title.trim(),
                type: newRes.type,
                url: newRes.url.trim() || undefined,
                status: newRes.status,
                rating: Number(newRes.rating),
                notes: newRes.notes.trim() || undefined,
                skillId: newRes.skillId || undefined,
              });
              setNewRes({
                title: '',
                type: 'Book',
                url: '',
                status: 'In Progress',
                rating: 5,
                notes: '',
                skillId: '',
              });
              action('xp.award', {
                amount: 10,
                source: 'learning',
                note: `Added Resource ${newRes.title}`,
              });
            }}
            className="mb-6 rounded-2xl border bg-background/60 p-4 space-y-3"
          >
            <div className="grid gap-2 md:grid-cols-[1.2fr_130px_140px_120px]">
              <Field placeholder="Resource title..." value={newRes.title} onChange={(e) => setNewRes({ ...newRes, title: e.target.value })} />
              <Select
                value={newRes.type}
                onChange={(e) =>
                  setNewRes({
                    ...newRes,
                    type: e.target.value as LearningResourceItem['type'],
                  })
                }
              >
                <option value="Book">📖 Book</option>
                <option value="Course">🎓 Course</option>
                <option value="Video">📺 Video</option>
                <option value="Article">📄 Article</option>
                <option value="Document">📑 Document</option>
              </Select>
              <Select
                value={newRes.status}
                onChange={(e) =>
                  setNewRes({
                    ...newRes,
                    status: e.target.value as LearningResourceItem['status'],
                  })
                }
              >
                <option value="To Read/Watch">To Read/Watch</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </Select>
              <Select value={newRes.rating} onChange={(e) => setNewRes({ ...newRes, rating: Number(e.target.value) })}>
                <option value="5">⭐⭐⭐⭐⭐ (5)</option>
                <option value="4">⭐⭐⭐⭐ (4)</option>
                <option value="3">⭐⭐⭐ (3)</option>
              </Select>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
              <Field placeholder="URL or link (optional)" type="url" value={newRes.url} onChange={(e) => setNewRes({ ...newRes, url: e.target.value })} />
              <Select value={newRes.skillId} onChange={(e) => setNewRes({ ...newRes, skillId: e.target.value })}>
                <option value="">Link to Skill/Subject (Optional)</option>
                {data.skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <Field placeholder="Key takeaways or summary notes..." value={newRes.notes} onChange={(e) => setNewRes({ ...newRes, notes: e.target.value })} />
              <button className="btn btn-primary">+ Add Resource</button>
            </div>
          </form>

          {resources.length === 0 ? <Empty tone="ink">No learning resources tracked yet. Add books, courses, or videos above!</Empty> : null}

          <div className="grid gap-4 md:grid-cols-2">
            {resources.map((res) => (
              <div key={res.id} className="rounded-2xl border bg-card p-4 shadow-2xs hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {res.type === 'Book' ? '📖 Book' : res.type === 'Course' ? '🎓 Course' : res.type === 'Video' ? '📺 Video' : '📄 Resource'}
                    </span>
                    <h4 className="mt-1.5 text-base font-bold text-ink">{res.title}</h4>
                  </div>
                  <Select
                    value={res.status}
                    onChange={(e) =>
                      action('learningResource.update', {
                        ...res,
                        status: e.target.value,
                      })
                    }
                    className="text-xs py-0.5"
                  >
                    <option value="To Read/Watch">To Read/Watch</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed ✓</option>
                  </Select>
                </div>

                {res.notes && <p className="mt-3 text-xs leading-relaxed text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">{res.notes}</p>}

                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
                  <span className="text-amber-500 font-bold">{'★'.repeat(res.rating)}</span>
                  <div className="flex items-center gap-3">
                    {res.url ? (
                      <a href={res.url} target="_blank" rel="noreferrer" className="font-semibold text-brass hover:underline">
                        Open Link ↗
                      </a>
                    ) : null}
                    <button type="button" onClick={() => action('learningResource.delete', { id: res.id, label: 'Resource' })} className="text-slate-400 hover:text-red-600">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Parchment>
      </div>
    </div>
  );
}
