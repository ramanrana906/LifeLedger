import { isEntityType } from './entity-linking';
import type { EntityEndpoint } from './entity-linking';

export type EntityRef = EntityEndpoint;

export interface EntityLinkLike {
  sourceType?: unknown;
  sourceId?: unknown;
  targetType?: unknown;
  targetId?: unknown;
}

export type EntityLinkGraph = ReadonlyMap<
  string,
  ReadonlyMap<string, EntityRef>
>;

export function entityRefKey(ref: EntityRef) {
  return `${ref.type}:${ref.id}`;
}

export function buildEntityLinkGraph(
  links: readonly EntityLinkLike[],
): EntityLinkGraph {
  const graph = new Map<string, Map<string, EntityRef>>();

  for (const link of links) {
    const source = parseEntityRef(link.sourceType, link.sourceId);
    const target = parseEntityRef(link.targetType, link.targetId);
    if (!source || !target) continue;

    addNeighbour(graph, source, target);
    addNeighbour(graph, target, source);
  }

  return graph;
}

/**
 * Returns the complete connected component for an entity, including the entity
 * itself. Entity links are stored once but are deliberately traversed in both
 * directions. A visited set makes cycles and duplicate rows safe.
 */
export function traverseEntityLinks(
  start: EntityRef,
  linksOrGraph: readonly EntityLinkLike[] | EntityLinkGraph,
  maxDepth = Number.POSITIVE_INFINITY,
) {
  const normalizedStart = parseEntityRef(start.type, start.id);
  if (!normalizedStart) return [];

  const graph: EntityLinkGraph = isEntityLinkGraph(linksOrGraph)
    ? linksOrGraph
    : buildEntityLinkGraph(linksOrGraph);
  const depthLimit = Number.isFinite(maxDepth)
    ? Math.max(0, Math.floor(maxDepth))
    : Number.POSITIVE_INFINITY;
  const queue: Array<{ entity: EntityRef; depth: number }> = [
    { entity: normalizedStart, depth: 0 },
  ];
  const visited = new Set<string>();
  const connected: EntityRef[] = [];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    const currentKey = entityRefKey(current.entity);
    if (visited.has(currentKey)) continue;

    visited.add(currentKey);
    connected.push(current.entity);
    if (current.depth >= depthLimit) continue;

    for (const neighbour of graph.get(currentKey)?.values() ?? []) {
      if (!visited.has(entityRefKey(neighbour))) {
        queue.push({ entity: neighbour, depth: current.depth + 1 });
      }
    }
  }

  return connected;
}

export function hasDirectEntityLink(
  links: readonly EntityLinkLike[],
  left: EntityRef,
  right: EntityRef,
) {
  const leftKey = entityRefKey(left);
  const rightKey = entityRefKey(right);

  return links.some((link) => {
    const source = parseEntityRef(link.sourceType, link.sourceId);
    const target = parseEntityRef(link.targetType, link.targetId);
    if (!source || !target) return false;

    const sourceKey = entityRefKey(source);
    const targetKey = entityRefKey(target);
    return (
      (sourceKey === leftKey && targetKey === rightKey) ||
      (sourceKey === rightKey && targetKey === leftKey)
    );
  });
}

function addNeighbour(
  graph: Map<string, Map<string, EntityRef>>,
  entity: EntityRef,
  neighbour: EntityRef,
) {
  const key = entityRefKey(entity);
  const neighbours = graph.get(key) ?? new Map<string, EntityRef>();
  neighbours.set(entityRefKey(neighbour), neighbour);
  graph.set(key, neighbours);
}

function parseEntityRef(type: unknown, id: unknown): EntityRef | null {
  if (!isEntityType(type) || typeof id !== 'string') return null;

  const normalizedId = id.trim();
  if (!normalizedId) return null;
  return { type, id: normalizedId };
}

function isEntityLinkGraph(
  value: readonly EntityLinkLike[] | EntityLinkGraph,
): value is EntityLinkGraph {
  return !Array.isArray(value);
}
