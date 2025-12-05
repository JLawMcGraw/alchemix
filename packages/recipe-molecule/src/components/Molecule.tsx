/**
 * Molecule Component
 *
 * Main container for recipe molecule visualization
 * Renders benzene rings, bonds, nodes, tooltip, and legend
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { MoleculeRecipe, MoleculeNode } from '../core/types';
import { Bond } from './Bond';
import { Node } from './Node';
import { Tooltip } from './Tooltip';
import { Legend } from './Legend';
import styles from '../styles/molecule.module.css';

// Hexagon radius - same for spirit hexagon and honeycomb grid
const HEX_RADIUS = 30;

// Rotation so flat edges face top/bottom
const ROTATION = Math.PI / 6;

/**
 * Get honeycomb grid positions
 * Returns the 6 corner positions of the spirit hexagon and
 * the 6 outer positions where ingredients would sit
 */
function getHoneycombPositions(cx: number, cy: number, radius: number) {
  const corners: { x: number; y: number; angle: number }[] = [];
  const outerPositions: { x: number; y: number; angle: number }[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2 + ROTATION;

    // Spirit hexagon corners
    corners.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle,
    });

    // Outer honeycomb positions (one bond length further out)
    outerPositions.push({
      x: cx + radius * 2 * Math.cos(angle),
      y: cy + radius * 2 * Math.sin(angle),
      angle,
    });
  }

  return { corners, outerPositions };
}

/**
 * Renders a benzene-style hexagon ring with alternating single/double bonds
 */
function BenzeneRing({ cx, cy, radius }: { cx: number; cy: number; radius: number }) {
  const edges: JSX.Element[] = [];
  const innerRadius = radius * 0.72;

  for (let i = 0; i < 6; i++) {
    const angle1 = (Math.PI / 3) * i - Math.PI / 2 + ROTATION;
    const angle2 = (Math.PI / 3) * ((i + 1) % 6) - Math.PI / 2 + ROTATION;

    // Outer hexagon vertices
    const x1 = cx + radius * Math.cos(angle1);
    const y1 = cy + radius * Math.sin(angle1);
    const x2 = cx + radius * Math.cos(angle2);
    const y2 = cy + radius * Math.sin(angle2);

    // Outer edge
    edges.push(
      <line
        key={`outer-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#333"
        strokeWidth={1.5}
        opacity={0.5}
      />
    );

    // Inner edge for double bonds (alternating: edges 0, 2, 4)
    if (i % 2 === 0) {
      const ix1 = cx + innerRadius * Math.cos(angle1);
      const iy1 = cy + innerRadius * Math.sin(angle1);
      const ix2 = cx + innerRadius * Math.cos(angle2);
      const iy2 = cy + innerRadius * Math.sin(angle2);

      edges.push(
        <line
          key={`inner-${i}`}
          x1={ix1}
          y1={iy1}
          x2={ix2}
          y2={iy2}
          stroke="#333"
          strokeWidth={1.5}
          opacity={0.5}
        />
      );
    }
  }

  return <g>{edges}</g>;
}

/**
 * Draw a single hexagon at position (cx, cy)
 */
function drawHexagon(cx: number, cy: number, radius: number, keyPrefix: string): JSX.Element[] {
  const edges: JSX.Element[] = [];

  for (let i = 0; i < 6; i++) {
    const angle1 = (Math.PI / 3) * i - Math.PI / 2 + ROTATION;
    const angle2 = (Math.PI / 3) * ((i + 1) % 6) - Math.PI / 2 + ROTATION;

    const x1 = cx + radius * Math.cos(angle1);
    const y1 = cy + radius * Math.sin(angle1);
    const x2 = cx + radius * Math.cos(angle2);
    const y2 = cy + radius * Math.sin(angle2);

    edges.push(
      <line
        key={`${keyPrefix}-edge-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#ccc"
        strokeWidth={1}
        opacity={0.4}
      />
    );
  }

  return edges;
}

/**
 * Renders unified honeycomb skeleton for all spirits
 * Creates a single honeycomb grid that encompasses all spirit positions
 */
function UnifiedHoneycombSkeleton({
  spiritCenters,
  radius
}: {
  spiritCenters: { x: number; y: number }[];
  radius: number;
}) {
  if (spiritCenters.length === 0) return null;

  const elements: JSX.Element[] = [];

  // Distance between adjacent hex centers (sharing an edge) = radius * sqrt(3)
  const edgeDist = radius * Math.sqrt(3);

  // Edge normal angles for flat-top hexagon (rotated 30°)
  const edgeNormalAngles = [30, 90, 150, 210, 270, 330].map(deg => deg * Math.PI / 180);

  // Track all hex positions we've drawn (including spirits)
  const drawnHexes = new Set<string>();

  // Helper to get rounded key for a position
  const getKey = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;

  // Mark spirit positions as "drawn" (they render their own benzene rings)
  spiritCenters.forEach(spirit => {
    drawnHexes.add(getKey(spirit.x, spirit.y));
  });

  // BFS to expand honeycomb from all spirit centers
  // We'll do 2 rings of expansion from each spirit
  const toProcess: { x: number; y: number; depth: number }[] = [];

  // Start with all spirit positions
  spiritCenters.forEach(spirit => {
    toProcess.push({ x: spirit.x, y: spirit.y, depth: 0 });
  });

  while (toProcess.length > 0) {
    const current = toProcess.shift()!;

    // Don't expand beyond depth 2
    if (current.depth >= 2) continue;

    // Add neighbors
    for (let i = 0; i < 6; i++) {
      const angle = edgeNormalAngles[i];
      const neighborX = current.x + edgeDist * Math.cos(angle);
      const neighborY = current.y + edgeDist * Math.sin(angle);
      const key = getKey(neighborX, neighborY);

      if (!drawnHexes.has(key)) {
        drawnHexes.add(key);
        elements.push(...drawHexagon(neighborX, neighborY, radius, `hex-${key}`));
        toProcess.push({ x: neighborX, y: neighborY, depth: current.depth + 1 });
      }
    }
  }

  return <g>{elements}</g>;
}

interface MoleculeProps {
  /** The molecule recipe data to render */
  recipe: MoleculeRecipe;
  /** SVG width in pixels */
  width?: number;
  /** SVG height in pixels */
  height?: number;
  /** Whether to show the color legend */
  showLegend?: boolean;
  /** Optional CSS class for the container */
  className?: string;
  /** Ref to the SVG element for export */
  svgRef?: React.RefObject<SVGSVGElement>;
}

interface TooltipState {
  node: MoleculeNode | null;
  x: number;
  y: number;
  visible: boolean;
}

export function Molecule({
  recipe,
  width = 520,
  height = 420,
  showLegend = true,
  className,
  svgRef,
}: MoleculeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    node: null,
    x: 0,
    y: 0,
    visible: false,
  });

  // Create node lookup map for bonds
  const nodeMap = useCallback(() => {
    const map: Record<string, MoleculeNode> = {};
    recipe.nodes.forEach(n => {
      map[n.id] = n;
    });
    return map;
  }, [recipe.nodes])();

  // Tooltip handlers
  const handleMouseEnter = useCallback(
    (event: React.MouseEvent, node: MoleculeNode) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setTooltip({
        node,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        visible: true,
      });
    },
    []
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent, node: MoleculeNode) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setTooltip(prev => ({
        ...prev,
        node,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }));
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className || ''}`}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={styles.svg}
      >
        {/* Layer 0: Unified honeycomb skeleton (shows grid structure) */}
        <g>
          <UnifiedHoneycombSkeleton
            spiritCenters={recipe.nodes
              .filter(node => node.type === 'spirit')
              .map(spirit => ({ x: spirit.x, y: spirit.y }))}
            radius={HEX_RADIUS}
          />
        </g>

        {/* Layer 1: Benzene rings around spirit nodes */}
        <g>
          {recipe.nodes
            .filter(node => node.type === 'spirit')
            .map((spirit, i) => (
              <BenzeneRing
                key={`benzene-${i}`}
                cx={spirit.x}
                cy={spirit.y}
                radius={HEX_RADIUS}
              />
            ))}
        </g>

        {/* Layer 2: Bonds (connecting nodes) */}
        <g>
          {recipe.bonds.map((bond, i) => {
            const from = nodeMap[bond.from];
            const to = nodeMap[bond.to];

            if (!from || !to) return null;

            return (
              <Bond
                key={`bond-${i}`}
                from={from}
                to={to}
                type={bond.type}
              />
            );
          })}
        </g>

        {/* Layer 3: Nodes with circles and labels */}
        <g>
          {recipe.nodes.map(node => (
            <Node
              key={node.id}
              node={node}
              onMouseEnter={handleMouseEnter}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
          ))}
        </g>
      </svg>

      {/* Tooltip overlay */}
      <Tooltip
        node={tooltip.node}
        x={tooltip.x}
        y={tooltip.y}
        visible={tooltip.visible}
      />

      {/* Legend */}
      {showLegend && <Legend nodes={recipe.nodes} />}
    </div>
  );
}
