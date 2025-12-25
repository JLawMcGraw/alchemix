'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, FlaskConical } from 'lucide-react';
import { CSVUploadModal, RecipeDetailModal, DeleteConfirmModal, CollectionModal, AddRecipeModal } from '@/components/modals';
import styles from './recipes.module.css';

// Local components
import { BulkMoveModal } from './BulkMoveModal';
import { useRecipesPage } from './useRecipesPage';
import { MasteryFilterBar, TabBar, SearchControls } from './RecipeFilters';
import {
  RecipeGrid,
  PaginationControls,
  LoadingState,
  EmptyState,
  CollectionsEmptyState,
  CollectionsGrid,
} from './RecipeGrid';
import { PageHeader, BulkActionsBar, UncategorizedSectionHeader } from './RecipeActions';

function RecipesPageContent() {
  const router = useRouter();
  const state = useRecipesPage();
  const [showTip, setShowTip] = useState(false);

  // Check if tip should be shown (first time user)
  useEffect(() => {
    const tipSeen = localStorage.getItem('alchemix-recipes-tip-seen');
    if (!tipSeen) {
      setShowTip(true);
    }
  }, []);

  const dismissTip = () => {
    localStorage.setItem('alchemix-recipes-tip-seen', 'true');
    setShowTip(false);
  };

  if (state.isValidating || !state.isAuthenticated) return null;

  return (
    <div className={styles.recipesPage}>
      <div className={styles.container}>
        {/* Header */}
        <PageHeader
          totalCount={state.totalRecipeCount}
          craftableCount={state.craftableCount}
          onImportCSV={() => state.setCsvModalOpen(true)}
          onNewRecipe={() => state.setAddRecipeModalOpen(true)}
        />

        {/* Mastery Filter Pills */}
        <MasteryFilterBar
          masteryFilter={state.masteryFilter}
          shoppingListStats={state.shoppingListStats}
          onFilterClick={state.handleMasteryFilterClick}
          onClear={() => router.push('/recipes')}
        />

        {/* Tabs */}
        <TabBar
          activeTab={state.activeTab}
          masteryFilter={state.masteryFilter}
          activeCollection={state.activeCollection}
          favoritesCount={state.favoritesCount}
          onTabChange={state.handleTabChange}
          onCloseCollection={state.handleBackFromCollection}
        />

        {/* First-time user tip card */}
        {showTip && (
          <div className={styles.tipCard}>
            <FlaskConical size={20} className={styles.tipIcon} />
            <p className={styles.tipText}>
              Each recipe shows its chemical composition as a molecular diagram. Click any recipe to see the full breakdown.
            </p>
            <button 
              className={styles.tipClose} 
              onClick={dismissTip}
              aria-label="Dismiss tip"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Collections View */}
        {state.activeTab === 'collections' && !state.activeCollection && !state.masteryFilter && (
          <>
            <CollectionsGrid
              collections={state.collectionsArray}
              onCollectionClick={state.handleCollectionSelect}
              onNewCollectionClick={() => {
                state.setEditingCollection(null);
                state.setCollectionModalOpen(true);
              }}
              onEditCollection={(collection) => {
                state.setEditingCollection(collection);
                state.setCollectionModalOpen(true);
              }}
              onDeleteCollection={(collection) => {
                state.setDeletingCollection(collection);
                state.setShowCollectionDeleteConfirm(true);
              }}
            />

            {/* Uncategorized Section */}
            {state.uncategorizedCount > 0 && (
              <div className={styles.sectionDivider}>
                <UncategorizedSectionHeader
                  count={state.uncategorizedCount}
                  onSelectAll={state.selectAllUncategorized}
                />
                <SearchControls
                  searchQuery={state.searchQuery}
                  filterSpirit={state.filterSpirit}
                  spiritTypes={state.spiritTypes}
                  placeholder="Search uncategorized..."
                  onSearchChange={state.setSearchQuery}
                  onSpiritChange={state.setFilterSpirit}
                />
                <RecipeGrid
                  recipes={state.paginatedUncategorizedRecipes}
                  selectedRecipes={state.selectedRecipes}
                  isFavorited={state.isFavorited}
                  isRecipeCraftable={state.isRecipeCraftable}
                  onSelectRecipe={state.setSelectedRecipe}
                  onToggleSelection={state.toggleRecipeSelection}
                  onToggleFavorite={state.handleToggleFavorite}
                />
                <PaginationControls
                  currentPage={state.uncategorizedPage}
                  totalPages={state.uncategorizedTotalPages}
                  hasPrevious={state.uncategorizedPage > 1}
                  hasNext={state.uncategorizedPage < state.uncategorizedTotalPages}
                  onPrevious={() => state.setUncategorizedPage(state.uncategorizedPage - 1)}
                  onNext={() => state.setUncategorizedPage(state.uncategorizedPage + 1)}
                />
              </div>
            )}

            {/* Loading State */}
            {state.isLoadingRecipes && !state.hasInitiallyLoaded && (
              <LoadingState />
            )}

            {/* Empty State */}
            {state.collectionsArray.length === 0 && state.uncategorizedCount === 0 && state.hasInitiallyLoaded && (
              <CollectionsEmptyState
                onImportCSV={() => state.setCsvModalOpen(true)}
                onCreateCollection={() => state.setCollectionModalOpen(true)}
              />
            )}
          </>
        )}

        {/* Collection Detail View */}
        {state.activeTab === 'collections' && state.activeCollection && !state.masteryFilter && (
          <>
            <SearchControls
              searchQuery={state.searchQuery}
              filterSpirit={state.filterSpirit}
              spiritTypes={state.spiritTypes}
              placeholder="Search in collection..."
              showBackButton
              onSearchChange={state.setSearchQuery}
              onSpiritChange={state.setFilterSpirit}
              onBack={state.handleBackFromCollection}
            />
            <RecipeGrid
              recipes={state.displayedRecipes}
              selectedRecipes={state.selectedRecipes}
              isFavorited={state.isFavorited}
              isRecipeCraftable={state.isRecipeCraftable}
              onSelectRecipe={state.setSelectedRecipe}
              onToggleSelection={state.toggleRecipeSelection}
              onToggleFavorite={state.handleToggleFavorite}
            />
            <PaginationControls
              currentPage={state.collectionPage}
              totalPages={state.collectionTotalPages}
              hasPrevious={state.collectionPage > 1}
              hasNext={state.collectionPage < state.collectionTotalPages}
              onPrevious={() => state.setCollectionPage(p => Math.max(1, p - 1))}
              onNext={() => state.setCollectionPage(p => Math.min(state.collectionTotalPages, p + 1))}
            />
          </>
        )}

        {/* All Recipes View */}
        {(state.activeTab === 'all' || state.masteryFilter) && !state.activeCollection && (
          <>
            <SearchControls
              searchQuery={state.searchQuery}
              filterSpirit={state.filterSpirit}
              spiritTypes={state.spiritTypes}
              placeholder="Search all recipes..."
              showCount
              count={state.filteredRecipes.length}
              onSearchChange={state.setSearchQuery}
              onSpiritChange={state.setFilterSpirit}
            />

            {state.isLoadingRecipes && !state.hasInitiallyLoaded ? (
              <LoadingState />
            ) : state.filteredRecipes.length === 0 ? (
              <EmptyState
                hasFilters={!!state.searchQuery || state.filterSpirit !== 'all'}
                onImportCSV={() => state.setCsvModalOpen(true)}
                onCreateCollection={() => state.setCollectionModalOpen(true)}
              />
            ) : (
              <RecipeGrid
                recipes={state.filteredRecipes}
                selectedRecipes={state.selectedRecipes}
                isFavorited={state.isFavorited}
                isRecipeCraftable={state.isRecipeCraftable}
                onSelectRecipe={state.setSelectedRecipe}
                onToggleSelection={state.toggleRecipeSelection}
                onToggleFavorite={state.handleToggleFavorite}
              />
            )}

            {!state.masteryFilter && (
              <PaginationControls
                currentPage={state.pagination.page}
                totalPages={state.pagination.totalPages}
                hasPrevious={state.pagination.hasPreviousPage}
                hasNext={state.pagination.hasNextPage}
                onPrevious={() => state.loadRecipes(state.currentPage - 1)}
                onNext={() => state.loadRecipes(state.currentPage + 1)}
              />
            )}
          </>
        )}

        {/* Favorites View */}
        {state.activeTab === 'favorites' && !state.masteryFilter && (
          <>
            <SearchControls
              searchQuery={state.searchQuery}
              filterSpirit={state.filterSpirit}
              spiritTypes={state.spiritTypes}
              placeholder="Search favorites..."
              showCount
              count={state.filteredFavoriteRecipes.length}
              onSearchChange={state.setSearchQuery}
              onSpiritChange={state.setFilterSpirit}
            />

            {state.filteredFavoriteRecipes.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>★</div>
                <h3 className={styles.emptyTitle}>
                  {state.favoriteRecipes.length === 0 ? 'No favorites yet' : 'No matching favorites'}
                </h3>
                <p className={styles.emptyText}>
                  {state.favoriteRecipes.length === 0
                    ? 'Star recipes to save them here for quick access'
                    : 'Try adjusting your search or filters'}
                </p>
              </div>
            ) : (
              <RecipeGrid
                recipes={state.filteredFavoriteRecipes}
                selectedRecipes={state.selectedRecipes}
                isFavorited={state.isFavorited}
                isRecipeCraftable={state.isRecipeCraftable}
                onSelectRecipe={state.setSelectedRecipe}
                onToggleSelection={state.toggleRecipeSelection}
                onToggleFavorite={state.handleToggleFavorite}
              />
            )}
          </>
        )}

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={state.selectedRecipes.size}
          onMove={() => state.setShowBulkMoveModal(true)}
          onDelete={state.handleBulkDelete}
          onClear={state.clearSelection}
        />

        {/* Modals */}
        <AddRecipeModal
          isOpen={state.addRecipeModalOpen}
          onClose={() => state.setAddRecipeModalOpen(false)}
          onAdd={state.handleAddRecipe}
          collections={state.collectionsArray}
        />

        <CSVUploadModal
          isOpen={state.csvModalOpen}
          onClose={() => state.setCsvModalOpen(false)}
          type="recipes"
          onUpload={state.handleCSVUpload}
        />

        <RecipeDetailModal
          isOpen={!!state.selectedRecipe}
          onClose={() => state.setSelectedRecipe(null)}
          recipe={state.selectedRecipe}
          isFavorited={state.selectedRecipe ? state.isFavorited(state.selectedRecipe.id!) : false}
          onToggleFavorite={() => { if (state.selectedRecipe) state.handleToggleFavorite(state.selectedRecipe); }}
          onRecipeUpdated={(updatedRecipe) => state.setSelectedRecipe(updatedRecipe)}
        />

        <DeleteConfirmModal
          isOpen={state.showDeleteConfirm}
          onClose={() => state.setShowDeleteConfirm(false)}
          onConfirm={state.handleDeleteAll}
          title="Delete All Recipes?"
          message="This will remove every recipe in your library."
          itemName="all recipes"
          warningMessage={`This action cannot be undone and will permanently delete ${state.totalRecipeCount} recipes.`}
        />

        <CollectionModal
          isOpen={state.collectionModalOpen}
          onClose={() => { state.setCollectionModalOpen(false); state.setEditingCollection(null); }}
          onSubmit={state.handleCollectionSubmit}
          collection={state.editingCollection}
        />

        <DeleteConfirmModal
          isOpen={state.showCollectionDeleteConfirm}
          onClose={() => { state.setShowCollectionDeleteConfirm(false); state.setDeletingCollection(null); }}
          onConfirm={state.handleDeleteCollection}
          title="Delete Collection?"
          message="Are you sure you want to delete this collection?"
          itemName={state.deletingCollection?.name || 'collection'}
          warningMessage="This action cannot be undone."
          checkboxOption={{
            label: 'Also delete all recipes in this collection',
            description: 'Unchecked: recipes will become uncategorized',
          }}
        />

        <BulkMoveModal
          isOpen={state.showBulkMoveModal}
          selectedCount={state.selectedRecipes.size}
          collections={state.collectionsArray}
          selectedCollectionId={state.bulkMoveCollectionId}
          onCollectionChange={state.setBulkMoveCollectionId}
          onClose={() => { state.setShowBulkMoveModal(false); state.setBulkMoveCollectionId(null); }}
          onConfirm={state.handleBulkMove}
          onCreateAndMove={state.handleCreateAndMove}
        />
      </div>
    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading recipes..." />}>
      <RecipesPageContent />
    </Suspense>
  );
}
