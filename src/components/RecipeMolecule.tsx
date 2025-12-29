'use client';

/**
 * RecipeMolecule Component
 *
 * Wrapper that transforms Alchemix recipes into molecule visualizations.
 * Used in recipe cards (thumbnail) and recipe detail modal (full size).
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { Molecule, transformRecipe, exportPNG, exportSVG } from '@alchemix/recipe-molecule';
import type { Recipe } from '@/types';

interface RecipeMoleculeProps {
  recipe: Recipe;
  /** Size variant: 'thumbnail' for cards, 'full' for detail view */
  size?: 'thumbnail' | 'full';
  /** Show legend below the molecule */
  showLegend?: boolean;
  /** Show export buttons */
  showExport?: boolean;
  /** Optional className for styling */
  className?: string;
  /** Optional ref to access the SVG element */
  svgRef?: React.RefObject<SVGSVGElement>;
  /** Custom display width (overrides size preset) */
  displayWidth?: number;
  /** Custom display height (overrides size preset) */
  displayHeight?: number;
  /** Use tight viewBox cropped to content (makes molecule appear larger) */
  tightViewBox?: boolean;
}

// Layout is always computed at this size for consistent molecule proportions
const LAYOUT_SIZE = { width: 400, height: 300 };

// Display sizes for different contexts
// Thumbnail uses explicit dimensions for proper centering (4:3 aspect ratio matching viewBox)
const DISPLAY_CONFIG = {
  thumbnail: { width: 300, height: 225 },
  full: { width: 440, height: 320 },
};

export function RecipeMolecule({
  recipe,
  size = 'full',
  showLegend = true,
  showExport = false,
  className,
  svgRef: externalSvgRef,
  displayWidth: customWidth,
  displayHeight: customHeight,
  tightViewBox: customTightViewBox,
}: RecipeMoleculeProps) {
  const internalSvgRef = useRef<SVGSVGElement>(null);
  const svgRef = externalSvgRef || internalSvgRef;

  // Track mounted state to prevent DOM operations after unmount
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Parse ingredients from recipe
  const ingredients = useMemo(() => {
    if (!recipe.ingredients) return [];
    if (Array.isArray(recipe.ingredients)) return recipe.ingredients;
    try {
      const parsed = JSON.parse(recipe.ingredients);
      return Array.isArray(parsed) ? parsed : [recipe.ingredients];
    } catch {
      return recipe.ingredients.split(',').map((i: string) => i.trim());
    }
  }, [recipe.ingredients]);

  // Transform recipe to molecule format - always use consistent layout size
  const moleculeRecipe = useMemo(() => {
    if (ingredients.length === 0) return null;

    return transformRecipe(
      {
        name: recipe.name,
        ingredients,
        instructions: recipe.instructions,
        glass: recipe.glass,
        category: recipe.category,
      },
      LAYOUT_SIZE
    );
  }, [recipe, ingredients]);

  // Handle export
  const handleExportPNG = async () => {
    if (!svgRef.current) return;
    await exportPNG(svgRef.current, `${recipe.name.replace(/\s+/g, '-').toLowerCase()}-molecule.png`);
  };

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    exportSVG(svgRef.current, `${recipe.name.replace(/\s+/g, '-').toLowerCase()}-molecule.svg`);
  };

  // Use custom dimensions if provided, otherwise use preset
  const presetSize = DISPLAY_CONFIG[size];
  const displaySize = {
    width: customWidth ?? presetSize.width,
    height: customHeight ?? presetSize.height,
  };

  // Don't render until mounted (prevents hydration mismatch and DOM errors)
  if (!isMounted) {
    return (
      <div
        className={className}
        style={{
          width: DISPLAY_CONFIG[size].width,
          height: DISPLAY_CONFIG[size].height
        }}
      />
    );
  }

  // If no ingredients, show placeholder with AlcheMix icon (inverted Y) in monochrome
  if (!moleculeRecipe || moleculeRecipe.nodes.length === 0) {
    const iconSize = size === 'thumbnail' ? 80 : 100;
    const strokeColor = '#3f3f46';

    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-1, 8px)',
          padding: size === 'thumbnail' ? '24px' : '32px',
        }}
      >
        {/* AlcheMix icon - inverted Y molecular structure (monochrome) */}
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 100 100"
          fill="none"
          style={{ opacity: 0.3 }}
        >
          {/* Bonds - shortened to stop at circle edges */}
          <g stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round">
            {/* Top bond: from center (r=7) to top circle (r=10) */}
            <line x1="50" y1="43" x2="50" y2="25" />
            {/* Bottom-left bond */}
            <line x1="45.2" y1="55.1" x2="28.8" y2="72.7" />
            {/* Bottom-right bond */}
            <line x1="54.8" y1="55.1" x2="71.2" y2="72.7" />
          </g>

          {/* Terminal Nodes */}
          <circle cx="50" cy="15" r="10" fill="none" stroke={strokeColor} strokeWidth="1.2" />
          <circle cx="22" cy="80" r="10" fill="none" stroke={strokeColor} strokeWidth="1.2" />
          <circle cx="78" cy="80" r="10" fill="none" stroke={strokeColor} strokeWidth="1.2" />

          {/* Center junction node */}
          <circle cx="50" cy="50" r="7" fill="none" stroke={strokeColor} strokeWidth="1.2" />
        </svg>
        <span
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: size === 'thumbnail' ? '0.625rem' : 'var(--text-xs, 0.75rem)',
            fontWeight: 450,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: '#3f3f46',
            opacity: 0.5,
          }}
        >
          No ingredients
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
    >
      <Molecule
        recipe={moleculeRecipe}
        width={LAYOUT_SIZE.width}
        height={LAYOUT_SIZE.height}
        showLegend={size === 'full' && showLegend}
        tightViewBox={customTightViewBox ?? true}
        svgRef={svgRef}
        displayWidth={displaySize.width}
        displayHeight={displaySize.height}
      />

      {showExport && size === 'full' && (
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          marginTop: '12px'
        }}>
          <button
            onClick={handleExportPNG}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'var(--color-ui-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              color: 'var(--color-text-body)',
            }}
          >
            Export PNG
          </button>
          <button
            onClick={handleExportSVG}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'var(--color-ui-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              color: 'var(--color-text-body)',
            }}
          >
            Export SVG
          </button>
        </div>
      )}
    </div>
  );
}
