'use client';

import { useEffect, useRef } from 'react';
import { X, Star, Martini } from 'lucide-react';
import { Button } from '@/components/ui';
import type { Recipe } from '@/types';
import styles from './RecipeDetailModal.module.css';

interface RecipeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}

export function RecipeDetailModal({
  isOpen,
  onClose,
  recipe,
  isFavorited,
  onToggleFavorite
}: RecipeDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

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

  // Focus management and keyboard shortcuts
  useEffect(() => {
    if (isOpen) {
      // Handle keyboard events
      const handleKeyDown = (e: KeyboardEvent) => {
        // ESC to close
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }

        // Tab key focus trapping
        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !recipe) return null;

  const ingredientsArray = parseIngredients(recipe.ingredients);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-labelledby="recipe-detail-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <Martini size={28} className={styles.titleIcon} />
            <div>
              <h2 className={styles.title} id="recipe-detail-title">
                {recipe.name}
              </h2>
              {recipe.spirit_type && (
                <span className={styles.spiritBadge}>{recipe.spirit_type}</span>
              )}
              {recipe.category && (
                <span className={styles.categoryBadge}>{recipe.category}</span>
              )}
            </div>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Ingredients */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Ingredients</h3>
            {ingredientsArray.length > 0 ? (
              <ul className={styles.ingredientsList}>
                {ingredientsArray.map((ingredient, index) => (
                  <li key={index} className={styles.ingredientItem}>
                    {ingredient}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyText}>No ingredients listed</p>
            )}
          </section>

          {/* Instructions */}
          {recipe.instructions && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Instructions</h3>
              <p className={styles.instructions}>{recipe.instructions}</p>
            </section>
          )}

          {/* Glass Type */}
          {recipe.glass && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Serve In</h3>
              <p className={styles.glassType}>{recipe.glass}</p>
            </section>
          )}

          {/* Compatibility */}
          {recipe.compatibility !== undefined && recipe.compatibility !== null && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Bar Compatibility</h3>
              <div className={styles.compatibility}>
                <div className={styles.compatibilityBar}>
                  <div
                    className={styles.compatibilityFill}
                    style={{ width: `${recipe.compatibility}%` }}
                  />
                </div>
                <span className={styles.compatibilityText}>
                  {recipe.compatibility}% match with your bar
                </span>
              </div>
            </section>
          )}

          {/* Missing Ingredients */}
          {recipe.missing && recipe.missing.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Missing Ingredients</h3>
              <ul className={styles.missingList}>
                {recipe.missing.map((item, index) => (
                  <li key={index} className={styles.missingItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button
            variant={isFavorited ? 'outline' : 'primary'}
            onClick={onToggleFavorite}
          >
            <Star
              size={18}
              fill={isFavorited ? 'currentColor' : 'none'}
              style={{ marginRight: '8px' }}
            />
            {isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
