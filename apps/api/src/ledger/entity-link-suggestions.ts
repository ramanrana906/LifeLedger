import { EntityLinkLike, hasDirectEntityLink } from './entity-link-graph';

type Row = Record<string, unknown>;

export interface JournalLearningLinkSuggestion {
  journalEntryId: string;
  skillId: string;
  skillName: string;
  sessionId: string;
  sessionIds: string[];
  logDate: string;
}

export interface DebtTransactionLinkSuggestion {
  transactionId: string;
  debtId: string;
  debtName: string;
  transactionDate: string;
  amount: number | null;
  expectedAmount: number | null;
}

export function suggestJournalLearningLinks(input: {
  journals: Row[];
  sessions: Row[];
  skills: Row[];
  entityLinks?: EntityLinkLike[];
}): JournalLearningLinkSuggestion[] {
  const links = input.entityLinks ?? [];
  const skills = new Map(
    input.skills
      .filter(isActive)
      .map((skill) => [stringValue(skill.id), stringValue(skill.name)])
      .filter((entry): entry is [string, string] =>
        Boolean(entry[0] && entry[1]),
      ),
  );
  const journalsByDate = groupByDate(
    input.journals.filter(isActive),
    'entryDate',
  );
  const suggestions = new Map<string, JournalLearningLinkSuggestion>();

  for (const session of input.sessions.filter(isActive)) {
    const skillId = stringValue(session.skillId);
    const sessionId = stringValue(session.id);
    const logDate = dateKey(session.logDate);
    if (!skillId || !sessionId || !logDate) continue;

    const embeddedSkill = asRow(session.skill);
    const skillName =
      skills.get(skillId) ?? stringValue(embeddedSkill?.name)?.trim();
    if (!skillName) continue;

    for (const journal of journalsByDate.get(logDate) ?? []) {
      const journalEntryId = stringValue(journal.id);
      const body = stringValue(journal.body);
      if (
        !journalEntryId ||
        !body ||
        !containsWholeKeyword(body, skillName) ||
        hasDirectEntityLink(
          links,
          { type: 'journal_entry', id: journalEntryId },
          { type: 'learning_skill', id: skillId },
        )
      ) {
        continue;
      }

      const key = `${journalEntryId}:${skillId}`;
      const existing = suggestions.get(key);
      if (existing) {
        if (!existing.sessionIds.includes(sessionId)) {
          existing.sessionIds.push(sessionId);
        }
        continue;
      }

      suggestions.set(key, {
        journalEntryId,
        skillId,
        skillName,
        sessionId,
        sessionIds: [sessionId],
        logDate,
      });
    }
  }

  return [...suggestions.values()];
}

export function suggestDebtTransactionLinks(input: {
  transactions: Row[];
  debts: Row[];
  entityLinks?: EntityLinkLike[];
}): DebtTransactionLinkSuggestion[] {
  const links = input.entityLinks ?? [];
  const suggestions: DebtTransactionLinkSuggestion[] = [];
  const seen = new Set<string>();

  for (const transaction of input.transactions.filter(isActive)) {
    const transactionId = stringValue(transaction.id);
    const transactionDate = dateKey(transaction.transactionDate);
    const category = stringValue(transaction.category)?.trim().toLowerCase();
    const status = stringValue(transaction.status)?.trim().toLowerCase();
    if (
      !transactionId ||
      !transactionDate ||
      category !== 'debt' ||
      (status && status !== 'confirmed')
    ) {
      continue;
    }

    for (const debt of input.debts.filter(isActive)) {
      const debtId = stringValue(debt.id);
      const debtName = stringValue(debt.name);
      if (
        !debtId ||
        !debtName ||
        isClearedDebt(debt) ||
        !matchesExpectedPaymentDate(transactionDate, debt) ||
        hasDirectEntityLink(
          links,
          { type: 'finance_transaction', id: transactionId },
          { type: 'finance_debt', id: debtId },
        )
      ) {
        continue;
      }

      const key = `${transactionId}:${debtId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push({
        transactionId,
        debtId,
        debtName,
        transactionDate,
        amount: numberValue(transaction.amount),
        expectedAmount: numberValue(debt.emiAmount),
      });
    }
  }

  return suggestions;
}

/**
 * Performs a case-insensitive literal match while protecting both sides from
 * adjacent Unicode letters, numbers, or underscores. This prevents a skill
 * such as "Java" from matching "JavaScript".
 */
export function containsWholeKeyword(text: string, keyword: string) {
  const needle = keyword.normalize('NFKC').trim().toLocaleLowerCase();
  if (!needle) return false;

  const haystack = text.normalize('NFKC').toLocaleLowerCase();
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    const before = index > 0 ? haystack[index - 1] : '';
    const afterIndex = index + needle.length;
    const after = afterIndex < haystack.length ? haystack[afterIndex] : '';
    if (!isWordCharacter(before) && !isWordCharacter(after)) return true;
    index = haystack.indexOf(needle, index + 1);
  }
  return false;
}

function matchesExpectedPaymentDate(transactionDate: string, debt: Row) {
  const explicitDate = dateKey(
    debt.expectedPaymentDate ?? debt.nextPaymentDate ?? debt.dueDate,
  );
  if (explicitDate) return explicitDate === transactionDate;

  const dueDay = numberValue(debt.dueDay);
  if (dueDay == null) return false;

  const parsed = parseDate(transactionDate);
  if (!parsed) return false;
  const scheduledDay = Math.min(Math.max(Math.floor(dueDay), 1), 28);
  return parsed.getUTCDate() === scheduledDay;
}

function groupByDate(rows: Row[], dateField: string) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const date = dateKey(row[dateField]);
    if (!date) continue;
    grouped.set(date, [...(grouped.get(date) ?? []), row]);
  }
  return grouped;
}

function dateKey(value: unknown) {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function parseDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(
    value.length === 10 ? `${value}T00:00:00.000Z` : value,
  );
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function isWordCharacter(value: string) {
  return value ? /[\p{L}\p{N}_]/u.test(value) : false;
}

function isActive(row: Row) {
  return !row.deletedAt;
}

function isClearedDebt(debt: Row) {
  const balance = numberValue(debt.balance);
  return balance != null && balance <= 0;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function numberValue(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRow(value: unknown): Row | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Row)
    : null;
}
