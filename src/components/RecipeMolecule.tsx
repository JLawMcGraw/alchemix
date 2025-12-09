'use client';

/**
 * RecipeMolecule Component
 *
 * Wrapper that transforms Alchemix recipes into molecule visualizations.
 * Used in recipe cards (thumbnail) and recipe detail modal (full size).
 */

import { useMemo, useRef } from 'react';
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
}: RecipeMoleculeProps) {
  const internalSvgRef = useRef<SVGSVGElement>(null);
  const svgRef = externalSvgRef || internalSvgRef;

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

  const displaySize = DISPLAY_CONFIG[size];

  // If no ingredients, show placeholder
  if (!moleculeRecipe || moleculeRecipe.nodes.length === 0) {
    return (
      <div
        className={className}
        style={{
          width: displaySize.width,
          height: displaySize.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #f093fb 100%)',
          borderRadius: 'var(--radius)',
          color: 'white',
          fontSize: '14px',
          opacity: 0.7,
        }}
      >
        No ingredients to visualize
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
        tightViewBox={size === 'full'}
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
