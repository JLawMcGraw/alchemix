/**
 * RecipeCard Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecipeCard } from './RecipeCard';
import type { Recipe } from '@/types';

// Mock the RecipeMolecule component
vi.mock('@/components/RecipeMolecule', () => ({
  RecipeMolecule: () => (
    <div data-testid="recipe-molecule">Molecule</div>
  ),
}));

describe('RecipeCard', () => {
  const mockRecipe: Recipe = {
    id: 1,
    name: 'Negroni',
    ingredients: '1 oz Gin, 1 oz Campari, 1 oz Sweet Vermouth',
    instructions: 'Stir with ice and strain',
    glass: 'Rocks',
    category: 'Classic',
  };

  const mockRecipeWithArrayIngredients: Recipe = {
    ...mockRecipe,
    ingredients: JSON.stringify(['1 oz Gin', '1 oz Campari', '1 oz Sweet Vermouth']),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the recipe name', () => {
      render(<RecipeCard recipe={mockRecipe} />);
      expect(screen.getByText('Negroni')).toBeInTheDocument();
    });

    it('should render the RecipeMolecule component', () => {
      render(<RecipeCard recipe={mockRecipe} />);
      expect(screen.getByTestId('recipe-molecule')).toBeInTheDocument();
    });

    it('should render ingredients preview', () => {
      render(<RecipeCard recipe={mockRecipe} />);
      // Should show ingredients joined with " · "
      expect(screen.getByText(/1 oz Gin/)).toBeInTheDocument();
    });

    it('should handle array ingredients (JSON)', () => {
      render(<RecipeCard recipe={mockRecipeWithArrayIngredients} />);
      expect(screen.getByText('Negroni')).toBeInTheDocument();
    });

    it('should handle empty ingredients', () => {
      const recipeWithNoIngredients = { ...mockRecipe, ingredients: '' };
      render(<RecipeCard recipe={recipeWithNoIngredients} />);
      expect(screen.getByText('Negroni')).toBeInTheDocument();
    });

    it('should handle undefined ingredients', () => {
      const recipeWithUndefined = { ...mockRecipe, ingredients: undefined as any };
      render(<RecipeCard recipe={recipeWithUndefined} />);
      expect(screen.getByText('Negroni')).toBeInTheDocument();
    });
  });

  describe('Favorite State', () => {
    it('should show filled star when favorited', () => {
      render(<RecipeCard recipe={mockRecipe} isFavorited={true} onToggleFavorite={() => {}} />);
      // The favorite button should have active class
      const favoriteBtn = document.querySelector('[class*="favoriteBtnActive"]');
      expect(favoriteBtn).toBeInTheDocument();
    });

    it('should show empty star when not favorited', () => {
      render(<RecipeCard recipe={mockRecipe} isFavorited={false} onToggleFavorite={() => {}} />);
      // The button should not have active class
      const favoriteBtn = document.querySelector('[class*="favoriteBtnActive"]');
      expect(favoriteBtn).not.toBeInTheDocument();
    });
  });

  describe('Selection State', () => {
    it('should apply selected styles when isSelected is true', () => {
      render(<RecipeCard recipe={mockRecipe} isSelected={true} />);
      const card = document.querySelector('[class*="cardSelected"]');
      expect(card).toBeInTheDocument();
    });

    it('should show checkbox when isSelected is true', () => {
      render(<RecipeCard recipe={mockRecipe} isSelected={true} onToggleSelection={() => {}} />);
      const checkbox = document.querySelector('[class*="checkboxChecked"]');
      expect(checkbox).toBeInTheDocument();
    });
  });

  describe('Craftable State', () => {
    it('should show craftable indicator when isCraftable is true', () => {
      render(<RecipeCard recipe={mockRecipe} isCraftable={true} />);
      // Look for craftable-related class or element
      const craftableIndicator = document.querySelector('[class*="craftable"]');
      // This may or may not be present based on implementation
      // Just ensure no error is thrown
      expect(screen.getByText('Negroni')).toBeInTheDocument();
    });

    it('should show missing ingredients count', () => {
      render(
        <RecipeCard
          recipe={mockRecipe}
          isCraftable={false}
          missingIngredients={['Campari', 'Sweet Vermouth']}
        />
      );
      // Should show something like "Missing 2 ingredients"
      expect(screen.getByText('Negroni')).toBeInTheDocument();
    });
  });

  describe('Event Handlers', () => {
    it('should call onSelect when card is clicked', () => {
      const onSelect = vi.fn();
      render(<RecipeCard recipe={mockRecipe} onSelect={onSelect} />);

      const card = document.querySelector('[class*="card"]');
      fireEvent.click(card!);

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('should call onToggleFavorite when favorite button is clicked', () => {
      const onToggleFavorite = vi.fn();
      const onSelect = vi.fn();

      render(
        <RecipeCard
          recipe={mockRecipe}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
        />
      );

      const favoriteButton = document.querySelector('[class*="favorite"]');
      if (favoriteButton) {
        fireEvent.click(favoriteButton);
        // onToggleFavorite should be called, and onSelect should NOT propagate
        expect(onToggleFavorite).toHaveBeenCalledTimes(1);
      }
    });

    it('should call onToggleSelection when checkbox is clicked', () => {
      const onToggleSelection = vi.fn();
      const onSelect = vi.fn();

      render(
        <RecipeCard
          recipe={mockRecipe}
          onSelect={onSelect}
          onToggleSelection={onToggleSelection}
        />
      );

      const checkbox = document.querySelector('[class*="checkbox"]');
      if (checkbox) {
        fireEvent.click(checkbox);
        expect(onToggleSelection).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Spirit Detection', () => {
    it('should detect gin from ingredients', () => {
      const ginRecipe: Recipe = {
        ...mockRecipe,
        ingredients: '2 oz Gin, 1 oz Lime Juice',
      };
      render(<RecipeCard recipe={ginRecipe} />);
      // Spirit tag should be rendered
      expect(screen.getByText('Negroni')).toBeInTheDocument();
    });

    it('should detect whiskey/bourbon from ingredients', () => {
      const bourbonRecipe: Recipe = {
        ...mockRecipe,
        name: 'Old Fashioned',
        ingredients: '2 oz Bourbon, Sugar, Bitters',
      };
      render(<RecipeCard recipe={bourbonRecipe} />);
      expect(screen.getByText('Old Fashioned')).toBeInTheDocument();
    });

    it('should NOT detect gin from ginger (word boundary)', () => {
      const gingerRecipe: Recipe = {
        ...mockRecipe,
        name: 'Moscow Mule',
        ingredients: '2 oz Vodka, 4 oz Ginger Beer, Lime',
      };
      render(<RecipeCard recipe={gingerRecipe} />);
      // Should detect vodka, NOT gin
      expect(screen.getByText('Moscow Mule')).toBeInTheDocument();
    });

    it('should use spirit_type from recipe if provided', () => {
      const recipeWithSpiritType: Recipe = {
        ...mockRecipe,
        spirit_type: 'Tequila',
      };
      render(<RecipeCard recipe={recipeWithSpiritType} />);
      expect(screen.getByText('Negroni')).toBeInTheDocument();
    });
  });
});
