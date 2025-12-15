'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Martini, FolderOpen, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { RecipeCard } from '@/components/RecipeCard';
import type { Recipe, Collection } from '@/types';
import styles from './recipes.module.css';

interface RecipeGridProps {
  recipes: Recipe[];
  selectedRecipes: Set<number>;
  isFavorited: (recipeId: number) => boolean;
  isRecipeCraftable: (recipe: Recipe) => boolean;
  onSelectRecipe: (recipe: Recipe) => void;
  onToggleSelection: (recipeId: number) => void;
  onToggleFavorite: (recipe: Recipe) => void;
}

export function RecipeGrid({
  recipes,
  selectedRecipes,
  isFavorited,
  isRecipeCraftable,
  onSelectRecipe,
  onToggleSelection,
  onToggleFavorite,
}: RecipeGridProps) {
  return (
    <div className={styles.recipesGrid}>
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          isFavorited={isFavorited(recipe.id!)}
          isSelected={selectedRecipes.has(recipe.id!)}
          isCraftable={isRecipeCraftable(recipe)}
          onSelect={() => onSelectRecipe(recipe)}
          onToggleSelection={() => onToggleSelection(recipe.id!)}
          onToggleFavorite={() => onToggleFavorite(recipe)}
        />
      ))}
    </div>
  );
}

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <div className={styles.pagination}>
      <Button variant="outline" size="sm" onClick={onPrevious} disabled={!hasPrevious}>
        <ChevronLeft size={18} /> Previous
      </Button>
      <span className={styles.pageInfo}>
        Page {currentPage} of {totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>
        Next <ChevronRight size={18} />
      </Button>
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading your recipes...' }: LoadingStateProps) {
  return (
    <Card padding="lg">
      <div className={styles.emptyState}>
        <div className={styles.loadingSpinner} />
        <h3 className={styles.emptyTitle}>{message}</h3>
      </div>
    </Card>
  );
}

interface EmptyStateProps {
  hasFilters: boolean;
  onImportCSV: () => void;
  onCreateCollection: () => void;
}

export function EmptyState({ hasFilters, onImportCSV, onCreateCollection }: EmptyStateProps) {
  return (
    <Card padding="lg">
      <div className={styles.emptyState}>
        <Martini size={64} className={styles.emptyIcon} strokeWidth={1.5} />
        <h3 className={styles.emptyTitle}>No recipes found</h3>
        <p className={styles.emptyText}>
          {hasFilters
            ? 'Try adjusting your search or filters'
            : 'Import your recipe collection to get started'}
        </p>
      </div>
    </Card>
  );
}

interface CollectionsEmptyStateProps {
  onImportCSV: () => void;
  onCreateCollection: () => void;
}

export function CollectionsEmptyState({ onImportCSV, onCreateCollection }: CollectionsEmptyStateProps) {
  return (
    <Card padding="lg">
      <div className={styles.emptyState}>
        <FolderOpen size={64} className={styles.emptyIcon} strokeWidth={1.5} />
        <h3 className={styles.emptyTitle}>No recipes yet</h3>
        <p className={styles.emptyText}>
          Import recipes via CSV or create collections to organize your cocktail recipes.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Button variant="outline" onClick={onImportCSV}>
            <Upload size={18} />
            Import CSV
          </Button>
          <Button variant="primary" onClick={onCreateCollection}>
            <Plus size={18} />
            Create Collection
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface CollectionCardProps {
  collection: Collection;
  onClick: () => void;
}

export function CollectionCard({ collection, onClick }: CollectionCardProps) {
  return (
    <div className={styles.collectionCard} onClick={onClick}>
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
  );
}

interface NewCollectionCardProps {
  onClick: () => void;
}

export function NewCollectionCard({ onClick }: NewCollectionCardProps) {
  return (
    <div
      className={`${styles.collectionCard} ${styles.collectionCardDashed}`}
      onClick={onClick}
    >
      <div className={styles.newCollectionIcon}>+</div>
      <span className={styles.newCollectionText}>New Collection</span>
    </div>
  );
}

interface CollectionsGridProps {
  collections: Collection[];
  onCollectionClick: (collection: Collection) => void;
  onNewCollectionClick: () => void;
}

export function CollectionsGrid({
  collections,
  onCollectionClick,
  onNewCollectionClick,
}: CollectionsGridProps) {
  return (
    <div className={styles.collectionsGrid}>
      {collections.map((collection) => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          onClick={() => onCollectionClick(collection)}
        />
      ))}
      <NewCollectionCard onClick={onNewCollectionClick} />
    </div>
  );
}
