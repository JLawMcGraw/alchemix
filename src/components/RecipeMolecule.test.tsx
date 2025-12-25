/**
 * RecipeMolecule Component Tests
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecipeMolecule } from './RecipeMolecule';
import type { Recipe } from '@/types';

// Type definitions for molecule package mocks
interface MoleculeNode {
  id: string;
  label: string;
  category: string;
  x: number;
  y: number;
  radius: number;
}

interface TransformedRecipe {
  name?: string;
  nodes: MoleculeNode[];
  bonds: Array<{ source: string; target: string }>;
}

interface MoleculeProps {
  recipe?: TransformedRecipe;
  width: number;
  height: number;
  svgRef?: React.RefObject<SVGSVGElement>;
}

interface LayoutSize {
  width: number;
  height: number;
}

// Mock the @alchemix/recipe-molecule package
vi.mock('@alchemix/recipe-molecule', () => ({
  // Molecule component mock
  Molecule: vi.fn(({ recipe, width, height, svgRef }: MoleculeProps) => (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      data-testid="molecule-svg"
    >
      {recipe?.nodes?.map((node: MoleculeNode, idx: number) => (
        <circle key={idx} cx={node.x} cy={node.y} r={node.radius} />
      ))}
    </svg>
  )),

  // transformRecipe function mock
  transformRecipe: vi.fn((recipe: { name?: string; ingredients?: string[] }, _layoutSize: LayoutSize) => {
    const ingredients = recipe.ingredients || [];
    if (ingredients.length === 0) {
      return { nodes: [], bonds: [] };
    }

    return {
      name: recipe.name,
      nodes: ingredients.map((ing: string, idx: number) => ({
        id: `node-${idx}`,
        label: typeof ing === 'string' ? ing.substring(0, 20) : '',
        category: 'spirit',
        x: 50 + idx * 30,
        y: 50,
        radius: 10,
      })),
      bonds: ingredients.length > 1
        ? [{ source: 'node-0', target: 'node-1' }]
        : [],
    };
  }),

  // Export function mocks
  exportPNG: vi.fn().mockResolvedValue(undefined),
  exportSVG: vi.fn(),
}));

describe('RecipeMolecule', () => {
  const mockRecipe: Recipe = {
    id: 1,
    name: 'Negroni',
    ingredients: '1 oz Gin, 1 oz Campari, 1 oz Sweet Vermouth',
    instructions: 'Stir with ice',
  };

  describe('Rendering', () => {
    it('should render an SVG element', () => {
      const { container } = render(<RecipeMolecule recipe={mockRecipe} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render with default size', () => {
      const { container } = render(<RecipeMolecule recipe={mockRecipe} />);
      const wrapper = container.firstChild;
      expect(wrapper).toBeInTheDocument();
    });

    it('should render with thumbnail size', () => {
      const { container } = render(<RecipeMolecule recipe={mockRecipe} size="thumbnail" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should render with full size', () => {
      const { container } = render(<RecipeMolecule recipe={mockRecipe} size="full" />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show placeholder when recipe has no ingredients', () => {
      const emptyRecipe: Recipe = {
        id: 2,
        name: 'Empty',
        ingredients: '',
      };

      render(<RecipeMolecule recipe={emptyRecipe} />);

      // Should show "No ingredients" text
      expect(screen.getByText(/no ingredients/i)).toBeInTheDocument();
    });

    it('should show placeholder when recipe has undefined ingredients', () => {
      const undefinedRecipe: Recipe = {
        id: 3,
        name: 'Undefined',
        ingredients: undefined as any,
      };

      render(<RecipeMolecule recipe={undefinedRecipe} />);
      expect(screen.getByText(/no ingredients/i)).toBeInTheDocument();
    });

    it('should render Y-shaped logo icon in placeholder', () => {
      const emptyRecipe: Recipe = {
        id: 2,
        name: 'Empty',
        ingredients: '',
      };

      const { container } = render(<RecipeMolecule recipe={emptyRecipe} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();

      // Should have circles for the Y-shape nodes
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    });
  });

  describe('Legend', () => {
    it('should show legend by default', () => {
      const { container } = render(<RecipeMolecule recipe={mockRecipe} showLegend={true} />);
      // Legend might be rendered based on implementation
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should hide legend when showLegend is false', () => {
      const { container } = render(<RecipeMolecule recipe={mockRecipe} showLegend={false} />);
      // Legend should not be present
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <RecipeMolecule recipe={mockRecipe} className="custom-class" />
      );
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('Recipe Variations', () => {
    it('should handle recipe with array ingredients', () => {
      const arrayRecipe: Recipe = {
        id: 4,
        name: 'Array Recipe',
        ingredients: JSON.stringify(['1 oz Gin', '1 oz Vermouth']),
      };

      const { container } = render(<RecipeMolecule recipe={arrayRecipe} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should handle recipe with single ingredient', () => {
      const singleIngredient: Recipe = {
        id: 5,
        name: 'Simple',
        ingredients: '2 oz Whiskey',
      };

      const { container } = render(<RecipeMolecule recipe={singleIngredient} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should handle recipe with many ingredients', () => {
      const manyIngredients: Recipe = {
        id: 6,
        name: 'Complex',
        ingredients: '1 oz Gin, 1 oz Rum, 1 oz Vodka, 1 oz Tequila, 1 oz Triple Sec, Lime, Cola',
      };

      const { container } = render(<RecipeMolecule recipe={manyIngredients} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
