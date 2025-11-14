'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button, useToast } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { BookOpen, Upload, Star, Martini } from 'lucide-react';
import { CSVUploadModal, RecipeDetailModal } from '@/components/modals';
import { recipeApi } from '@/lib/api';
import type { Recipe } from '@/types';
import styles from './recipes.module.css';

export default function RecipesPage() {
  const router = useRouter();
  const { isAuthenticated, recipes, favorites, fetchRecipes, fetchFavorites, addFavorite, removeFavorite } = useStore();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpirit, setFilterSpirit] = useState<string>('all');
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchRecipes().catch(console.error);
    fetchFavorites().catch(console.error);
  }, [isAuthenticated, router, fetchRecipes, fetchFavorites]);

  if (!isAuthenticated) {
    return null;
  }

  // Ensure arrays
  const recipesArray = Array.isArray(recipes) ? recipes : [];
  const favoritesArray = Array.isArray(favorites) ? favorites : [];

  // Helper function to parse ingredients
  const parseIngredients = (ingredients: string | string[] | undefined): string[] => {
    if (!ingredients) return [];
    if (Array.isArray(ingredients)) return ingredients;
    try {
      const parsed = JSON.parse(ingredients);
      return Array.isArray(parsed) ? parsed : [ingredients];
    } catch {
      return ingredients.split(',').map(i => i.trim());
    }
  };

  // Get unique spirit types
  const spiritTypes = ['all', ...new Set(recipesArray.map((r) => r.spirit_type).filter(Boolean))];

  // Filter recipes
  const filteredRecipes = recipesArray.filter((recipe) => {
    const ingredientsArray = parseIngredients(recipe.ingredients);
    const ingredientsText = ingredientsArray.join(' ').toLowerCase();

    const matchesSearch = searchQuery
      ? recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ingredientsText.includes(searchQuery.toLowerCase())
      : true;
    const matchesSpirit = filterSpirit === 'all' || recipe.spirit_type === filterSpirit;
    return matchesSearch && matchesSpirit;
  });

  const isFavorited = (recipeId: number) => {
    return favoritesArray.some((fav) => fav.recipe_id === recipeId);
  };

  const handleCSVUpload = async (file: File) => {
    try {
      await recipeApi.importCSV(file);
      await fetchRecipes();
      showToast('success', 'Successfully imported recipes from CSV');
    } catch (error) {
      showToast('error', 'Failed to import CSV');
      throw error;
    }
  };

  const handleToggleFavorite = async (recipe: Recipe) => {
    if (!recipe.id) return;

    const favorite = favoritesArray.find((fav) => fav.recipe_id === recipe.id);
    try {
      if (favorite && favorite.id) {
        await removeFavorite(favorite.id);
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
    <div className={styles.recipesPage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <BookOpen size={32} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
              Recipes
            </h1>
            <p className={styles.subtitle}>
              {filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}
            </p>
          </div>
          <Button variant="outline" size="md" onClick={() => setCsvModalOpen(true)}>
            <Upload size={18} />
            Import CSV
          </Button>
        </div>

        {/* Search and Filter */}
        <div className={styles.controls}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes..."
            className={styles.searchInput}
          />
          <select
            value={filterSpirit}
            onChange={(e) => setFilterSpirit(e.target.value)}
            className={styles.filterSelect}
          >
            {spiritTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Spirits' : type}
              </option>
            ))}
          </select>
        </div>

        {/* Recipes Grid */}
        {filteredRecipes.length === 0 ? (
          <Card padding="lg">
            <div className={styles.emptyState}>
              <Martini size={64} className={styles.emptyIcon} strokeWidth={1.5} />
              <h3 className={styles.emptyTitle}>No recipes found</h3>
              <p className={styles.emptyText}>
                {searchQuery || filterSpirit !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Import your recipe collection to get started'}
              </p>
              {!searchQuery && filterSpirit === 'all' && (
                <Button variant="primary" size="md" onClick={() => setCsvModalOpen(true)}>
                  <Upload size={18} />
                  Import Recipes
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className={styles.recipesGrid}>
            {filteredRecipes.map((recipe) => (
              <Card
                key={recipe.id}
                padding="none"
                hover
                className={styles.recipeCard}
              >
                {/* Recipe Image Placeholder */}
                <div className={styles.recipeImage}>
                  <Martini size={48} className={styles.recipeImageIcon} strokeWidth={1.5} />
                </div>

                {/* Recipe Content */}
                <div className={styles.recipeContent}>
                  <div className={styles.recipeHeader}>
                    <h3 className={styles.recipeName}>{recipe.name}</h3>
                    <button
                      onClick={() => handleToggleFavorite(recipe)}
                      className={`${styles.favoriteBtn} ${
                        isFavorited(recipe.id!) ? styles.favorited : ''
                      }`}
                      title={isFavorited(recipe.id!) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star
                        size={20}
                        fill={isFavorited(recipe.id!) ? 'currentColor' : 'none'}
                      />
                    </button>
                  </div>

                  {recipe.spirit_type && (
                    <span className={styles.spiritBadge}>{recipe.spirit_type}</span>
                  )}

                  <p className={styles.ingredients}>
                    {(() => {
                      const ingredientsArray = parseIngredients(recipe.ingredients);
                      if (ingredientsArray.length === 0) return 'No ingredients listed';
                      const displayIngredients = ingredientsArray.slice(0, 3).join(', ');
                      return ingredientsArray.length > 3 ? `${displayIngredients}...` : displayIngredients;
                    })()}
                  </p>

                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    View Recipe
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* CSV Upload Modal */}
        <CSVUploadModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          type="recipes"
          onUpload={handleCSVUpload}
        />

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
    </div>
  );
}
