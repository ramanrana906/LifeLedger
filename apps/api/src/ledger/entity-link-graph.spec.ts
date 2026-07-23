import {
  buildEntityLinkGraph,
  entityRefKey,
  hasDirectEntityLink,
  traverseEntityLinks,
} from './entity-link-graph';

describe('entity-link graph', () => {
  const links = [
    {
      sourceType: 'goal',
      sourceId: 'goal-1',
      targetType: 'finance_debt',
      targetId: 'debt-1',
    },
    {
      sourceType: 'finance_transaction',
      sourceId: 'transaction-1',
      targetType: 'finance_debt',
      targetId: 'debt-1',
    },
    {
      sourceType: 'finance_transaction',
      sourceId: 'transaction-1',
      targetType: 'routine',
      targetId: 'routine-1',
    },
    {
      sourceType: 'routine',
      sourceId: 'routine-1',
      targetType: 'goal',
      targetId: 'goal-1',
    },
  ];

  it('traverses stored links in both directions without looping on cycles', () => {
    const connected = traverseEntityLinks(
      { type: 'finance_debt', id: 'debt-1' },
      links,
    );

    expect(new Set(connected.map(entityRefKey))).toEqual(
      new Set([
        'finance_debt:debt-1',
        'goal:goal-1',
        'finance_transaction:transaction-1',
        'routine:routine-1',
      ]),
    );
  });

  it('deduplicates duplicate paths and can constrain traversal depth', () => {
    const graph = buildEntityLinkGraph([
      ...links,
      links[0],
      {
        sourceType: 'goal',
        sourceId: 'goal-1',
        targetType: 'goal',
        targetId: 'goal-1',
      },
    ]);

    expect(
      traverseEntityLinks({ type: 'goal', id: 'goal-1' }, graph, 1).map(
        entityRefKey,
      ),
    ).toEqual(['goal:goal-1', 'finance_debt:debt-1', 'routine:routine-1']);
  });

  it('recognizes a direct link regardless of stored direction', () => {
    expect(
      hasDirectEntityLink(
        links,
        { type: 'finance_debt', id: 'debt-1' },
        { type: 'goal', id: 'goal-1' },
      ),
    ).toBe(true);
    expect(
      hasDirectEntityLink(
        links,
        { type: 'habit', id: 'habit-1' },
        { type: 'goal', id: 'goal-1' },
      ),
    ).toBe(false);
  });
});
