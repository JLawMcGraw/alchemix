'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Spinner } from '@/components/ui';
import { ChevronDown, ChevronLeft, ChevronRight, X, Check, RefreshCw, Plus, Award } from 'lucide-react';
import { RecipeDetailModal } from '@/components/modals/RecipeDetailModal';
import { ItemDetailModal } from '@/components/modals/ItemDetailModal';
import type { Recipe, InventoryItem } from '@/types';
import styles from './shopping-list.module.css';

export default function ShoppingListPage() {
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    shoppingListSuggestions,
    shoppingListStats,
    shoppingListItems,
    craftableRecipes,
    nearMissRecipes,
    isLoadingShoppingList,
    fetchShoppingList,
    fetchShoppingListItems,
    addShoppingListItem,
    toggleShoppingListItem,
    removeShoppingListItem,
    clearCheckedItems,
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

  const [expandedIngredient, setExpandedIngredient] = useState<number | null>(null);
  const [customItemInput, setCustomItemInput] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7;

  const safeCraftableRecipes = Array.isArray(craftableRecipes) ? craftableRecipes : [];
  const safeNearMissRecipes = Array.isArray(nearMissRecipes) ? nearMissRecipes : [];
  const safeFavorites = Array.isArray(favorites) ? favorites : [];

  // Merge partial recipe data from shopping-list API with full recipe details from the store
  const enrichRecipe = (recipe: any): Recipe => {
    const fromStore = Array.isArray(recipes)
      ? recipes.find((r) => r.id === recipe.id) || recipes.find((r) => r.name === recipe.name)
      : null;
    return fromStore ? { ...fromStore, ...recipe } : recipe;
  };

  // Build recommendations with their unlocked recipes
  const recommendations = useMemo(() => {
    return shoppingListSuggestions.map((suggestion, index) => {
      // Find all near-miss recipes that need this ingredient
      const recipesForIngredient = safeNearMissRecipes
        .filter((recipe) => recipe.missingIngredient?.toLowerCase() === suggestion.ingredient.toLowerCase())
        .map((recipe) => enrichRecipe(recipe).name);

      return {
        id: index + 1,
        name: suggestion.ingredient
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' '),
        unlocks: suggestion.unlocks,
        recipes: recipesForIngredient,
      };
    });
  }, [shoppingListSuggestions, safeNearMissRecipes, recipes]);

  const topPick = recommendations[0];

  // Pagination for other recommendations (excluding top pick)
  const allOtherRecs = recommendations.slice(1);
  const totalPages = Math.ceil(allOtherRecs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const otherRecs = allOtherRecs.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setExpandedIngredient(null); // Collapse any expanded items when changing page
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      setExpandedIngredient(null); // Collapse any expanded items when changing page
    }
  };

  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchShoppingList().catch(console.error);
      fetchShoppingListItems().catch(console.error);
      fetchRecipes().catch(console.error);
      fetchItems().catch(console.error);
      fetchFavorites().catch(console.error);
    }
  }, [isAuthenticated, isValidating, fetchShoppingList, fetchShoppingListItems, fetchRecipes, fetchItems, fetchFavorites]);

  // Re-fetch shopping list whenever inventory changes
  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchShoppingList().catch(console.error);
    }
  }, [inventoryVersion, isAuthenticated, isValidating, fetchShoppingList]);

  if (isValidating || !isAuthenticated) {
    return null;
  }

  const toggleExpand = (id: number) => {
    setExpandedIngredient(expandedIngredient === id ? null : id);
  };

  const addToList = async (name: string) => {
    if (shoppingListItems.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
    try {
      await addShoppingListItem(name);
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const toggleChecked = async (id: number) => {
    try {
      await toggleShoppingListItem(id);
    } catch (error) {
      console.error('Failed to toggle item:', error);
    }
  };

  const removeFromList = async (id: number) => {
    try {
      await removeShoppingListItem(id);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const clearCompleted = async () => {
    try {
      await clearCheckedItems();
    } catch (error) {
      console.error('Failed to clear completed:', error);
    }
  };

  const isInList = (name: string) => {
    return shoppingListItems.some((item) => item.name.toLowerCase() === name.toLowerCase());
  };

  const handleAddCustomItem = async () => {
    if (customItemInput.trim()) {
      await addToList(customItemInput.trim());
      setCustomItemInput('');
    }
  };

  const handleRefresh = async () => {
    if (isLoadingShoppingList || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchShoppingList();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRecipeClick = (recipeName: string) => {
    const recipe = safeNearMissRecipes.find(
      (r) => enrichRecipe(r).name === recipeName
    );
    if (recipe) {
      setSelectedRecipe(enrichRecipe(recipe));
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRecipe(null);
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

  // Calculate impact summary
  const uncheckedItems = shoppingListItems.filter((item) => !item.checked);
  const checkedItems = shoppingListItems.filter((item) => item.checked);
  const totalUnlocks = uncheckedItems.reduce((sum, item) => {
    const rec = recommendations.find(
      (r) => r.name.toLowerCase() === item.name.toLowerCase()
    );
    return sum + (rec?.unlocks || 0);
  }, 0);

  const craftableCount = shoppingListStats?.craftable || 0;
  const nearMissCount = shoppingListStats?.nearMisses || 0;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>What Should I Buy Next?</h1>
          <p className={styles.subtitle}>
            <span className={styles.craftableCount}>{craftableCount} craftable</span>
            {' · '}
            <span className={styles.nearMissCount}>{nearMissCount} near misses</span>
            {' · '}
            {recommendations.length} recommendations
          </p>
        </div>

        {/* Loading State */}
        {isLoadingShoppingList && (
          <div className={styles.loadingContainer}>
            <Spinner />
            <p className={styles.loadingText}>Analyzing your bar inventory...</p>
          </div>
        )}

        {/* Main Content */}
        {!isLoadingShoppingList && (
          <div className={styles.mainGrid}>
            {/* Left Column: Recommendations */}
            <div className={styles.leftColumn}>
              {/* Top Pick Hero */}
              {topPick && (
                <div className={styles.topPickCard}>
                  <div className={styles.topPickHeader}>
                    <div className={styles.topPickBadge}>
                      <Award size={16} className={styles.topPickIcon} />
                      <span className={styles.topPickLabel}>Top Pick</span>
                    </div>
                    {!isInList(topPick.name) && (
                      <button
                        className={styles.addToListBtn}
                        onClick={() => addToList(topPick.name)}
                      >
                        + Add to List
                      </button>
                    )}
                  </div>
                  <div className={styles.topPickContent}>
                    <div className={styles.topPickMain}>
                      <h2 className={styles.topPickName}>{topPick.name}</h2>
                      <span className={styles.topPickUnlocks}>+{topPick.unlocks}</span>
                    </div>
                    <p className={styles.topPickDesc}>
                      Unlocks {topPick.unlocks} new recipe{topPick.unlocks !== 1 ? 's' : ''}
                    </p>
                    {topPick.recipes.length > 0 && (
                      <div className={styles.recipeChips}>
                        {topPick.recipes.map((recipe) => (
                          <button
                            key={recipe}
                            className={styles.recipeChip}
                            onClick={() => handleRecipeClick(recipe)}
                          >
                            {recipe}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Other Recommendations */}
              {allOtherRecs.length > 0 && (
                <div className={styles.otherRecsCard}>
                  <div className={styles.otherRecsHeader}>
                    <h3 className={styles.otherRecsTitle}>Other Recommendations</h3>
                    <button
                      className={styles.refreshBtn}
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                    >
                      <RefreshCw size={14} className={isRefreshing ? styles.spinning : ''} />
                    </button>
                  </div>
                  <div className={styles.recList}>
                    {otherRecs.map((rec, index) => {
                      const globalRank = startIndex + index + 2; // +2 because top pick is #1
                      return (
                        <div key={rec.id}>
                          <div
                            className={styles.recRow}
                            onClick={() => toggleExpand(rec.id)}
                          >
                            <span className={styles.recRank}>{globalRank}.</span>
                            <span className={styles.recName}>{rec.name}</span>
                            <span className={styles.recUnlocks}>+{rec.unlocks}</span>
                            {!isInList(rec.name) ? (
                              <button
                                className={styles.addBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToList(rec.name);
                                }}
                              >
                                + Add
                              </button>
                            ) : (
                              <span className={styles.addedBadge}>✓ Added</span>
                            )}
                            <ChevronDown
                              size={16}
                              className={`${styles.chevron} ${
                                expandedIngredient === rec.id ? styles.chevronExpanded : ''
                              }`}
                            />
                          </div>

                          {/* Expanded Recipes */}
                          {expandedIngredient === rec.id && rec.recipes.length > 0 && (
                            <div className={styles.expandedRecipes}>
                              <p className={styles.expandedLabel}>Unlocks these recipes:</p>
                              <div className={styles.recipeChips}>
                                {rec.recipes.map((recipe) => (
                                  <button
                                    key={recipe}
                                    className={styles.recipeChip}
                                    onClick={() => handleRecipeClick(recipe)}
                                  >
                                    {recipe}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className={styles.pagination}>
                      <button
                        className={styles.paginationBtn}
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                      <span className={styles.pageInfo}>
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        className={styles.paginationBtn}
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {recommendations.length === 0 && shoppingListStats && shoppingListStats.totalRecipes > 0 && (
                <div className={styles.emptyState}>
                  <p className={styles.emptyTitle}>No Recommendations Available</p>
                  <p className={styles.emptyText}>
                    You can already make most of your recipes, or you need multiple ingredients
                    to unlock new ones.
                  </p>
                </div>
              )}

              {recommendations.length === 0 && shoppingListStats && shoppingListStats.totalRecipes === 0 && (
                <div className={styles.emptyState}>
                  <p className={styles.emptyTitle}>No Recipes Found</p>
                  <p className={styles.emptyText}>
                    Add some recipes to your collection to get smart shopping recommendations.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Shopping List */}
            <div className={styles.rightColumn}>
              {/* My Shopping List */}
              <div className={styles.shoppingListCard}>
                <div className={styles.shoppingListHeader}>
                  <h3 className={styles.shoppingListTitle}>My Shopping List</h3>
                  <span className={styles.itemCount}>
                    {uncheckedItems.length} item{uncheckedItems.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {shoppingListItems.length === 0 ? (
                  <div className={styles.emptyList}>
                    <p className={styles.emptyListText}>No items yet</p>
                    <p className={styles.emptyListHint}>Click &quot;+ Add&quot; on recommendations</p>
                  </div>
                ) : (
                  <div className={styles.shoppingItems}>
                    {/* Unchecked items first */}
                    {uncheckedItems.map((item) => (
                      <div key={item.id} className={styles.shoppingItem}>
                        <button
                          className={styles.checkbox}
                          onClick={() => toggleChecked(item.id)}
                        />
                        <span className={styles.itemName}>{item.name}</span>
                        <button
                          className={styles.removeBtn}
                          onClick={() => removeFromList(item.id)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}

                    {/* Checked items */}
                    {checkedItems.map((item) => (
                      <div key={item.id} className={`${styles.shoppingItem} ${styles.checkedItem}`}>
                        <button
                          className={`${styles.checkbox} ${styles.checkboxChecked}`}
                          onClick={() => toggleChecked(item.id)}
                        >
                          <Check size={12} />
                        </button>
                        <span className={`${styles.itemName} ${styles.checkedName}`}>
                          {item.name}
                        </span>
                        <button
                          className={styles.removeBtn}
                          onClick={() => removeFromList(item.id)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Clear completed */}
                {checkedItems.length > 0 && (
                  <div className={styles.clearCompletedRow}>
                    <button className={styles.clearCompletedBtn} onClick={clearCompleted}>
                      Clear Completed
                    </button>
                  </div>
                )}
              </div>

              {/* Impact Summary */}
              <div className={styles.impactCard}>
                <div className={styles.impactLabel}>Impact Summary</div>
                <div className={styles.impactRow}>
                  <span className={styles.impactText}>Items to buy</span>
                  <span className={styles.impactValue}>{uncheckedItems.length}</span>
                </div>
                <div className={styles.impactRow}>
                  <span className={styles.impactText}>New recipes unlocked</span>
                  <span className={styles.impactValueGreen}>+{totalUnlocks}</span>
                </div>
              </div>

              {/* Add Custom Item */}
              <div className={styles.customItemCard}>
                <input
                  type="text"
                  placeholder="Add custom item..."
                  className={styles.customItemInput}
                  value={customItemInput}
                  onChange={(e) => setCustomItemInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomItem();
                    }
                  }}
                />
                <button
                  className={`${styles.customItemAddBtn} ${!customItemInput.trim() ? styles.customItemAddBtnDisabled : ''}`}
                  onClick={handleAddCustomItem}
                  disabled={!customItemInput.trim()}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
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
        onClose={() => {
          setIsItemModalOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
      />
    </div>
  );
}
