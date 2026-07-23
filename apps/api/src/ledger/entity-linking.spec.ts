import { canonicalizeLink, isEntityType, linkedPeers } from './entity-linking';

describe('entity linking', () => {
  it('canonicalizes the same pair identically in either direction', () => {
    const goal = { type: 'goal' as const, id: 'bbbb' };
    const habit = { type: 'habit' as const, id: 'aaaa' };
    expect(canonicalizeLink(goal, habit)).toEqual(
      canonicalizeLink(habit, goal),
    );
  });

  it('rejects self-links', () => {
    expect(() =>
      canonicalizeLink(
        { type: 'goal', id: 'same' },
        { type: 'goal', id: 'same' },
      ),
    ).toThrow('cannot be linked to itself');
  });

  it('resolves links bidirectionally and filters by relationship', () => {
    const links = [
      {
        sourceType: 'goal',
        sourceId: 'goal-1',
        targetType: 'habit',
        targetId: 'habit-1',
        relationshipType: 'supports',
      },
      {
        sourceType: 'finance_debt',
        sourceId: 'debt-1',
        targetType: 'goal',
        targetId: 'goal-1',
        relationshipType: 'feeds',
      },
    ];
    expect(linkedPeers(links, 'goal', 'goal-1')).toEqual([
      { type: 'habit', id: 'habit-1' },
      { type: 'finance_debt', id: 'debt-1' },
    ]);
    expect(linkedPeers(links, 'goal', 'goal-1', 'supports')).toEqual([
      { type: 'habit', id: 'habit-1' },
    ]);
  });

  it('accepts only supported entity types', () => {
    expect(isEntityType('routine_step')).toBe(true);
    expect(isEntityType('made_up')).toBe(false);
  });
});
