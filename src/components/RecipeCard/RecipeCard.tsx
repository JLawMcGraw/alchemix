'use client';

import React, { memo, useMemo } from 'react';
import { Star, Check } from 'lucide-react';
import type { Recipe } from '@/types';
import { RecipeMolecule } from '@/components/RecipeMolecule';
import { SPIRIT_COLORS, detectSpiritTypes } from '@/lib/colors';
import { parseIngredients } from '@/lib/utils';
import styles from './RecipeCard.module.css';

interface RecipeCardProps {
  recipe: Recipe;
  isFavorited?: boolean;
  isSelected?: boolean;
  isCraftable?: boolean;
  missingIngredients?: string[];
  onSelect?: () => void;
  onToggleSelection?: () => void;
  onToggleFavorite?: () => void;
}

function RecipeCardComponent({
  recipe,
  isFavorited = false,
  isSelected = false,
  isCraftable = false,
  missingIngredients = [],
  onSelect,
  onToggleSelection,
  onToggleFavorite,
}: RecipeCardProps) {
  // Memoize expensive parsing/detection operations
  const ingredients = useMemo(() => parseIngredients(recipe.ingredients), [recipe.ingredients]);
  const spiritTypes = useMemo(() =>
    recipe.spirit_type
      ? [recipe.spirit_type.toLowerCase()]
      : detectSpiritTypes(ingredients),
    [recipe.spirit_type, ingredients]
  );
  const primarySpirit = spiritTypes[0] || 'spirit';

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
      onClick={onSelect}
    >
      {/* Molecular Visualization */}
      <div className={styles.thumbnail}>
        <RecipeMolecule recipe={recipe} size="thumbnail" showLegend={false} />
      </div>

      {/* Card Content */}
      <div className={styles.content}>
        {/* Top Row: Checkbox, Name, Favorite */}
        <div className={styles.topRow}>
          {/* Checkbox */}
          {onToggleSelection && (
            <button
              className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection();
              }}
              aria-label={isSelected ? 'Deselect recipe' : 'Select recipe'}
            >
              {isSelected && <Check size={12} strokeWidth={3} />}
            </button>
          )}

          {/* Name + Formula */}
          <div className={styles.nameSection}>
            <div className={styles.nameRow}>
              {isCraftable && (
                <div className={styles.craftableDot} title="Craftable with your bar" />
              )}
              <h3 className={styles.name}>{recipe.name}</h3>
            </div>
            {recipe.formula && (
              <p className={styles.formula}>{recipe.formula}</p>
            )}
          </div>

          {/* Favorite */}
          {onToggleFavorite && (
            <button
              className={`${styles.favoriteBtn} ${isFavorited ? styles.favoriteBtnActive : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star size={16} fill={isFavorited ? 'currentColor' : 'none'} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Spirit Badges */}
        <div className={styles.badgesRow}>
          {spiritTypes.slice(0, 3).map((spirit) => {
            const color = SPIRIT_COLORS[spirit] || '#64748B';
            return (
              <span
                key={spirit}
                className={styles.spiritBadge}
                style={{
                  color: color,
                  backgroundColor: `${color}12`,
                }}
              >
                {spirit}
              </span>
            );
          })}
        </div>

        {/* Ingredients Preview */}
        <p className={styles.ingredients}>
          {ingredients.slice(0, 3).join(' · ')}
          {ingredients.length > 3 && ' …'}
        </p>

        {/* Missing Ingredients */}
        {!isCraftable && missingIngredients.length > 0 && (
          <div className={styles.missingSection}>
            <span className={styles.missingText}>
              Missing: {missingIngredients.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Memoized RecipeCard component to prevent unnecessary re-renders.
 * Only re-renders when recipe data or interaction state changes.
 */
export const RecipeCard = memo(RecipeCardComponent, (prevProps, nextProps) => {
  // Custom comparison for performance optimization
  return (
    prevProps.recipe.id === nextProps.recipe.id &&
    prevProps.recipe.name === nextProps.recipe.name &&
    prevProps.recipe.ingredients === nextProps.recipe.ingredients &&
    prevProps.recipe.formula === nextProps.recipe.formula &&
    prevProps.isFavorited === nextProps.isFavorited &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isCraftable === nextProps.isCraftable &&
    prevProps.missingIngredients?.length === nextProps.missingIngredients?.length &&
    prevProps.missingIngredients?.join(',') === nextProps.missingIngredients?.join(',')
  );
});
