import {
  containsWholeKeyword,
  suggestDebtTransactionLinks,
  suggestJournalLearningLinks,
} from './entity-link-suggestions';

describe('entity-link suggestions', () => {
  describe('journal and learning suggestions', () => {
    it('matches skill names on word boundaries and deduplicates sessions', () => {
      const suggestions = suggestJournalLearningLinks({
        journals: [
          {
            id: 'journal-1',
            entryDate: '2026-07-23',
            body: 'Practised Java today. JavaScript was a separate topic.',
          },
        ],
        skills: [{ id: 'skill-java', name: 'Java' }],
        sessions: [
          {
            id: 'session-1',
            skillId: 'skill-java',
            logDate: '2026-07-23',
          },
          {
            id: 'session-2',
            skillId: 'skill-java',
            logDate: '2026-07-23',
          },
          {
            id: 'session-yesterday',
            skillId: 'skill-java',
            logDate: '2026-07-22',
          },
        ],
      });

      expect(suggestions).toEqual([
        {
          journalEntryId: 'journal-1',
          skillId: 'skill-java',
          skillName: 'Java',
          sessionId: 'session-1',
          sessionIds: ['session-1', 'session-2'],
          logDate: '2026-07-23',
        },
      ]);
      expect(containsWholeKeyword('Only JavaScript today', 'Java')).toBe(false);
      expect(containsWholeKeyword('C++ practice', 'C++')).toBe(true);
    });

    it('does not suggest a link that already exists in reverse direction', () => {
      expect(
        suggestJournalLearningLinks({
          journals: [
            {
              id: 'journal-1',
              entryDate: '2026-07-23',
              body: 'Worked on TypeScript.',
            },
          ],
          skills: [{ id: 'skill-1', name: 'TypeScript' }],
          sessions: [
            {
              id: 'session-1',
              skillId: 'skill-1',
              logDate: '2026-07-23',
            },
          ],
          entityLinks: [
            {
              sourceType: 'learning_skill',
              sourceId: 'skill-1',
              targetType: 'journal_entry',
              targetId: 'journal-1',
            },
          ],
        }),
      ).toEqual([]);
    });
  });

  describe('debt transaction suggestions', () => {
    it('matches a Debt-tagged transaction to the monthly due date', () => {
      const suggestions = suggestDebtTransactionLinks({
        transactions: [
          {
            id: 'transaction-1',
            transactionDate: '2026-02-28',
            category: ' Debt ',
            status: 'confirmed',
            amount: 9500,
          },
          {
            id: 'not-debt',
            transactionDate: '2026-02-28',
            category: 'Groceries',
            status: 'confirmed',
            amount: 9500,
          },
        ],
        debts: [
          {
            id: 'debt-1',
            name: 'Home loan',
            dueDay: 31,
            balance: 300000,
            emiAmount: 9500,
          },
          {
            id: 'debt-2',
            name: 'Car loan',
            dueDay: 15,
            balance: 100000,
            emiAmount: 7000,
          },
        ],
      });

      expect(suggestions).toEqual([
        {
          transactionId: 'transaction-1',
          debtId: 'debt-1',
          debtName: 'Home loan',
          transactionDate: '2026-02-28',
          amount: 9500,
          expectedAmount: 9500,
        },
      ]);
    });

    it('honours an explicit expected date and skips existing reverse links', () => {
      expect(
        suggestDebtTransactionLinks({
          transactions: [
            {
              id: 'transaction-1',
              transactionDate: '2026-07-23',
              category: 'Debt',
              status: 'confirmed',
              amount: 1000,
            },
          ],
          debts: [
            {
              id: 'debt-1',
              name: 'Loan',
              dueDay: 1,
              expectedPaymentDate: '2026-07-23',
              balance: 5000,
            },
          ],
          entityLinks: [
            {
              sourceType: 'finance_debt',
              sourceId: 'debt-1',
              targetType: 'finance_transaction',
              targetId: 'transaction-1',
            },
          ],
        }),
      ).toEqual([]);
    });

    it('uses the amortization scheduler clamp of day 28', () => {
      const suggestions = suggestDebtTransactionLinks({
        transactions: [
          {
            id: 'on-scheduled-day',
            transactionDate: '2026-07-28',
            category: 'Debt',
            status: 'confirmed',
            amount: 500,
          },
          {
            id: 'on-unclamped-day',
            transactionDate: '2026-07-31',
            category: 'Debt',
            status: 'confirmed',
            amount: 500,
          },
        ],
        debts: [
          {
            id: 'debt-1',
            name: 'Legacy day-31 loan',
            dueDay: 31,
            balance: 5000,
            emiAmount: 500,
          },
        ],
      });

      expect(suggestions.map((suggestion) => suggestion.transactionId)).toEqual(
        ['on-scheduled-day'],
      );
    });
  });
});
