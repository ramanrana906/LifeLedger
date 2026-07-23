export const ENTITY_TYPES = [
  'goal',
  'habit',
  'routine',
  'routine_step',
  'learning_skill',
  'finance_debt',
  'finance_savings',
  'finance_transaction',
  'journal_entry',
] as const;

export type EntityTypeValue = (typeof ENTITY_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  'linked',
  'supports',
  'feeds',
  'triggered_by',
] as const;

export type RelationshipTypeValue = (typeof RELATIONSHIP_TYPES)[number];

export type EntityEndpoint = {
  type: EntityTypeValue;
  id: string;
};

export type EntityLinkRecord = {
  id?: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationshipType?: string | null;
};

export function isEntityType(value: unknown): value is EntityTypeValue {
  return ENTITY_TYPES.includes(value as EntityTypeValue);
}

export function isRelationshipType(
  value: unknown,
): value is RelationshipTypeValue {
  return RELATIONSHIP_TYPES.includes(value as RelationshipTypeValue);
}

export function canonicalizeLink(left: EntityEndpoint, right: EntityEndpoint) {
  const leftKey = `${left.type}:${left.id}`;
  const rightKey = `${right.type}:${right.id}`;
  if (leftKey === rightKey) {
    throw new Error('An entity cannot be linked to itself.');
  }
  return leftKey < rightKey
    ? {
        sourceType: left.type,
        sourceId: left.id,
        targetType: right.type,
        targetId: right.id,
      }
    : {
        sourceType: right.type,
        sourceId: right.id,
        targetType: left.type,
        targetId: left.id,
      };
}

export function linkPeer(
  link: EntityLinkRecord,
  type: EntityTypeValue,
  id: string,
): EntityEndpoint | null {
  if (link.sourceType === type && String(link.sourceId) === String(id)) {
    return isEntityType(link.targetType)
      ? { type: link.targetType, id: String(link.targetId) }
      : null;
  }
  if (link.targetType === type && String(link.targetId) === String(id)) {
    return isEntityType(link.sourceType)
      ? { type: link.sourceType, id: String(link.sourceId) }
      : null;
  }
  return null;
}

export function linkedPeers(
  links: EntityLinkRecord[],
  type: EntityTypeValue,
  id: string,
  relationshipType?: RelationshipTypeValue,
) {
  return links
    .filter(
      (link) => !relationshipType || link.relationshipType === relationshipType,
    )
    .map((link) => linkPeer(link, type, id))
    .filter((peer): peer is EntityEndpoint => peer != null);
}
