'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Button, useToast, Spinner } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { BookOpen, Upload, Star, Martini, ChevronLeft, ChevronRight, Trash2, FolderOpen, Plus, Edit, Trash, CheckSquare, Square, ShoppingCart, CheckCircle, AlertCircle, Wine } from 'lucide-react';
import { CSVUploadModal, RecipeDetailModal, DeleteConfirmModal, CollectionModal } from '@/components/modals';
import { recipeApi } from '@/lib/api';
import type { Recipe, Collection } from '@/types';
import styles from './recipes.module.css';
import shoppingStyles from '../shopping-list/shopping-list.module.css';

export default function RecipesPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    recipes,
    favorites,
    collections,
    fetchRecipes,
    fetchFavorites,
    fetchCollections,
    addFavorite,
    removeFavorite,
    addCollection,
    updateCollection,
    deleteCollection,
    updateRecipe,
    bulkDeleteRecipes,
    shoppingListStats,
    craftableRecipes,
    nearMissRecipes,
    isLoadingShoppingList,
    fetchShoppingList,
    inventoryItems,
    fetchItems,
  } = useStore();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpirit, setFilterSpirit] = useState<string>('all');
  const [filterCollection, setFilterCollection] = useState<string>('all');
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [showCollectionDeleteConfirm, setShowCollectionDeleteConfirm] = useState(false);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);
  const [showCollectionsPanel, setShowCollectionsPanel] = useState(false);
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveCollectionId, setBulkMoveCollectionId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });

  const loadRecipes = async (page: number = 1) => {
    try {
      const result = await recipeApi.getAll(page, 50);
      // Manually update the store's recipes since fetchRecipes expects the old format
      useStore.setState({ recipes: result.recipes });
      setPagination(result.pagination);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to load recipes:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      loadRecipes(1);
      fetchFavorites().catch(console.error);
      fetchCollections().catch(console.error);
      fetchShoppingList().catch(console.error);
      fetchItems().catch(console.error);
    }
  }, [isAuthenticated, isValidating, fetchFavorites, fetchCollections, fetchShoppingList, fetchItems]);

  if (isValidating || !isAuthenticated) {
    return null;
  }

  // Ensure arrays
  const recipesArray = Array.isArray(recipes) ? recipes : [];
  const favoritesArray = Array.isArray(favorites) ? favorites : [];
  const collectionsArray = Array.isArray(collections) ? collections : [];

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

  // Filter recipes based on active collection
  const filteredRecipes = recipesArray.filter((recipe) => {
    const ingredientsArray = parseIngredients(recipe.ingredients);
    const ingredientsText = ingredientsArray.join(' ').toLowerCase();

    const matchesSearch = searchQuery
      ? recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ingredientsText.includes(searchQuery.toLowerCase())
      : true;
    const matchesSpirit = filterSpirit === 'all' || recipe.spirit_type === filterSpirit;

    // If viewing a collection, show only recipes in that collection
    // Otherwise, show only uncategorized recipes
    const matchesCollection = activeCollection
      ? recipe.collection_id === activeCollection.id
      : !recipe.collection_id;

    return matchesSearch && matchesSpirit && matchesCollection;
  });

  // Count uncategorized recipes
  const uncategorizedRecipesOnPage = recipesArray.filter((r) => !r.collection_id).length;
  const categorizedRecipeCount = collectionsArray.reduce(
    (sum, collection) => sum + (collection.recipe_count ?? 0),
    0
  );
  const uncategorizedCount = pagination.total
    ? Math.max(pagination.total - categorizedRecipeCount, uncategorizedRecipesOnPage)
    : uncategorizedRecipesOnPage;
  const totalRecipeCount = pagination.total || recipesArray.length;

  const isFavorited = (recipeId: number) => {
    return favoritesArray.some((fav) => fav.recipe_id === recipeId);
  };

  const handleCSVUpload = async (file: File, collectionId?: number) => {
    try {
      const result = await recipeApi.importCSV(file, collectionId);
      await loadRecipes(1); // Reload first page after import
      // Refresh collections to update recipe counts
      if (collectionId) {
        await fetchCollections();
      }
      if (result.imported > 0) {
        if (result.failed > 0) {
          showToast('success', `Imported ${result.imported} recipes. ${result.failed} failed.`);
        } else {
          showToast('success', `Successfully imported ${result.imported} recipes`);
        }
      } else {
        showToast('error', 'No recipes were imported. Check your CSV format.');
      }
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

  const handleDeleteAll = async () => {
    try {
      const result = await recipeApi.deleteAll();
      await loadRecipes(1);
      await fetchCollections();
      setSelectedRecipes(new Set());
      showToast('success', result.message);
      setShowDeleteConfirm(false);
    } catch (error) {
      showToast('error', 'Failed to delete recipes');
      console.error('Failed to delete all recipes:', error);
    }
  };

  const handleCollectionSubmit = async (collection: Collection) => {
    try {
      if (editingCollection && editingCollection.id) {
        await updateCollection(editingCollection.id, collection);
        showToast('success', 'Collection updated successfully');
      } else {
        await addCollection(collection);
        showToast('success', 'Collection created successfully');
      }
      setCollectionModalOpen(false);
      setEditingCollection(null);
      await fetchCollections();
    } catch (error) {
      showToast('error', editingCollection ? 'Failed to update collection' : 'Failed to create collection');
      console.error('Failed to save collection:', error);
      throw error;
    }
  };

  const handleEditCollection = (collection: Collection) => {
    setEditingCollection(collection);
    setCollectionModalOpen(true);
  };

  const handleDeleteCollection = async () => {
    if (!deletingCollection || !deletingCollection.id) return;
    try {
      await deleteCollection(deletingCollection.id);
      showToast('success', 'Collection deleted successfully');
      setShowCollectionDeleteConfirm(false);
      setDeletingCollection(null);
      await fetchCollections();
      await loadRecipes(1);
    } catch (error) {
      showToast('error', 'Failed to delete collection');
      console.error('Failed to delete collection:', error);
    }
  };

  // Bulk selection handlers
  const toggleRecipeSelection = (recipeId: number) => {
    const newSelected = new Set(selectedRecipes);
    if (newSelected.has(recipeId)) {
      newSelected.delete(recipeId);
    } else {
      newSelected.add(recipeId);
    }
    setSelectedRecipes(newSelected);
  };

  const selectAllRecipes = () => {
    if (selectedRecipes.size === filteredRecipes.length) {
      setSelectedRecipes(new Set());
    } else {
      setSelectedRecipes(new Set(filteredRecipes.map((r) => r.id!)));
    }
  };

  const clearSelection = () => {
    setSelectedRecipes(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedRecipes.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedRecipes.size} ${selectedRecipes.size === 1 ? 'recipe' : 'recipes'}? This action cannot be undone.`)) {
      return;
    }

    try {
      const ids = Array.from(selectedRecipes);
      const deleted = await bulkDeleteRecipes(ids);
      await loadRecipes(currentPage);
      await fetchCollections();
      setSelectedRecipes(new Set());
      showToast('success', `Deleted ${deleted} ${deleted === 1 ? 'recipe' : 'recipes'}`);
    } catch (error) {
      showToast('error', 'Failed to delete recipes');
      console.error('Failed to bulk delete:', error);
    }
  };

  const handleBulkMove = async () => {
    if (selectedRecipes.size === 0) return;

    try {
      let moved = 0;
      for (const recipeId of selectedRecipes) {
        await updateRecipe(recipeId, { collection_id: bulkMoveCollectionId || undefined });
        moved++;
      }
      await loadRecipes(1);
      await fetchCollections();
      setSelectedRecipes(new Set());
      setShowBulkMoveModal(false);
      setBulkMoveCollectionId(null);
      const collectionName = bulkMoveCollectionId
        ? collectionsArray.find((c) => c.id === bulkMoveCollectionId)?.name || 'collection'
        : 'Uncategorized';
      showToast('success', `Moved ${moved} ${moved === 1 ? 'recipe' : 'recipes'} to ${collectionName}`);
    } catch (error) {
      showToast('error', 'Failed to move some recipes');
      console.error('Failed to bulk move:', error);
    }
  };

  return (
    <div className={styles.recipesPage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              {activeCollection ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveCollection(null)}
                    style={{ marginRight: '8px', padding: '4px' }}
                  >
                    <ChevronLeft size={24} />
                  </Button>
                  <FolderOpen size={32} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
                  {activeCollection.name}
                </>
              ) : (
                <>
                  <BookOpen size={32} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
                  Recipe Collections
                </>
              )}
            </h1>
            <p className={styles.subtitle}>
              {activeCollection
                ? `${activeCollection.recipe_count || 0} ${activeCollection.recipe_count === 1 ? 'recipe' : 'recipes'} in this collection`
                : `${collectionsArray.length} ${collectionsArray.length === 1 ? 'collection' : 'collections'}${uncategorizedCount > 0 ? ` • ${uncategorizedCount} uncategorized ${uncategorizedCount === 1 ? 'recipe' : 'recipes'}` : ''}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {activeCollection ? null : (
              <>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setEditingCollection(null);
                    setCollectionModalOpen(true);
                  }}
                >
                  <Plus size={18} />
                  New Collection
                </Button>
                <Button variant="outline" size="md" onClick={() => setCsvModalOpen(true)}>
                  <Upload size={18} />
                  Import CSV
                </Button>
                {totalRecipeCount > 0 && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{ color: 'var(--color-semantic-error)', borderColor: 'var(--color-semantic-error)' }}
                  >
                    <Trash2 size={18} />
                    Delete All Recipes
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Loading State for Shopping List Stats */}
        {isLoadingShoppingList && (
          <div className={shoppingStyles.loadingContainer}>
            <Spinner />
            <p className={shoppingStyles.loadingText}>Loading statistics...</p>
          </div>
        )}

        {/* Statistics Cards */}
        {!isLoadingShoppingList && shoppingListStats && (
          <div className={shoppingStyles.statsGrid}>
            <Card
              padding="md"
              hover
              className={shoppingStyles.statCard}
            >
              <div className={shoppingStyles.statLabel}>Total Recipes</div>
              <div className={shoppingStyles.statValue}>{shoppingListStats.totalRecipes}</div>
              <div className={shoppingStyles.statHint}>In your collection</div>
            </Card>
            <Card
              padding="md"
              hover
              className={shoppingStyles.statCard}
            >
              <div className={shoppingStyles.statLabel}>Already Craftable</div>
              <div className={shoppingStyles.statValue}>{shoppingListStats.craftable}</div>
              <div className={shoppingStyles.statHint}>You can make now</div>
            </Card>
            <Card
              padding="md"
              hover
              className={shoppingStyles.statCard}
            >
              <div className={shoppingStyles.statLabel}>Near Misses</div>
              <div className={shoppingStyles.statValue}>{shoppingListStats.nearMisses}</div>
              <div className={shoppingStyles.statHint}>Missing 1 ingredient</div>
            </Card>
            <Card
              padding="md"
              hover
              className={shoppingStyles.statCard}
            >
              <div className={shoppingStyles.statLabel}>Inventory Items</div>
              <div className={shoppingStyles.statValue}>{shoppingListStats.inventoryItems}</div>
              <div className={shoppingStyles.statHint}>In your bar</div>
            </Card>
          </div>
        )}

        {/* Show Collections List when not viewing a specific collection */}
        {!activeCollection && (
          <>
            {/* Collections Section */}
            {collectionsArray.length > 0 && (
              <>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-heading)', marginBottom: '16px' }}>
                  Collections
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                  {collectionsArray.map((collection) => (
                    <Card
                      key={collection.id}
                      padding="md"
                      style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                      onClick={() => setActiveCollection(collection)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-heading)', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                            <FolderOpen size={24} style={{ marginRight: '10px', color: 'var(--color-primary)' }} />
                            {collection.name}
                          </h3>
                          {collection.description && (
                            <p style={{ fontSize: '14px', color: 'var(--color-text-subtle)', marginBottom: '12px', lineHeight: '1.4' }}>
                              {collection.description}
                            </p>
                          )}
                          <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--color-text-body)' }}>
                            {collection.recipe_count || 0} {collection.recipe_count === 1 ? 'recipe' : 'recipes'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCollection(collection);
                            }}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingCollection(collection);
                              setShowCollectionDeleteConfirm(true);
                            }}
                            style={{ color: 'var(--color-semantic-error)' }}
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {/* Uncategorized Recipes Section */}
            {uncategorizedCount > 0 && (
              <>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-heading)', marginBottom: '16px' }}>
                  Uncategorized Recipes ({uncategorizedCount})
                </h2>
                <div className={styles.controls} style={{ marginBottom: '20px' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllRecipes}
                    style={{ padding: '8px', minWidth: 'auto' }}
                  >
                    {selectedRecipes.size === filteredRecipes.length && filteredRecipes.length > 0 ? (
                      <CheckSquare size={20} />
                    ) : (
                      <Square size={20} />
                    )}
                  </Button>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search uncategorized recipes..."
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

                {/* Bulk Actions Bar */}
                {selectedRecipes.size > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    backgroundColor: 'var(--color-primary)',
                    borderRadius: 'var(--radius)',
                    marginBottom: '20px',
                    color: 'white',
                  }}>
                    <span style={{ fontWeight: 500 }}>
                      {selectedRecipes.size} {selectedRecipes.size === 1 ? 'recipe' : 'recipes'} selected
                    </span>
                    <div style={{ flex: 1 }} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkMoveModal(true)}
                      style={{ backgroundColor: 'white', color: 'var(--color-text-body)' }}
                    >
                      <FolderOpen size={16} />
                      Move to Collection
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      style={{ backgroundColor: 'white', color: 'var(--color-semantic-error)' }}
                    >
                      <Trash2 size={16} />
                      Delete Selected
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      style={{ color: 'white' }}
                    >
                      Clear
                    </Button>
                  </div>
                )}

                <div className={styles.recipesGrid}>
                  {filteredRecipes.map((recipe) => (
                    <Card key={recipe.id} padding="md" hover>
                      <div className={styles.recipeCard}>
                        <div className={styles.recipeHeader}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRecipeSelection(recipe.id!);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              marginRight: '8px',
                              color: selectedRecipes.has(recipe.id!) ? 'var(--color-primary)' : 'var(--color-text-subtle)',
                            }}
                          >
                            {selectedRecipes.has(recipe.id!) ? (
                              <CheckSquare size={20} />
                            ) : (
                              <Square size={20} />
                            )}
                          </button>
                          <h3 className={styles.recipeName} style={{ flex: 1 }}>{recipe.name}</h3>
                          <button
                            className={styles.favoriteBtn}
                            onClick={() => handleToggleFavorite(recipe)}
                            aria-label={isFavorited(recipe.id!) ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star
                              size={20}
                              fill={isFavorited(recipe.id!) ? 'currentColor' : 'none'}
                              className={isFavorited(recipe.id!) ? styles.favorited : ''}
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
              </>
            )}

            {/* Empty State - No collections and no recipes */}
            {collectionsArray.length === 0 && uncategorizedCount === 0 && (
              <Card padding="lg">
                <div className={styles.emptyState}>
                  <FolderOpen size={64} className={styles.emptyIcon} strokeWidth={1.5} />
                  <h3 className={styles.emptyTitle}>No recipes yet</h3>
                  <p className={styles.emptyText}>
                    Import recipes via CSV or create collections to organize your cocktail recipes.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <Button variant="outline" onClick={() => setCsvModalOpen(true)}>
                      <Upload size={18} />
                      Import CSV
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setEditingCollection(null);
                        setCollectionModalOpen(true);
                      }}
                    >
                      <Plus size={18} />
                      Create Collection
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Show Recipes when viewing a specific collection */}
        {activeCollection && (
          <>
            {/* Search and Filter */}
            <div className={styles.controls}>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllRecipes}
                style={{ padding: '8px', minWidth: 'auto' }}
              >
                {selectedRecipes.size === filteredRecipes.length && filteredRecipes.length > 0 ? (
                  <CheckSquare size={20} />
                ) : (
                  <Square size={20} />
                )}
              </Button>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipes in this collection..."
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

            {/* Bulk Actions Bar */}
            {selectedRecipes.size > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: 'var(--color-primary)',
                borderRadius: 'var(--radius)',
                marginBottom: '20px',
                color: 'white',
              }}>
                <span style={{ fontWeight: 500 }}>
                  {selectedRecipes.size} {selectedRecipes.size === 1 ? 'recipe' : 'recipes'} selected
                </span>
                <div style={{ flex: 1 }} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkMoveModal(true)}
                  style={{ backgroundColor: 'white', color: 'var(--color-text-body)' }}
                >
                  <FolderOpen size={16} />
                  Move to Collection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  style={{ backgroundColor: 'white', color: 'var(--color-semantic-error)' }}
                >
                  <Trash2 size={16} />
                  Delete Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  style={{ color: 'white' }}
                >
                  Clear
                </Button>
              </div>
            )}

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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRecipeSelection(recipe.id!);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        marginRight: '8px',
                        color: selectedRecipes.has(recipe.id!) ? 'var(--color-primary)' : 'var(--color-text-subtle)',
                      }}
                    >
                      {selectedRecipes.has(recipe.id!) ? (
                        <CheckSquare size={20} />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>
                    <h3 className={styles.recipeName} style={{ flex: 1 }}>{recipe.name}</h3>
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

          </>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className={styles.pagination}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadRecipes(currentPage - 1)}
              disabled={!pagination.hasPreviousPage}
            >
              <ChevronLeft size={18} />
              Previous
            </Button>
            <span className={styles.pageInfo}>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total recipes)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadRecipes(currentPage + 1)}
              disabled={!pagination.hasNextPage}
            >
              Next
              <ChevronRight size={18} />
            </Button>
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

        {/* Delete All Confirmation Modal */}
        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteAll}
          title="Delete All Recipes?"
          message="This will remove every recipe in your library, including those in collections."
          itemName="all recipes"
          warningMessage={`This action cannot be undone and will permanently delete ${totalRecipeCount} ${totalRecipeCount === 1 ? 'recipe' : 'recipes'}.`}
        />

        {/* Collection Modal */}
        <CollectionModal
          isOpen={collectionModalOpen}
          onClose={() => {
            setCollectionModalOpen(false);
            setEditingCollection(null);
          }}
          onSubmit={handleCollectionSubmit}
          collection={editingCollection}
        />

        {/* Delete Collection Confirmation Modal */}
        <DeleteConfirmModal
          isOpen={showCollectionDeleteConfirm}
          onClose={() => {
            setShowCollectionDeleteConfirm(false);
            setDeletingCollection(null);
          }}
          onConfirm={handleDeleteCollection}
          title="Delete Collection?"
          message="Are you sure you want to delete this collection?"
          itemName={deletingCollection?.name || 'collection'}
          warningMessage="This will permanently delete this collection. Recipes in this collection will not be deleted, but will no longer be associated with it."
        />

        {/* Bulk Move to Collection Modal */}
        {showBulkMoveModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => {
              setShowBulkMoveModal(false);
              setBulkMoveCollectionId(null);
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--color-ui-bg-main)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                maxWidth: '400px',
                width: '90%',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-heading)' }}>
                Move {selectedRecipes.size} {selectedRecipes.size === 1 ? 'Recipe' : 'Recipes'}
              </h3>
              <select
                value={bulkMoveCollectionId ?? ''}
                onChange={(e) => setBulkMoveCollectionId(e.target.value ? parseInt(e.target.value, 10) : null)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-body)',
                  backgroundColor: 'var(--color-ui-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  marginBottom: '20px',
                }}
              >
                <option value="">Uncategorized (No Collection)</option>
                {collectionsArray.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBulkMoveModal(false);
                    setBulkMoveCollectionId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleBulkMove}>
                  Move Recipes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
