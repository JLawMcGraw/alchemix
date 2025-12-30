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
import { HEX_RADIUS, HEX_ROTATION } from '../core/constants';
import styles from '../styles/molecule.module.css';

/**
 * Get honeycomb grid positions
 * Returns the 6 corner positions of the spirit hexagon and
 * the 6 outer positions where ingredients would sit
 */
function getHoneycombPositions(cx: number, cy: number, radius: number) {
  const corners: { x: number; y: number; angle: number }[] = [];
  const outerPositions: { x: number; y: number; angle: number }[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2 + HEX_ROTATION;

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
 * Uses CSS class for dark mode support
 */
function BenzeneRing({ cx, cy, radius }: { cx: number; cy: number; radius: number }) {
  const edges: JSX.Element[] = [];
  const innerRadius = radius * 0.72; // Original spacing

  for (let i = 0; i < 6; i++) {
    const angle1 = (Math.PI / 3) * i - Math.PI / 2 + HEX_ROTATION;
    const angle2 = (Math.PI / 3) * ((i + 1) % 6) - Math.PI / 2 + HEX_ROTATION;

    // Outer hexagon vertices
    const x1 = cx + radius * Math.cos(angle1);
    const y1 = cy + radius * Math.sin(angle1);
    const x2 = cx + radius * Math.cos(angle2);
    const y2 = cy + radius * Math.sin(angle2);

    // Outer edge - uses CSS class for dark mode
    edges.push(
      <line
        key={`outer-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        className={styles.bond}
        strokeWidth={1.2}
      />
    );

    // Inner edge for double bonds (alternating: edges 0, 2, 4) - thinner for delicate look
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
          className={styles.bond}
          style={{ strokeWidth: 0.7 }}
        />
      );
    }
  }

  return <g>{edges}</g>;
}

/**
 * Draw a single hexagon at position (cx, cy)
 * Used for honeycomb skeleton - uses backbone class for dark mode support
 */
function drawHexagon(cx: number, cy: number, radius: number, keyPrefix: string): JSX.Element[] {
  const edges: JSX.Element[] = [];

  for (let i = 0; i < 6; i++) {
    const angle1 = (Math.PI / 3) * i - Math.PI / 2 + HEX_ROTATION;
    const angle2 = (Math.PI / 3) * ((i + 1) % 6) - Math.PI / 2 + HEX_ROTATION;

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
        className={styles.backbone}
        strokeWidth={1}
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
  /** ViewBox width (coordinate system) */
  width?: number;
  /** ViewBox height (coordinate system) */
  height?: number;
  /** Display width (rendered size) - can be number or string like '100%' */
  displayWidth?: number | string;
  /** Display height (rendered size) - can be number or string like '100%' */
  displayHeight?: number | string;
  /** Whether to show the color legend */
  showLegend?: boolean;
  /** Use tight viewBox cropped to actual content (reduces whitespace) */
  tightViewBox?: boolean;
  /** Optional CSS class for the container */
  className?: string;
  /** Ref to the SVG element for export */
  svgRef?: React.RefObject<SVGSVGElement>;
  /** Optional inline styles for the container */
  style?: React.CSSProperties;
}

interface TooltipState {
  node: MoleculeNode | null;
  x: number;
  y: number;
  visible: boolean;
}

export function Molecule({
  recipe,
  width = 400,
  height = 300,
  displayWidth,
  displayHeight,
  showLegend = true,
  tightViewBox = false,
  className,
  svgRef,
  style,
}: MoleculeProps) {
  // Use display dimensions if provided, otherwise use viewBox dimensions
  const renderWidth = displayWidth ?? width;
  const renderHeight = displayHeight ?? height;
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    node: null,
    x: 0,
    y: 0,
    visible: false,
  });

  // Compute actual bounding box of molecule content for tight viewBox
  // When rotation is applied, we need to account for the expanded bounding box
  const contentBounds = useMemo(() => {
    if (recipe.nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: width, maxY: height };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // If rotation is applied, calculate rotated positions for accurate bounds
    const rotation = recipe.rotation || 0;
    const rotationRad = (rotation * Math.PI) / 180;
    const centerX = width / 2;
    const centerY = height / 2;
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);

    recipe.nodes.forEach(node => {
      // Account for node radius and label space
      // Text labels need more vertical space (especially above for text baseline)
      const extentX = node.type === 'spirit' ? HEX_RADIUS + 10 : 20;
      const extentY = node.type === 'spirit' ? HEX_RADIUS + 10 : 25; // More vertical for text
      
      // If rotation is applied, compute the rotated position
      let nodeX = node.x;
      let nodeY = node.y;
      
      if (rotation !== 0) {
        // Rotate point around center
        const dx = node.x - centerX;
        const dy = node.y - centerY;
        nodeX = centerX + dx * cosR - dy * sinR;
        nodeY = centerY + dx * sinR + dy * cosR;
      }
      
      minX = Math.min(minX, nodeX - extentX);
      minY = Math.min(minY, nodeY - extentY);
      maxX = Math.max(maxX, nodeX + extentX);
      maxY = Math.max(maxY, nodeY + extentY);
    });

    // Add padding around content (more at top for text labels)
    const paddingX = 22;
    const paddingTop = 42; // Extra space at top for text labels
    const paddingBottom = 24;
    // Don't clamp to 0 - allow viewBox to extend if needed
    minX = minX - paddingX;
    minY = minY - paddingTop;
    maxX = maxX + paddingX;
    maxY = maxY + paddingBottom;

    return { minX, minY, maxX, maxY };
  }, [recipe.nodes, recipe.rotation, width, height]);

  // Create node lookup map for bonds
  const nodeMap = useCallback(() => {
    const map: Record<string, MoleculeNode> = {};
    recipe.nodes.forEach(n => {
      map[n.id] = n;
    });
    return map;
  }, [recipe.nodes])();

  // Tooltip handlers - use viewport coordinates for fixed positioning
  const handleMouseEnter = useCallback(
    (event: React.MouseEvent, node: MoleculeNode) => {
      setTooltip({
        node,
        x: event.clientX,
        y: event.clientY - 10, // Slight offset above cursor
        visible: true,
      });
    },
    []
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent, node: MoleculeNode) => {
      setTooltip(prev => ({
        ...prev,
        node,
        x: event.clientX,
        y: event.clientY - 10, // Slight offset above cursor
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
      style={style}
    >
      <svg
        ref={svgRef}
        viewBox={tightViewBox
          ? `${contentBounds.minX} ${contentBounds.minY} ${contentBounds.maxX - contentBounds.minX} ${contentBounds.maxY - contentBounds.minY}`
          : recipe.rotation 
            ? `${contentBounds.minX} ${contentBounds.minY} ${contentBounds.maxX - contentBounds.minX} ${contentBounds.maxY - contentBounds.minY}`
            : `0 0 ${width} ${height}`
        }
        width={renderWidth}
        height={renderHeight}
        className={styles.svg}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Apply spirit-family-based rotation around canvas center */}
        <g transform={recipe.rotation ? `rotate(${recipe.rotation}, ${width / 2}, ${height / 2})` : undefined}>
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
                rotation={recipe.rotation}
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </g>
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
