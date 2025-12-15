'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useToast } from '@/components/ui';
import { recipeApi } from '@/lib/api';
import type { Recipe, Collection } from '@/types';
import type { SpiritCategory } from '@/lib/spirits';
import {
  getIngredientSpirits,
  parseIngredients,
  getAvailableSpiritTypes,
  COLLECTION_PAGE_SIZE,
} from './recipeUtils';

export interface RecipesPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function useRecipesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    recipes,
    favorites,
    collections,
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
    isLoadingRecipes,
    fetchShoppingList,
    fetchItems,
  } = useStore();
  const { showToast } = useToast();
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

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
  const [pagination, setPagination] = useState<RecipesPagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [lastLoadedParams, setLastLoadedParams] = useState<{ filter: string | null; collection: string | null } | null>(null);

  // Load recipes
  const loadRecipes = useCallback(async (page: number = 1, loadAll: boolean = false) => {
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
    } finally {
      setHasInitiallyLoaded(true);
    }
  }, []);

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
  }, [searchParams, collections, isAuthenticated, isValidating, lastLoadedParams, loadRecipes]);

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

  // Spirit types for filter dropdown
  const spiritTypes = useMemo(() => getAvailableSpiritTypes(recipesArray), [recipesArray]);

  // Check if recipe is craftable
  const isRecipeCraftable = useCallback((recipe: Recipe): boolean => {
    return craftableRecipes.some(c => c.id === recipe.id || c.name === recipe.name);
  }, [craftableRecipes]);

  // Filter recipes
  const filteredRecipes = useMemo(() => {
    return recipesArray.filter((recipe) => {
      const ingredientsArray = parseIngredients(recipe.ingredients);
      const ingredientsText = ingredientsArray.join(' ').toLowerCase();

      const matchesSearch = searchQuery
        ? recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ingredientsText.includes(searchQuery.toLowerCase())
        : true;

      const recipeSpirits = getIngredientSpirits(ingredientsArray);
      const matchesSpirit =
        filterSpirit === 'all' ||
        recipeSpirits.includes(filterSpirit);

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

      const matchesCollection = activeCollection
        ? recipe.collection_id === activeCollection.id
        : activeTab === 'all' ? true : !recipe.collection_id;

      return matchesSearch && matchesSpirit && matchesCollection;
    });
  }, [recipesArray, searchQuery, filterSpirit, masteryFilter, activeCollection, activeTab, craftableRecipes, nearMissRecipes, needFewRecipes, majorGapsRecipes]);

  // Pagination for collection view
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

  // Counts
  const uncategorizedCount = recipesArray.filter((r) => !r.collection_id).length;
  const totalRecipeCount = pagination.total || recipesArray.length;
  const craftableCount = shoppingListStats?.craftable || 0;

  const isFavorited = useCallback((recipeId: number) => {
    return favoritesArray.some((fav) => fav.recipe_id === recipeId);
  }, [favoritesArray]);

  // Handlers
  const handleAddRecipe = useCallback(async (recipe: Omit<Recipe, 'id' | 'user_id' | 'created_at'>) => {
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
  }, [addRecipe, loadRecipes, fetchCollections, fetchShoppingList, showToast]);

  const handleCSVUpload = useCallback(async (file: File, collectionId?: number) => {
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
  }, [loadRecipes, fetchCollections, fetchShoppingList, showToast]);

  const handleToggleFavorite = useCallback(async (recipe: Recipe) => {
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
  }, [favoritesArray, removeFavorite, addFavorite, showToast]);

  const handleDeleteAll = useCallback(async () => {
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
  }, [loadRecipes, fetchCollections, fetchShoppingList, showToast]);

  const handleCollectionSubmit = useCallback(async (collection: Collection) => {
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
  }, [editingCollection, updateCollection, addCollection, fetchCollections, showToast]);

  const handleDeleteCollection = useCallback(async (options?: { deleteRelated?: boolean }) => {
    if (!deletingCollection || !deletingCollection.id) return;
    try {
      const result = await deleteCollection(deletingCollection.id, { deleteRecipes: options?.deleteRelated });
      if (options?.deleteRelated && result.recipesDeleted) {
        showToast('success', `Collection and ${result.recipesDeleted} recipe(s) deleted successfully`);
      } else {
        showToast('success', 'Collection deleted successfully');
      }
      setShowCollectionDeleteConfirm(false);
      setDeletingCollection(null);
      await fetchCollections();
      await loadRecipes(1);
    } catch (error) {
      showToast('error', 'Failed to delete collection');
    }
  }, [deletingCollection, deleteCollection, fetchCollections, loadRecipes, showToast]);

  // Bulk selection
  const toggleRecipeSelection = useCallback((recipeId: number) => {
    setSelectedRecipes(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(recipeId)) newSelected.delete(recipeId);
      else newSelected.add(recipeId);
      return newSelected;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedRecipes(new Set()), []);

  const handleBulkDelete = useCallback(async () => {
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
  }, [selectedRecipes, bulkDeleteRecipes, loadRecipes, currentPage, fetchCollections, fetchShoppingList, showToast]);

  const handleBulkMove = useCallback(async () => {
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
  }, [selectedRecipes, updateRecipe, bulkMoveCollectionId, loadRecipes, fetchCollections, collectionsArray, showToast]);

  const handleMasteryFilterClick = useCallback((filterKey: string) => {
    if (masteryFilter === filterKey) {
      setMasteryFilter(null);
      router.push('/recipes');
    } else {
      router.push(`/recipes?filter=${filterKey}`);
    }
  }, [masteryFilter, router]);

  const handleTabChange = useCallback((tab: 'collections' | 'all') => {
    setActiveTab(tab);
    setActiveCollection(null);
    setMasteryFilter(null);
    if (tab === 'collections') {
      router.push('/recipes');
    } else {
      loadRecipes(1, true);
    }
  }, [router, loadRecipes]);

  const handleCollectionSelect = useCallback((collection: Collection) => {
    setActiveCollection(collection);
    setCollectionPage(1);
    router.push(`/recipes?collection=${collection.id}`);
  }, [router]);

  const handleBackFromCollection = useCallback(() => {
    setActiveCollection(null);
    router.push('/recipes');
  }, [router]);

  return {
    // Auth state
    isValidating,
    isAuthenticated,

    // Data
    recipesArray,
    favoritesArray,
    collectionsArray,
    filteredRecipes,
    displayedRecipes,
    spiritTypes,

    // UI state
    activeTab,
    searchQuery,
    filterSpirit,
    masteryFilter,
    csvModalOpen,
    addRecipeModalOpen,
    selectedRecipe,
    showDeleteConfirm,
    collectionModalOpen,
    editingCollection,
    showCollectionDeleteConfirm,
    deletingCollection,
    activeCollection,
    selectedRecipes,
    showBulkMoveModal,
    bulkMoveCollectionId,
    hasInitiallyLoaded,
    isLoadingRecipes,

    // Pagination
    currentPage,
    collectionPage,
    pagination,
    collectionTotalPages,

    // Counts
    uncategorizedCount,
    totalRecipeCount,
    craftableCount,
    shoppingListStats,

    // Setters
    setSearchQuery,
    setFilterSpirit,
    setCsvModalOpen,
    setAddRecipeModalOpen,
    setSelectedRecipe,
    setShowDeleteConfirm,
    setCollectionModalOpen,
    setEditingCollection,
    setShowCollectionDeleteConfirm,
    setDeletingCollection,
    setShowBulkMoveModal,
    setBulkMoveCollectionId,
    setCollectionPage,

    // Handlers
    loadRecipes,
    handleAddRecipe,
    handleCSVUpload,
    handleToggleFavorite,
    handleDeleteAll,
    handleCollectionSubmit,
    handleDeleteCollection,
    handleBulkDelete,
    handleBulkMove,
    handleMasteryFilterClick,
    handleTabChange,
    handleCollectionSelect,
    handleBackFromCollection,
    toggleRecipeSelection,
    clearSelection,
    isFavorited,
    isRecipeCraftable,
  };
}
