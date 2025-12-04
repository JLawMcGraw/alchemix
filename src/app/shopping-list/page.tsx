'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Card } from '@/components/ui/Card';
import { Spinner, Button } from '@/components/ui';
import { ShoppingCart, TrendingUp, AlertCircle, ChevronRight, ChevronLeft, CheckCircle, Wine } from 'lucide-react';
import { RecipeDetailModal } from '@/components/modals/RecipeDetailModal';
import { ItemDetailModal } from '@/components/modals/ItemDetailModal';
import type { Recipe, InventoryItem } from '@/types';
import styles from './shopping-list.module.css';

type ViewMode = 'recommendations' | 'craftable' | 'nearMisses' | 'inventory';

export default function ShoppingListPage() {
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    shoppingListSuggestions,
    shoppingListStats,
    craftableRecipes,
    nearMissRecipes,
    isLoadingShoppingList,
    fetchShoppingList,
    recipes,
    inventoryItems,
    fetchRecipes,
    fetchItems,
    favorites,
    addFavorite,
    removeFavorite,
    fetchFavorites,
    inventoryVersion,
  } = useStore();

  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('recommendations');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);
  const [ingredientRecipes, setIngredientRecipes] = useState<any[]>([]);
  const itemsPerPage = 10;

  const safeCraftableRecipes = Array.isArray(craftableRecipes) ? craftableRecipes : [];
  const safeNearMissRecipes = Array.isArray(nearMissRecipes) ? nearMissRecipes : [];
  const safeFavorites = Array.isArray(favorites) ? favorites : [];
  const safeInventoryItems = Array.isArray(inventoryItems) ? inventoryItems : [];

  // Merge partial recipe data from shopping-list API with full recipe details from the store
  const enrichRecipe = (recipe: any): Recipe => {
    const fromStore = Array.isArray(recipes)
      ? recipes.find((r) => r.id === recipe.id) || recipes.find((r) => r.name === recipe.name)
      : null;
    return fromStore ? { ...fromStore, ...recipe } : recipe;
  };

  const enrichRecipes = (list: any[]) => list.map(enrichRecipe);

  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchShoppingList().catch(console.error);
      fetchRecipes().catch(console.error);
      fetchItems().catch(console.error);
      fetchFavorites().catch(console.error);
    }
  }, [isAuthenticated, isValidating, fetchShoppingList, fetchRecipes, fetchItems, fetchFavorites]);

  // Re-fetch shopping list whenever inventory changes (stock adjustments, add/delete)
  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchShoppingList().catch(console.error);
    }
  }, [inventoryVersion, isAuthenticated, isValidating, fetchShoppingList]);

  // Keep shopping list in sync with the in-memory inventory list (edge cases where version misses)
  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchShoppingList().catch(console.error);
    }
  }, [safeInventoryItems, isAuthenticated, isValidating, fetchShoppingList]);

  if (isValidating || !isAuthenticated) {
    return null;
  }

  // Pagination logic
  const totalPages = Math.ceil(shoppingListSuggestions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSuggestions = shoppingListSuggestions.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStatClick = (mode: ViewMode) => {
    setViewMode(mode);
    setCurrentPage(1);
  };

  const handleRecipeClick = (recipe: any) => {
    setSelectedRecipe(enrichRecipe(recipe));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRecipe(null);
  };

  const handleRefreshShoppingList = async () => {
    if (isLoadingShoppingList || isManualRefresh) return;
    setIsManualRefresh(true);
    try {
      await fetchShoppingList();
    } finally {
      setIsManualRefresh(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!selectedRecipe) return;
    const recipeId = selectedRecipe.id;
    const existingFavorite = recipeId
      ? safeFavorites.find((fav) => fav.recipe_id === recipeId)
      : safeFavorites.find(
          (fav) => fav.recipe_name?.toLowerCase() === selectedRecipe.name.toLowerCase()
        );

    try {
      if (existingFavorite?.id) {
        await removeFavorite(existingFavorite.id);
      } else {
        await addFavorite(selectedRecipe.name, recipeId);
      }
      await fetchFavorites();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const isRecipeFavorited = (recipeId?: number, recipeName?: string) => {
    if (!safeFavorites.length) return false;
    if (recipeId) {
      return safeFavorites.some((fav) => fav.recipe_id === recipeId);
    }
    if (recipeName) {
      return safeFavorites.some(
        (fav) => fav.recipe_name?.toLowerCase() === recipeName.toLowerCase()
      );
    }
    return false;
  };

  const parseIngredients = (ingredients: string | string[] | undefined): string[] => {
    if (!ingredients) return [];
    if (Array.isArray(ingredients)) {
      return ingredients.filter((ingredient) => typeof ingredient === 'string');
    }
    try {
      const parsed = JSON.parse(ingredients);
      if (Array.isArray(parsed)) {
        return parsed.filter((ingredient) => typeof ingredient === 'string');
      }
    } catch {
      // Fallback below
    }
    return ingredients
      .split(',')
      .map((ingredient) => ingredient.trim())
      .filter(Boolean);
  };

  const handleItemClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsItemModalOpen(true);
  };

  const handleCloseItemModal = () => {
    setIsItemModalOpen(false);
    setSelectedItem(null);
  };

  const handleIngredientClick = (ingredient: string) => {
    // Find all near-miss recipes that need this ingredient
    const recipesForIngredient = safeNearMissRecipes.filter(
      (recipe) => recipe.missingIngredient === ingredient
    );
    setSelectedIngredient(ingredient);
    setIngredientRecipes(enrichRecipes(recipesForIngredient));
    setViewMode('nearMisses'); // Switch to near-miss view to show the recipes
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerLeft}>
              <ShoppingCart className={styles.headerIcon} size={32} />
              <div>
                <h1 className={styles.title}>Smart Shopping List</h1>
                <p className={styles.subtitle}>
                  Discover which ingredients will unlock the most new cocktails
                </p>
              </div>
            </div>
            <div className={styles.headerActions}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshShoppingList}
                disabled={isLoadingShoppingList || isManualRefresh}
              >
                {(isLoadingShoppingList || isManualRefresh) && <Spinner size="sm" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoadingShoppingList && (
          <div className={styles.loadingContainer}>
            <Spinner />
            <p className={styles.loadingText}>Analyzing your bar inventory...</p>
          </div>
        )}

        {/* Statistics Cards - Clickable */}
        {!isLoadingShoppingList && shoppingListStats && (
          <div className={styles.statsGrid}>
            <Card
              padding="md"
              hover
              className={`${styles.statCard} ${viewMode === 'recommendations' ? styles.statCardActive : ''}`}
              onClick={() => handleStatClick('recommendations')}
            >
              <div className={styles.statLabel}>Total Recipes</div>
              <div className={styles.statValue}>{shoppingListStats.totalRecipes}</div>
              <div className={styles.statHint}>View recommendations</div>
            </Card>
            <Card
              padding="md"
              hover
              className={`${styles.statCard} ${viewMode === 'craftable' ? styles.statCardActive : ''}`}
              onClick={() => handleStatClick('craftable')}
            >
              <div className={styles.statLabel}>Already Craftable</div>
              <div className={styles.statValue}>{shoppingListStats.craftable}</div>
              <div className={styles.statHint}>Click to view</div>
            </Card>
            <Card
              padding="md"
              hover
              className={`${styles.statCard} ${viewMode === 'nearMisses' ? styles.statCardActive : ''}`}
              onClick={() => handleStatClick('nearMisses')}
            >
              <div className={styles.statLabel}>Near Misses</div>
              <div className={styles.statValue}>{shoppingListStats.nearMisses}</div>
              <div className={styles.statHint}>Click to view</div>
            </Card>
            <Card
              padding="md"
              hover
              className={`${styles.statCard} ${viewMode === 'inventory' ? styles.statCardActive : ''}`}
              onClick={() => handleStatClick('inventory')}
            >
              <div className={styles.statLabel}>Inventory Items</div>
              <div className={styles.statValue}>{shoppingListStats.inventoryItems}</div>
              <div className={styles.statHint}>Click to view</div>
            </Card>
          </div>
        )}

        {/* Empty State - No Inventory or Recipes */}
        {!isLoadingShoppingList &&
          shoppingListStats &&
          shoppingListStats.totalRecipes === 0 && (
            <Card padding="lg" className={styles.emptyState}>
              <AlertCircle className={styles.emptyIcon} size={48} />
              <h2 className={styles.emptyTitle}>No Recipes Found</h2>
              <p className={styles.emptyText}>
                Add some recipes to your collection to get smart shopping recommendations.
              </p>
              <p className={styles.emptyHint}>
                Try importing recipes from the Recipes page to get started!
              </p>
            </Card>
          )}

        {/* Empty State - No Recommendations */}
        {!isLoadingShoppingList &&
          shoppingListSuggestions.length === 0 &&
          shoppingListStats &&
          shoppingListStats.totalRecipes > 0 && (
            <Card padding="lg" className={styles.emptyState}>
              <ShoppingCart className={styles.emptyIcon} size={48} />
              <h2 className={styles.emptyTitle}>No Recommendations Available</h2>
              <p className={styles.emptyText}>
                You can already make most of your recipes, or you need multiple ingredients
                to unlock new ones.
              </p>
              <p className={styles.emptyHint}>
                Try adding more recipes to your collection to get recommendations!
              </p>
            </Card>
          )}

        {/* View Modes */}
        {!isLoadingShoppingList && (
          <>
            {/* Recommendations View */}
            {viewMode === 'recommendations' && shoppingListSuggestions.length > 0 && (
              <div className={styles.recommendations}>
                <h2 className={styles.sectionTitle}>
                  <TrendingUp size={24} />
                  Recommended Ingredients
                </h2>
                <p className={styles.sectionSubtitle}>
                  Purchase any of these ingredients to unlock new cocktail recipes
                </p>

                <div className={styles.suggestionsList}>
                  {currentSuggestions.map((suggestion, index) => {
                    const globalIndex = startIndex + index;
                    return (
                      <Card
                        key={`${suggestion.ingredient}-${globalIndex}`}
                        padding="md"
                        hover
                        className={styles.suggestionCard}
                        onClick={() => handleIngredientClick(suggestion.ingredient)}
                      >
                        <div className={styles.suggestionRank}>#{globalIndex + 1}</div>
                        <div className={styles.suggestionContent}>
                          <h3 className={styles.ingredientName}>
                            {suggestion.ingredient
                              .split(' ')
                              .map(
                                (word) =>
                                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                              )
                              .join(' ')}
                          </h3>
                          <div className={styles.unlocksInfo}>
                            <span className={styles.unlocksCount}>
                              {suggestion.unlocks}
                            </span>
                            <span className={styles.unlocksLabel}>
                              {suggestion.unlocks === 1 ? 'recipe' : 'recipes'} unlocked
                            </span>
                          </div>
                          <div className={styles.clickHint} style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-primary)',
                            marginTop: 'var(--space-1)',
                            fontWeight: 500
                          }}>
                            Click to view recipes →
                          </div>
                        </div>
                        <div className={styles.suggestionBadge}>
                          +{suggestion.unlocks}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <Button
                      variant="outline"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft size={18} />
                      Previous
                    </Button>
                    <span className={styles.pageInfo}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight size={18} />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Craftable Recipes View */}
            {viewMode === 'craftable' && (
              <div className={styles.recommendations}>
                <h2 className={styles.sectionTitle}>
                  <CheckCircle size={24} />
                  Craftable Recipes ({shoppingListStats?.craftable || 0})
                </h2>
                <p className={styles.sectionSubtitle}>
                  Recipes you can make right now with your current inventory
                </p>
                {safeCraftableRecipes.length > 0 ? (
                  <div className={styles.suggestionsList}>
                    {safeCraftableRecipes.map((recipe) => (
                      <Card
                        key={recipe.id}
                        padding="md"
                        hover
                        className={styles.suggestionCard}
                        onClick={() => handleRecipeClick(recipe)}
                      >
                        <CheckCircle
                          size={24}
                          className={styles.headerIcon}
                          style={{ color: 'var(--color-primary)' }}
                        />
                        <div className={styles.suggestionContent}>
                          <h3 className={styles.ingredientName}>{recipe.name}</h3>
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                            {parseIngredients(recipe.ingredients).join(', ')}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card padding="lg" className={styles.infoCard}>
                    <p className={styles.infoText}>
                      No craftable recipes found. Add more ingredients to your bar inventory!
                    </p>
                  </Card>
                )}
              </div>
            )}

            {/* Near Misses View */}
            {viewMode === 'nearMisses' && (
              <div className={styles.recommendations}>
                <h2 className={styles.sectionTitle}>
                  <AlertCircle size={24} />
                  {selectedIngredient && ingredientRecipes.length > 0
                    ? `Recipes Unlocked by "${selectedIngredient.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}" (${ingredientRecipes.length})`
                    : `Near Miss Recipes (${shoppingListStats?.nearMisses || 0})`
                  }
                </h2>
                {selectedIngredient && ingredientRecipes.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedIngredient(null);
                      setIngredientRecipes([]);
                    }}
                    style={{ marginBottom: 'var(--space-3)' }}
                  >
                    ← Back to All Near Misses
                  </Button>
                )}
                <p className={styles.sectionSubtitle}>
                  {selectedIngredient && ingredientRecipes.length > 0
                    ? `Add this ingredient to make these ${ingredientRecipes.length} cocktail${ingredientRecipes.length === 1 ? '' : 's'}`
                    : "Recipes you're missing just ONE ingredient from making"
                  }
                </p>
                {(selectedIngredient && ingredientRecipes.length > 0 ? ingredientRecipes : enrichRecipes(safeNearMissRecipes)).length > 0 ? (
                  <div className={styles.suggestionsList}>
                    {(selectedIngredient && ingredientRecipes.length > 0 ? ingredientRecipes : enrichRecipes(safeNearMissRecipes)).map((recipe) => (
                      <Card
                        key={recipe.id}
                        padding="md"
                        hover
                        className={styles.suggestionCard}
                        onClick={() => handleRecipeClick(recipe)}
                      >
                        <AlertCircle
                          size={24}
                          style={{ color: 'var(--color-secondary)', flexShrink: 0 }}
                        />
                        <div className={styles.suggestionContent}>
                          <h3 className={styles.ingredientName}>{recipe.name}</h3>
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                            {parseIngredients(recipe.ingredients).join(', ')}
                          </div>
                          <div style={{
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-secondary)',
                            marginTop: 'var(--space-2)',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)'
                          }}>
                            <span>Missing:</span>
                            <span style={{
                              background: 'rgba(242, 167, 75, 0.1)',
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: 'var(--radius-sm)',
                              textTransform: 'capitalize'
                            }}>
                              {recipe.missingIngredient}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card padding="lg" className={styles.infoCard}>
                    <p className={styles.infoText}>
                      No near-miss recipes found. You can already make most of your recipes!
                    </p>
                  </Card>
                )}
              </div>
            )}

            {/* Inventory View */}
            {viewMode === 'inventory' && safeInventoryItems.length > 0 && (
              <div className={styles.recommendations}>
                <h2 className={styles.sectionTitle}>
                  <Wine size={24} />
                  Your Bar Inventory ({safeInventoryItems.length} items)
                </h2>
                <p className={styles.sectionSubtitle}>
                  All items and ingredients in your collection
                </p>
                <div className={styles.inventoryList}>
                  {safeInventoryItems.map((item, index) => (
                    <Card
                      key={item.id || index}
                      padding="md"
                      hover
                      className={styles.inventoryCard}
                      onClick={() => handleItemClick(item)}
                    >
                      <div className={styles.inventoryContent}>
                        <h3 className={styles.bottleName}>{item.name}</h3>
                        {item.category && (
                          <span className={styles.bottleCategory}>{item.category}</span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* How it Works */}
        {!isLoadingShoppingList && shoppingListSuggestions.length > 0 && (
          <Card padding="lg" className={styles.infoCard}>
            <h3 className={styles.infoTitle}>How It Works</h3>
            <p className={styles.infoText}>
              Our smart algorithm analyzes your current bar inventory against your entire
              recipe collection to identify &quot;near miss&quot; cocktails—recipes you&apos;re missing
              just <strong>one ingredient</strong> from making.
            </p>
            <p className={styles.infoText}>
              The recommendations are ranked by how many new cocktails each ingredient
              would unlock, helping you maximize your cocktail-making potential with
              strategic purchases.
            </p>
          </Card>
        )}
      </div>

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        recipe={selectedRecipe}
        isFavorited={
          selectedRecipe
            ? isRecipeFavorited(selectedRecipe.id, selectedRecipe.name)
            : false
        }
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Item Detail Modal */}
      <ItemDetailModal
        isOpen={isItemModalOpen}
        onClose={handleCloseItemModal}
        item={selectedItem}
      />
    </div>
  );
}
