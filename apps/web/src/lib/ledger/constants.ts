export const tabs = [
  { key: 'Today', icon: 'sun' },
  { key: 'Goals', icon: 'target' },
  { key: 'Finance', icon: 'coins' },
  { key: 'Health', icon: 'heart' },
  { key: 'Relationships', icon: 'users' },
  { key: 'Learning', icon: 'book' },
  { key: 'Habits', icon: 'repeat' },
  { key: 'Routines', icon: 'routine' },
  { key: 'Review', icon: 'chart' },
  { key: 'Settings', icon: 'settings' },
] as const;

export const moduleOptions = [
  { key: 'journal', label: 'Journal', tab: 'Today' },
  { key: 'goals', label: 'Goals', tab: 'Goals' },
  { key: 'finance', label: 'Finance', tab: 'Finance' },
  { key: 'health', label: 'Health', tab: 'Health' },
  { key: 'sleep', label: 'Sleep', tab: 'Health', healthTab: 'Sleep' },
  { key: 'relationships', label: 'Relationships', tab: 'Relationships' },
  { key: 'learning', label: 'Learning', tab: 'Learning' },
  { key: 'habits', label: 'Habits', tab: 'Habits' },
  { key: 'routines', label: 'Routines', tab: 'Routines' },
] as const;

export const moods = ['Strong', 'Steady', 'Tired', 'Low', 'Restless'];

export const fourThieves = [
  'Inability to say no',
  'Fear of things falling apart',
  'Poor health/energy',
  'Unsupportive environment',
];

export const rangeOptions = [7, 30, 90, 9999] as const;

export const colors = {
  brass: '#4F46E5',
  brassDeep: '#4338CA',
  moss: '#10B981',
  wax: '#EF4444',
  warning: '#F59E0B',
  ai: '#8B5CF6',
  cyan: '#06B6D4',
  neutral: '#94A3B8',
  rule: '#E5E7EB',
  ink: '#111827',
  muted: '#6B7280',
  card: '#ffffff',
};

export const gridStroke = '#F1F5F9';

export const skillStages = [
  { value: 'DONT_KNOW_HOW', label: "Don't know how" },
  { value: 'KNOW_HOW_NOT_DONE', label: "Know how, haven't done it" },
  { value: 'CAN_DO_IT', label: 'Can do it' },
  { value: 'DO_IT_WELL', label: 'Do it well' },
  { value: 'COACH_IT', label: 'Coach it' },
] as const;
