'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Button, useToast, Spinner } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { Search, ChevronLeft, ChevronRight, FolderOpen, Plus, Martini, Upload } from 'lucide-react';
import { CSVUploadModal, RecipeDetailModal, DeleteConfirmModal, CollectionModal, AddRecipeModal } from '@/components/modals';
import { RecipeCard } from '@/components/RecipeCard';
import { recipeApi } from '@/lib/api';
import type { Recipe, Collection } from '@/types';
import { matchesSpiritCategory, SpiritCategory } from '@/lib/spirits';
import styles from './recipes.module.css';

// Spirit keywords for ingredient detection (used for filter dropdown)
const SPIRIT_KEYWORDS: Record<string, string[]> = {
  'Gin': ['gin', 'london dry', 'plymouth', 'navy strength', 'sloe gin'],
  'Whiskey': ['whiskey', 'whisky', 'bourbon', 'rye', 'scotch', 'irish whiskey', 'japanese whisky'],
  'Tequila': ['tequila', 'mezcal', 'blanco', 'reposado', 'anejo'],
  'Rum': ['rum', 'rhum', 'white rum', 'dark rum', 'spiced rum', 'cachaca', 'agricole'],
  'Vodka': ['vodka'],
  'Brandy': ['brandy', 'cognac', 'armagnac', 'pisco', 'calvados', 'grappa'],
  'Liqueur': ['liqueur', 'amaretto', 'cointreau', 'triple sec', 'curacao', 'chartreuse', 'benedictine', 'campari', 'aperol', 'kahlua', 'baileys', 'frangelico', 'maraschino', 'absinthe', 'st germain', 'grand marnier', 'drambuie', 'midori', 'galliano', 'sambuca', 'limoncello'],
};

// Get spirit types from ingredients (used for filter dropdown)
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

// Mastery filter configuration
const MASTERY_FILTERS = [
  { key: 'craftable', label: 'Craftable', color: '#10B981', filter: 'craftable' },
  { key: 'near-miss', label: 'Near Miss', color: '#0EA5E9', filter: 'almost' },
  { key: '2-3-away', label: '2-3 Away', color: '#F59E0B', filter: 'need-few' },
  { key: 'major-gaps', label: 'Major Gaps', color: '#94A3B8', filter: 'major-gaps' },
];

function RecipesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    recipes,
    favorites,
    collections,
    fetchRecipes,
    fetchFavorites,
    fetchCollections,
    addRecipe,
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
    needFewRecipes,
    majorGapsRecipes,
    isLoadingShoppingList,
    fetchShoppingList,
    fetchItems,
  } = useStore();
  const { showToast } = useToast();

  // State
  const [activeTab, setActiveTab] = useState<'collections' | 'all'>('collections');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpirit, setFilterSpirit] = useState<SpiritCategory | 'all'>('all');
  const [masteryFilter, setMasteryFilter] = useState<string | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [addRecipeModalOpen, setAddRecipeModalOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [showCollectionDeleteConfirm, setShowCollectionDeleteConfirm] = useState(false);
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null);
  const [activeCollection, setActiveCollection] = useState<Collection | null>(null);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveCollectionId, setBulkMoveCollectionId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [collectionPage, setCollectionPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [lastLoadedParams, setLastLoadedParams] = useState<{ filter: string | null; collection: string | null } | null>(null);

  // Load recipes
  const loadRecipes = async (page: number = 1, loadAll: boolean = false) => {
    try {
      if (loadAll) {
        const firstResult = await recipeApi.getAll(1, 100);
        let allRecipes = [...firstResult.recipes];
        const totalPages = firstResult.pagination.totalPages;
        for (let p = 2; p <= totalPages; p++) {
          const pageResult = await recipeApi.getAll(p, 100);
          allRecipes = [...allRecipes, ...pageResult.recipes];
        }
        useStore.setState({ recipes: allRecipes });
        setPagination({
          page: 1,
          limit: allRecipes.length,
          total: allRecipes.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        });
        setCurrentPage(1);
      } else {
        const result = await recipeApi.getAll(page, 50);
        useStore.setState({ recipes: result.recipes });
        setPagination(result.pagination);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
    }
  };

  // Handle URL parameters
  useEffect(() => {
    if (!isAuthenticated || isValidating) return;

    const filter = searchParams.get('filter');
    const collectionId = searchParams.get('collection');

    const paramsChanged = !lastLoadedParams ||
      lastLoadedParams.filter !== filter ||
      lastLoadedParams.collection !== collectionId;

    if (!paramsChanged) return;
    setLastLoadedParams({ filter, collection: collectionId });

    if (filter) {
      setMasteryFilter(filter);
      setActiveCollection(null);
      setActiveTab('all');
      loadRecipes(1, true);
    } else if (collectionId && collections.length > 0) {
      const collectionsArr = Array.isArray(collections) ? collections : [];
      const collection = collectionsArr.find(c => c.id === parseInt(collectionId));
      if (collection) {
        setActiveCollection(collection);
        setActiveTab('collections');
        setMasteryFilter(null);
        loadRecipes(1, true);
      }
    } else {
      setMasteryFilter(null);
      setActiveCollection(null);
      loadRecipes(1, false);
    }
  }, [searchParams, collections, isAuthenticated, isValidating, lastLoadedParams]);

  // Fetch initial data
  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchFavorites().catch(console.error);
      fetchCollections().catch(console.error);
      fetchShoppingList().catch(console.error);
      fetchItems().catch(console.error);
    }
  }, [isAuthenticated, isValidating, fetchFavorites, fetchCollections, fetchShoppingList, fetchItems]);

  // Ensure arrays
  const recipesArray = Array.isArray(recipes) ? recipes : [];
  const favoritesArray = Array.isArray(favorites) ? favorites : [];
  const collectionsArray = Array.isArray(collections) ? collections : [];

  // Parse ingredients helper
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

  // Spirit types for filter dropdown
  const spiritTypes: Array<SpiritCategory | 'all'> = useMemo(() => {
    const allSpirits = new Set<SpiritCategory>();
    recipesArray.forEach((r) => {
      const ingredients = parseIngredients(r.ingredients);
      const spirits = getIngredientSpirits(ingredients);
      spirits.forEach(s => allSpirits.add(s as SpiritCategory));
    });
    return ['all', ...Array.from(allSpirits)];
  }, [recipesArray]);

  // Check if recipe is craftable
  const isRecipeCraftable = (recipe: Recipe): boolean => {
    return craftableRecipes.some(c => c.id === recipe.id || c.name === recipe.name);
  };

  // Filter recipes
  const filteredRecipes = useMemo(() => {
    return recipesArray.filter((recipe) => {
      const ingredientsArray = parseIngredients(recipe.ingredients);
      const ingredientsText = ingredientsArray.join(' ').toLowerCase();

      const matchesSearch = searchQuery
        ? recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ingredientsText.includes(searchQuery.toLowerCase())
        : true;
      const matchesSpirit =
        filterSpirit === 'all' ||
        matchesSpiritCategory(recipe.spirit_type, filterSpirit as SpiritCategory);

      // Apply mastery filter
      if (masteryFilter) {
        const matchesList = (list: Array<{ id?: number; name: string }> = []) => {
          return list.some(entry => {
            if (recipe.id && entry.id) return entry.id === recipe.id;
            return entry.name === recipe.name;
          });
        };

        switch (masteryFilter) {
          case 'craftable':
            return matchesSearch && matchesSpirit && matchesList(craftableRecipes);
          case 'almost':
            return matchesSearch && matchesSpirit && matchesList(nearMissRecipes);
          case 'need-few':
            return matchesSearch && matchesSpirit && matchesList(needFewRecipes);
          case 'major-gaps':
            return matchesSearch && matchesSpirit && matchesList(majorGapsRecipes);
        }
      }

      // Collection filter
      const matchesCollection = activeCollection
        ? recipe.collection_id === activeCollection.id
        : activeTab === 'all' ? true : !recipe.collection_id;

      return matchesSearch && matchesSpirit && matchesCollection;
    });
  }, [recipesArray, searchQuery, filterSpirit, masteryFilter, activeCollection, activeTab, craftableRecipes, nearMissRecipes, needFewRecipes, majorGapsRecipes]);

  // Pagination for collection view
  const COLLECTION_PAGE_SIZE = 24;
  const collectionTotalPages = activeCollection
    ? Math.max(1, Math.ceil(filteredRecipes.length / COLLECTION_PAGE_SIZE))
    : 1;
  const paginatedRecipes = activeCollection
    ? filteredRecipes.slice((collectionPage - 1) * COLLECTION_PAGE_SIZE, collectionPage * COLLECTION_PAGE_SIZE)
    : filteredRecipes;
  const displayedRecipes = paginatedRecipes;

  useEffect(() => {
    if (!activeCollection) {
      setCollectionPage(1);
      return;
    }
    if (collectionPage > collectionTotalPages) {
      setCollectionPage(collectionTotalPages);
    }
  }, [activeCollection, filteredRecipes.length, collectionPage, collectionTotalPages]);

  useEffect(() => {
    if (activeCollection) setCollectionPage(1);
  }, [searchQuery, filterSpirit, activeCollection]);

  if (isValidating || !isAuthenticated) return null;

  // Counts
  const uncategorizedCount = recipesArray.filter((r) => !r.collection_id).length;
  const totalRecipeCount = pagination.total || recipesArray.length;
  const craftableCount = shoppingListStats?.craftable || 0;

  const isFavorited = (recipeId: number) => favoritesArray.some((fav) => fav.recipe_id === recipeId);

  // Handlers
  const handleAddRecipe = async (recipe: Omit<Recipe, 'id' | 'user_id' | 'created_at'>) => {
    try {
      await addRecipe(recipe);
      await loadRecipes(1);
      if (recipe.collection_id) await fetchCollections();
      await fetchShoppingList();
      showToast('success', 'Recipe added successfully');
    } catch (error) {
      showToast('error', 'Failed to add recipe');
      throw error;
    }
  };

  const handleCSVUpload = async (file: File, collectionId?: number) => {
    try {
      const result = await recipeApi.importCSV(file, collectionId);
      await loadRecipes(1);
      if (collectionId) await fetchCollections();
      await fetchShoppingList();
      if (result.imported > 0) {
        showToast('success', result.failed > 0
          ? `Imported ${result.imported} recipes. ${result.failed} failed.`
          : `Successfully imported ${result.imported} recipes`);
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
    }
  };

  const handleDeleteAll = async () => {
    try {
      const result = await recipeApi.deleteAll();
      await loadRecipes(1);
      await fetchCollections();
      await fetchShoppingList();
      setSelectedRecipes(new Set());
      showToast('success', result.message);
      setShowDeleteConfirm(false);
    } catch (error) {
      showToast('error', 'Failed to delete recipes');
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
      throw error;
    }
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
    }
  };

  // Bulk selection
  const toggleRecipeSelection = (recipeId: number) => {
    const newSelected = new Set(selectedRecipes);
    if (newSelected.has(recipeId)) newSelected.delete(recipeId);
    else newSelected.add(recipeId);
    setSelectedRecipes(newSelected);
  };

  const clearSelection = () => setSelectedRecipes(new Set());

  const handleBulkDelete = async () => {
    if (selectedRecipes.size === 0) return;
    if (!confirm(`Delete ${selectedRecipes.size} recipe(s)? This cannot be undone.`)) return;
    try {
      const ids = Array.from(selectedRecipes);
      const deleted = await bulkDeleteRecipes(ids);
      await loadRecipes(currentPage);
      await fetchCollections();
      await fetchShoppingList();
      setSelectedRecipes(new Set());
      showToast('success', `Deleted ${deleted} recipe(s)`);
    } catch (error) {
      showToast('error', 'Failed to delete recipes');
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
      showToast('success', `Moved ${moved} recipe(s) to ${collectionName}`);
    } catch (error) {
      showToast('error', 'Failed to move some recipes');
    }
  };

  const handleMasteryFilterClick = (filterKey: string) => {
    if (masteryFilter === filterKey) {
      setMasteryFilter(null);
      router.push('/recipes');
    } else {
      router.push(`/recipes?filter=${filterKey}`);
    }
  };

  // Get mastery counts
  const getMasteryCount = (key: string): number => {
    switch (key) {
      case 'craftable': return shoppingListStats?.craftable || 0;
      case 'near-miss': return shoppingListStats?.nearMisses || 0;
      case '2-3-away': return shoppingListStats?.missing2to3 || 0;
      case 'major-gaps': return shoppingListStats?.missing4plus || 0;
      default: return 0;
    }
  };

  return (
    <div className={styles.recipesPage}>
      <div className={styles.container}>
        {/* ===== HEADER ===== */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Recipes</h1>
            <p className={styles.subtitle}>
              {totalRecipeCount} total · <span className={styles.subtitleHighlight}>{craftableCount} craftable tonight</span>
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
              onClick={() => setCsvModalOpen(true)}
            >
              Import CSV
            </button>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => setAddRecipeModalOpen(true)}
            >
              + New Recipe
            </button>
          </div>
        </div>

        {/* ===== MASTERY FILTER PILLS ===== */}
        <div className={styles.filterBar}>
          <span className={styles.filterLabel}>Filter:</span>
          {MASTERY_FILTERS.map((stat) => {
            const isActive = masteryFilter === stat.filter;
            const count = getMasteryCount(stat.key);
            return (
              <button
                key={stat.key}
                onClick={() => handleMasteryFilterClick(stat.filter)}
                className={`${styles.masteryPill} ${isActive ? styles.active : ''}`}
              >
                <div className={styles.masteryDot} style={{ backgroundColor: stat.color }} />
                <span>{stat.label}</span>
                <span
                  className={styles.pillCount}
                  style={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : `${stat.color}15`,
                    color: isActive ? 'white' : stat.color
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {masteryFilter && (
            <button className={styles.clearFilterBtn} onClick={() => router.push('/recipes')}>
              Clear
            </button>
          )}
        </div>

        {/* ===== TABS ===== */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tab} ${activeTab === 'collections' && !masteryFilter ? styles.active : ''}`}
            onClick={() => {
              setActiveTab('collections');
              setActiveCollection(null);
              setMasteryFilter(null);
              router.push('/recipes');
            }}
          >
            Collections
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'all' || masteryFilter ? styles.active : ''}`}
            onClick={() => {
              setActiveTab('all');
              setActiveCollection(null);
              if (!masteryFilter) loadRecipes(1, true);
            }}
          >
            All Recipes
          </button>
          {activeCollection && (
            <>
              <div className={styles.tabSpacer} />
              <div className={styles.activeCollectionIndicator}>
                <span>{activeCollection.name}</span>
                <button
                  className={styles.closeCollectionBtn}
                  onClick={() => {
                    setActiveCollection(null);
                    router.push('/recipes');
                  }}
                >
                  ✕
                </button>
              </div>
            </>
          )}
        </div>

        {/* ===== COLLECTIONS VIEW ===== */}
        {activeTab === 'collections' && !activeCollection && !masteryFilter && (
          <>
            {/* Collection Cards */}
            <div className={styles.collectionsGrid}>
              {collectionsArray.map((collection) => (
                <div
                  key={collection.id}
                  className={styles.collectionCard}
                  onClick={() => {
                    setActiveCollection(collection);
                    setCollectionPage(1);
                    router.push(`/recipes?collection=${collection.id}`);
                  }}
                >
                  <div className={styles.collectionHeader}>
                    <FolderOpen size={20} className={styles.collectionIcon} />
                    <h3 className={styles.collectionName}>{collection.name}</h3>
                  </div>
                  {collection.description && (
                    <p className={styles.collectionDescription}>{collection.description}</p>
                  )}
                  <div>
                    <span className={styles.collectionCount}>
                      {String(collection.recipe_count || 0).padStart(2, '0')}
                    </span>
                    <span className={styles.collectionCountLabel}>recipes</span>
                  </div>
                </div>
              ))}

              {/* New Collection Card */}
              <div
                className={`${styles.collectionCard} ${styles.collectionCardDashed}`}
                onClick={() => {
                  setEditingCollection(null);
                  setCollectionModalOpen(true);
                }}
              >
                <div className={styles.newCollectionIcon}>+</div>
                <span className={styles.newCollectionText}>New Collection</span>
              </div>
            </div>

            {/* Uncategorized Section */}
            {uncategorizedCount > 0 && (
              <div className={styles.sectionDivider}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Uncategorized</h2>
                  <span className={styles.sectionCount}>{uncategorizedCount} recipes</span>
                </div>

                {/* Search */}
                <div className={styles.controls}>
                  <div className={styles.searchWrapper}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search uncategorized..."
                      className={styles.searchInput}
                    />
                  </div>
                  <select
                    value={filterSpirit}
                    onChange={(e) => setFilterSpirit(e.target.value as SpiritCategory | 'all')}
                    className={styles.filterSelect}
                  >
                    {spiritTypes.map((type) => (
                      <option key={type} value={type}>
                        {type === 'all' ? 'All Spirits' : type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Recipe Grid */}
                <div className={styles.recipesGrid}>
                  {filteredRecipes.slice(0, 8).map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      isFavorited={isFavorited(recipe.id!)}
                      isSelected={selectedRecipes.has(recipe.id!)}
                      isCraftable={isRecipeCraftable(recipe)}
                      onSelect={() => setSelectedRecipe(recipe)}
                      onToggleSelection={() => toggleRecipeSelection(recipe.id!)}
                      onToggleFavorite={() => handleToggleFavorite(recipe)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
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
                    <Button variant="primary" onClick={() => setCollectionModalOpen(true)}>
                      <Plus size={18} />
                      Create Collection
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ===== COLLECTION DETAIL VIEW ===== */}
        {activeTab === 'collections' && activeCollection && !masteryFilter && (
          <>
            <div className={styles.controls}>
              <button className={styles.backBtn} onClick={() => { setActiveCollection(null); router.push('/recipes'); }}>
                ← Back
              </button>
              <div className={styles.searchWrapper}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in collection..."
                  className={styles.searchInput}
                />
              </div>
              <select
                value={filterSpirit}
                onChange={(e) => setFilterSpirit(e.target.value as SpiritCategory | 'all')}
                className={styles.filterSelect}
              >
                {spiritTypes.map((type) => (
                  <option key={type} value={type}>{type === 'all' ? 'All Spirits' : type}</option>
                ))}
              </select>
            </div>

            <div className={styles.recipesGrid}>
              {displayedRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isFavorited={isFavorited(recipe.id!)}
                  isSelected={selectedRecipes.has(recipe.id!)}
                  isCraftable={isRecipeCraftable(recipe)}
                  onSelect={() => setSelectedRecipe(recipe)}
                  onToggleSelection={() => toggleRecipeSelection(recipe.id!)}
                  onToggleFavorite={() => handleToggleFavorite(recipe)}
                />
              ))}
            </div>

            {/* Collection pagination */}
            {collectionTotalPages > 1 && (
              <div className={styles.pagination}>
                <Button variant="outline" size="sm" onClick={() => setCollectionPage((p) => Math.max(1, p - 1))} disabled={collectionPage === 1}>
                  <ChevronLeft size={18} /> Previous
                </Button>
                <span className={styles.pageInfo}>
                  Page {collectionPage} of {collectionTotalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setCollectionPage((p) => Math.min(collectionTotalPages, p + 1))} disabled={collectionPage === collectionTotalPages}>
                  Next <ChevronRight size={18} />
                </Button>
              </div>
            )}
          </>
        )}

        {/* ===== ALL RECIPES VIEW ===== */}
        {(activeTab === 'all' || masteryFilter) && !activeCollection && (
          <>
            <div className={styles.controls}>
              <div className={styles.searchWrapper}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search all recipes..."
                  className={styles.searchInput}
                />
              </div>
              <select
                value={filterSpirit}
                onChange={(e) => setFilterSpirit(e.target.value as SpiritCategory | 'all')}
                className={styles.filterSelect}
              >
                {spiritTypes.map((type) => (
                  <option key={type} value={type}>{type === 'all' ? 'All Spirits' : type}</option>
                ))}
              </select>
              <span className={styles.recipeCount}>{filteredRecipes.length} recipes</span>
            </div>

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
                </div>
              </Card>
            ) : (
              <div className={styles.recipesGrid}>
                {filteredRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isFavorited={isFavorited(recipe.id!)}
                    isSelected={selectedRecipes.has(recipe.id!)}
                    isCraftable={isRecipeCraftable(recipe)}
                    onSelect={() => setSelectedRecipe(recipe)}
                    onToggleSelection={() => toggleRecipeSelection(recipe.id!)}
                    onToggleFavorite={() => handleToggleFavorite(recipe)}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && !masteryFilter && (
              <div className={styles.pagination}>
                <Button variant="outline" size="sm" onClick={() => loadRecipes(currentPage - 1)} disabled={!pagination.hasPreviousPage}>
                  <ChevronLeft size={18} /> Previous
                </Button>
                <span className={styles.pageInfo}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => loadRecipes(currentPage + 1)} disabled={!pagination.hasNextPage}>
                  Next <ChevronRight size={18} />
                </Button>
              </div>
            )}
          </>
        )}

        {/* ===== BULK ACTIONS BAR ===== */}
        {selectedRecipes.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selectedRecipes.size} selected</span>
            <div className={styles.bulkDivider} />
            <button className={styles.bulkAction} onClick={() => setShowBulkMoveModal(true)}>
              Move to Collection
            </button>
            <button className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={handleBulkDelete}>
              Delete
            </button>
            <button className={`${styles.bulkAction} ${styles.bulkActionMuted}`} onClick={clearSelection}>
              Clear
            </button>
          </div>
        )}

        {/* ===== MODALS ===== */}
        <AddRecipeModal
          isOpen={addRecipeModalOpen}
          onClose={() => setAddRecipeModalOpen(false)}
          onAdd={handleAddRecipe}
          collections={collectionsArray}
        />

        <CSVUploadModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          type="recipes"
          onUpload={handleCSVUpload}
        />

        <RecipeDetailModal
          isOpen={!!selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          recipe={selectedRecipe}
          isFavorited={selectedRecipe ? isFavorited(selectedRecipe.id!) : false}
          onToggleFavorite={() => { if (selectedRecipe) handleToggleFavorite(selectedRecipe); }}
          onRecipeUpdated={(updatedRecipe) => setSelectedRecipe(updatedRecipe)}
        />

        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteAll}
          title="Delete All Recipes?"
          message="This will remove every recipe in your library."
          itemName="all recipes"
          warningMessage={`This action cannot be undone and will permanently delete ${totalRecipeCount} recipes.`}
        />

        <CollectionModal
          isOpen={collectionModalOpen}
          onClose={() => { setCollectionModalOpen(false); setEditingCollection(null); }}
          onSubmit={handleCollectionSubmit}
          collection={editingCollection}
        />

        <DeleteConfirmModal
          isOpen={showCollectionDeleteConfirm}
          onClose={() => { setShowCollectionDeleteConfirm(false); setDeletingCollection(null); }}
          onConfirm={handleDeleteCollection}
          title="Delete Collection?"
          message="Are you sure you want to delete this collection?"
          itemName={deletingCollection?.name || 'collection'}
          warningMessage="Recipes in this collection will not be deleted."
        />

        {/* Bulk Move Modal */}
        {showBulkMoveModal && (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}
            onClick={() => { setShowBulkMoveModal(false); setBulkMoveCollectionId(null); }}
          >
            <div
              style={{
                backgroundColor: 'white', borderRadius: '2px', padding: '24px',
                maxWidth: '400px', width: '90%', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-body)' }}>
                Move {selectedRecipes.size} Recipe(s)
              </h3>
              <select
                value={bulkMoveCollectionId ?? ''}
                onChange={(e) => setBulkMoveCollectionId(e.target.value ? parseInt(e.target.value, 10) : null)}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '14px',
                  border: '1px solid var(--color-border)', borderRadius: '2px', marginBottom: '20px',
                }}
              >
                <option value="">Uncategorized</option>
                {collectionsArray.map((collection) => (
                  <option key={collection.id} value={collection.id}>{collection.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button variant="outline" onClick={() => { setShowBulkMoveModal(false); setBulkMoveCollectionId(null); }}>
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

export default function RecipesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RecipesPageContent />
    </Suspense>
  );
}
