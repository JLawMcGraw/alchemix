'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { RecipeDetailModal } from '@/components/modals';
import { RecipeCard } from '@/components/RecipeCard';
import { Star } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { Recipe } from '@/types';
import styles from './favorites.module.css';

// Spirit keywords for filtering (base spirits only)
const SPIRIT_KEYWORDS: Record<string, string[]> = {
  'Gin': ['gin', 'london dry', 'plymouth', 'navy strength'],
  'Whiskey': ['whiskey', 'whisky', 'bourbon', 'rye', 'scotch', 'irish whiskey', 'japanese whisky'],
  'Tequila': ['tequila', 'mezcal', 'blanco', 'reposado', 'anejo'],
  'Rum': ['rum', 'rhum', 'white rum', 'dark rum', 'spiced rum', 'cachaca', 'agricole'],
  'Vodka': ['vodka'],
  'Brandy': ['brandy', 'cognac', 'armagnac', 'pisco', 'calvados', 'grappa'],
};

// Get all spirits from ingredients
const getIngredientSpirits = (ingredients: string[]): string[] => {
  const foundSpirits = new Set<string>();

  for (const ingredient of ingredients) {
    const lowerIngredient = ingredient.toLowerCase();
    for (const [spirit, keywords] of Object.entries(SPIRIT_KEYWORDS)) {
      if (keywords.some(keyword => lowerIngredient.includes(keyword))) {
        foundSpirits.add(spirit);
        break;
      }
    }
  }

  return Array.from(foundSpirits);
};

// Parse ingredients from recipe
const parseIngredients = (ingredients: string | string[] | undefined): string[] => {
  if (!ingredients) return [];
  if (Array.isArray(ingredients)) return ingredients;
  try {
    const parsed = JSON.parse(ingredients);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to split
  }
  return ingredients.split(',').map(i => i.trim()).filter(Boolean);
};

export default function FavoritesPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    favorites,
    recipes,
    craftableRecipes,
    fetchFavorites,
    fetchRecipes,
    fetchShoppingList,
    removeFavorite,
    addFavorite
  } = useStore();
  const { showToast } = useToast();
  const [filterSpirit, setFilterSpirit] = useState<string>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Ensure arrays (must be before any conditional returns for hooks)
  const favoritesArray = Array.isArray(favorites) ? favorites : [];
  const recipesArray = Array.isArray(recipes) ? recipes : [];
  const craftableArray = Array.isArray(craftableRecipes) ? craftableRecipes : [];

  // Get full recipe data for each favorite
  const favoriteRecipes = useMemo(() => {
    return favoritesArray.map(fav => {
      const recipe = fav.recipe_id
        ? recipesArray.find(r => r.id === fav.recipe_id)
        : recipesArray.find(r => r.name === fav.recipe_name);

      if (!recipe) return null;

      const ingredients = parseIngredients(recipe.ingredients);
      const spirits = getIngredientSpirits(ingredients);

      return {
        favorite: fav,
        recipe,
        ingredients,
        spirits,
      };
    }).filter(Boolean) as Array<{
      favorite: typeof favoritesArray[0];
      recipe: Recipe;
      ingredients: string[];
      spirits: string[];
    }>;
  }, [favoritesArray, recipesArray]);

  // Get unique spirits for filter buttons
  const availableSpirits = useMemo(() => {
    const spirits = new Set<string>();
    favoriteRecipes.forEach(fr => {
      fr.spirits.forEach(s => spirits.add(s));
    });
    return Array.from(spirits).sort();
  }, [favoriteRecipes]);

  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchFavorites().catch(console.error);
      fetchRecipes().catch(console.error);
      fetchShoppingList().catch(console.error); // This populates craftableRecipes
    }
  }, [isAuthenticated, isValidating, fetchFavorites, fetchRecipes, fetchShoppingList]);

  if (isValidating || !isAuthenticated) {
    return null;
  }

  // Filter favorites by spirit
  const filteredFavorites = filterSpirit === 'all'
    ? favoriteRecipes
    : favoriteRecipes.filter(fr => fr.spirits.includes(filterSpirit));

  // Check if recipe is craftable (using craftableRecipes from store)
  const isRecipeCraftable = (recipe: Recipe): boolean => {
    return craftableArray.some(c => c.id === recipe.id || c.name === recipe.name);
  };

  const craftableCount = favoriteRecipes.filter(fr => isRecipeCraftable(fr.recipe)).length;

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
  };

  const isFavorited = (recipeId: number) => {
    return favoritesArray.some((fav) => fav.recipe_id === recipeId);
  };

  const handleToggleFavorite = async (recipe: Recipe) => {
    if (!recipe.id) return;

    const favorite = favoritesArray.find((fav) => fav.recipe_id === recipe.id);
    try {
      if (favorite && favorite.id) {
        await removeFavorite(favorite.id);
        setSelectedRecipe(null);
        showToast('success', 'Removed from favorites');
      } else {
        await addFavorite(recipe.name, recipe.id);
        showToast('success', 'Added to favorites');
      }
    } catch (error) {
      showToast('error', 'Failed to update favorites');
      console.error('Failed to toggle favorite:', error);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Favorites</h1>
          <p className={styles.subtitle}>
            {favoriteRecipes.length} saved
            {' · '}
            <span className={styles.craftableCount}>{craftableCount} craftable</span>
          </p>
        </div>

        {/* Spirit Filters */}
        {availableSpirits.length > 0 && (
          <div className={styles.filters}>
            <button
              onClick={() => setFilterSpirit('all')}
              className={`${styles.filterBtn} ${filterSpirit === 'all' ? styles.filterBtnActive : ''}`}
            >
              All
            </button>
            {availableSpirits.map((spirit) => (
              <button
                key={spirit}
                onClick={() => setFilterSpirit(spirit)}
                className={`${styles.filterBtn} ${filterSpirit === spirit ? styles.filterBtnActive : ''}`}
              >
                {spirit}
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {favoriteRecipes.length === 0 ? (
          <div className={styles.emptyState}>
            <Star size={48} className={styles.emptyIcon} strokeWidth={1} />
            <h3 className={styles.emptyTitle}>No favorites yet</h3>
            <p className={styles.emptyText}>
              Star recipes to save them here for quick access
            </p>
            <button
              className={styles.browseBtn}
              onClick={() => router.push('/recipes')}
            >
              Browse Recipes
            </button>
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              No {filterSpirit} recipes in your favorites
            </p>
          </div>
        ) : (
          /* Favorites Grid - Using RecipeCard component */
          <div className={styles.grid}>
            {filteredFavorites.map(({ recipe }) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                isFavorited={isFavorited(recipe.id!)}
                isCraftable={isRecipeCraftable(recipe)}
                onSelect={() => handleSelectRecipe(recipe)}
                onToggleFavorite={() => handleToggleFavorite(recipe)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        isOpen={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        recipe={selectedRecipe}
        isFavorited={selectedRecipe ? isFavorited(selectedRecipe.id!) : false}
        onToggleFavorite={() => {
          if (selectedRecipe) {
            handleToggleFavorite(selectedRecipe);
          }
        }}
      />
    </div>
  );
}
