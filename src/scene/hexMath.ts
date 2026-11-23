import type { HexCoord, HexTile, TileType } from '../types/office';

export const HEX_RADIUS = 1.62;
export const HEX_GAP = 0.08;
export const EFFECTIVE_RADIUS = HEX_RADIUS + HEX_GAP;

const SQRT3 = Math.sqrt(3);

export const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

/**
 * Pointy-top axial coordinates to world X/Z plane.
 */
export function hexToWorld(q: number, r: number): { x: number; z: number } {
  const x = EFFECTIVE_RADIUS * (SQRT3 * q + (SQRT3 / 2) * r);
  const z = EFFECTIVE_RADIUS * ((3 / 2) * r);
  return { x, z };
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

export function isTilePassable(type: TileType, isDestination: boolean): boolean {
  if (type === 'walkway' || type === 'meeting' || type === 'lounge') {
    return true;
  }
  // Agents can walk onto their destination workstation/server/garden edge,
  // while avoiding cutting through unrelated blocked stations.
  return isDestination;
}

export function findHexPath(
  start: HexCoord,
  goal: HexCoord,
  tilesMap: Map<string, HexTile>,
): HexCoord[] {
  const startKey = hexKey(start.q, start.r);
  const goalKey = hexKey(goal.q, goal.r);

  if (startKey === goalKey) return [start];
  if (!tilesMap.has(goalKey)) return [start];

  const openSet: HexCoord[] = [start];
  const cameFrom = new Map<string, HexCoord>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const fScore = new Map<string, number>([[startKey, hexDistance(start, goal)]]);

  while (openSet.length > 0) {
    let bestIdx = 0;
    let bestF = fScore.get(hexKey(openSet[0].q, openSet[0].r)) ?? Infinity;
    for (let i = 1; i < openSet.length; i++) {
      const f = fScore.get(hexKey(openSet[i].q, openSet[i].r)) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        bestIdx = i;
      }
    }

    const current = openSet.splice(bestIdx, 1)[0];
    const currentKey = hexKey(current.q, current.r);

    if (currentKey === goalKey) {
      const path: HexCoord[] = [current];
      let cur = current;
      while (cameFrom.has(hexKey(cur.q, cur.r))) {
        cur = cameFrom.get(hexKey(cur.q, cur.r))!;
        path.unshift(cur);
      }
      return path;
    }

    const currentG = gScore.get(currentKey) ?? Infinity;

    for (const dir of HEX_DIRECTIONS) {
      const neighbor: HexCoord = { q: current.q + dir.q, r: current.r + dir.r };
      const neighborKey = hexKey(neighbor.q, neighbor.r);
      const tile = tilesMap.get(neighborKey);
      if (!tile) continue;

      const isGoal = neighborKey === goalKey;
      if (!isTilePassable(tile.type, isGoal)) continue;

      // Slight preference for walkways so agents naturally use corridors
      const stepCost = tile.type === 'walkway' ? 1 : 1.35;
      const tentativeG = currentG + stepCost;

      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + hexDistance(neighbor, goal));
        if (!openSet.some((n) => n.q === neighbor.q && n.r === neighbor.r)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  // Fallback direct hop if user walled off everything
  return [start, goal];
}
