'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Star, Martini, Edit2, Save, Trash2, FolderOpen, Plus } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { useStore } from '@/lib/store';
import { RecipeMolecule } from '@/components/RecipeMolecule';
import type { Recipe, Collection } from '@/types';
import styles from './RecipeDetailModal.module.css';

interface RecipeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onRecipeUpdated?: (updatedRecipe: Recipe) => void;
}

export function RecipeDetailModal({
  isOpen,
  onClose,
  recipe,
  isFavorited,
  onToggleFavorite,
  onRecipeUpdated
}: RecipeDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedRecipe, setEditedRecipe] = useState<Partial<Recipe>>({});
  const [showCollectionSelect, setShowCollectionSelect] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const { updateRecipe, deleteRecipe, collections, fetchCollections, fetchShoppingList } = useStore();
  const { showToast } = useToast();

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

  // Initialize edit form when recipe changes
  useEffect(() => {
    if (recipe && isOpen) {
      const parsedIngredients = parseIngredients(recipe.ingredients);
      setEditedRecipe({
        name: recipe.name,
        ingredients: parsedIngredients.length > 0 ? parsedIngredients : [''],
        instructions: recipe.instructions,
        glass: recipe.glass,
        category: recipe.category,
      });
      setIsEditMode(false);
      setShowCollectionSelect(false);
      setSelectedCollectionId(recipe.collection_id || null);
      // Fetch collections when modal opens
      fetchCollections().catch(console.error);
    }
  }, [recipe, isOpen, fetchCollections]);

  // Handle save
  const handleSave = async () => {
    if (!recipe?.id) return;

    try {
      // Filter out empty ingredients before saving
      const filteredIngredients = Array.isArray(editedRecipe.ingredients)
        ? editedRecipe.ingredients.filter(ing => ing.trim())
        : [];

      await updateRecipe(recipe.id, {
        ...editedRecipe,
        ingredients: filteredIngredients
      });

      // Create the updated recipe object and notify parent
      const updatedRecipe: Recipe = {
        ...recipe,
        ...editedRecipe,
        ingredients: filteredIngredients
      };

      // Notify parent to update selectedRecipe state
      onRecipeUpdated?.(updatedRecipe);

      setIsEditMode(false);
      showToast('success', 'Recipe updated successfully');
    } catch (error) {
      showToast('error', 'Failed to update recipe');
      console.error('Failed to update recipe:', error);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!recipe?.id) return;

    if (!confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteRecipe(recipe.id);
      // Refresh shopping list stats to update Total Recipes, Craftable, Near Misses
      await fetchShoppingList();
      showToast('success', 'Recipe deleted successfully');
      onClose();
    } catch (error) {
      showToast('error', 'Failed to delete recipe');
      console.error('Failed to delete recipe:', error);
    }
  };

  // Handle assign to collection
  const handleAssignCollection = async () => {
    if (!recipe?.id) return;

    try {
      await updateRecipe(recipe.id, { collection_id: selectedCollectionId || undefined });
      await fetchCollections(); // Refresh collection counts

      // Update displayed recipe
      const updatedRecipe: Recipe = {
        ...recipe,
        collection_id: selectedCollectionId || undefined
      };
      onRecipeUpdated?.(updatedRecipe);

      setShowCollectionSelect(false);
      const collectionName = selectedCollectionId
        ? collections.find((c) => c.id === selectedCollectionId)?.name || 'collection'
        : 'no collection';
      showToast('success', selectedCollectionId ? `Added to ${collectionName}` : 'Removed from collection');
    } catch (error) {
      showToast('error', 'Failed to update collection');
      console.error('Failed to assign collection:', error);
    }
  };

  // Handle cancel edit
  const handleCancel = () => {
    if (recipe) {
      const parsedIngredients = parseIngredients(recipe.ingredients);
      setEditedRecipe({
        name: recipe.name,
        ingredients: parsedIngredients.length > 0 ? parsedIngredients : [''],
        instructions: recipe.instructions,
        glass: recipe.glass,
        category: recipe.category,
      });
    }
    setIsEditMode(false);
  };

  // Ingredient management functions
  const handleIngredientChange = (index: number, value: string) => {
    if (!Array.isArray(editedRecipe.ingredients)) return;
    const newIngredients = [...editedRecipe.ingredients];
    newIngredients[index] = value;
    setEditedRecipe({ ...editedRecipe, ingredients: newIngredients });
  };

  const handleIngredientKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addIngredient();
    }
  };

  const addIngredient = () => {
    const currentIngredients = Array.isArray(editedRecipe.ingredients) ? editedRecipe.ingredients : [''];
    setEditedRecipe({
      ...editedRecipe,
      ingredients: [...currentIngredients, '']
    });
  };

  const removeIngredient = (index: number) => {
    if (!Array.isArray(editedRecipe.ingredients)) return;
    if (editedRecipe.ingredients.length === 1) return; // Keep at least one
    setEditedRecipe({
      ...editedRecipe,
      ingredients: editedRecipe.ingredients.filter((_, i) => i !== index)
    });
  };

  // Focus management and keyboard shortcuts
  useEffect(() => {
    if (isOpen) {
      // Handle keyboard events
      const handleKeyDown = (e: KeyboardEvent) => {
        // ESC to close (or cancel edit mode)
        if (e.key === 'Escape') {
          e.preventDefault();
          if (isEditMode) {
            handleCancel();
          } else {
            onClose();
          }
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
  }, [isOpen, isEditMode, onClose]);

  if (!isOpen || !recipe) return null;

  // In edit mode, ingredients are already an array; in view mode, parse from recipe
  const ingredientsArray = isEditMode
    ? (Array.isArray(editedRecipe.ingredients) ? editedRecipe.ingredients : [])
    : parseIngredients(recipe.ingredients);

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
              {isEditMode ? (
                <input
                  type="text"
                  value={editedRecipe.name || ''}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, name: e.target.value })}
                  className={styles.titleInput}
                  placeholder="Recipe name"
                />
              ) : (
                <>
                  <h2 className={styles.title} id="recipe-detail-title">
                    {recipe.name}
                  </h2>
                  {recipe.spirit_type && (
                    <span className={styles.spiritBadge}>{recipe.spirit_type}</span>
                  )}
                  {recipe.category && (
                    <span className={styles.categoryBadge}>{recipe.category}</span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className={styles.headerButtons}>
            {!isEditMode && (
              <button
                className={styles.editBtn}
                onClick={() => setIsEditMode(true)}
                title="Edit recipe"
                aria-label="Edit recipe"
              >
                <Edit2 size={20} />
              </button>
            )}
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Molecule Visualization (View Mode Only) */}
          {!isEditMode && ingredientsArray.length > 0 && (
            <section className={styles.section} style={{ marginTop: '-100px' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <RecipeMolecule
                  recipe={recipe}
                  size="full"
                  showLegend={true}
                  showExport={true}
                />
              </div>
            </section>
          )}

          {/* Category (Edit Mode Only) */}
          {isEditMode && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Category</h3>
              <input
                type="text"
                value={editedRecipe.category || ''}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, category: e.target.value })}
                className={styles.textInput}
                placeholder="e.g., Classic, Sour, Tiki"
              />
            </section>
          )}

          {/* Ingredients */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Ingredients</h3>
            {isEditMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.isArray(editedRecipe.ingredients) && editedRecipe.ingredients.map((ingredient, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={ingredient}
                      onChange={(e) => handleIngredientChange(index, e.target.value)}
                      onKeyDown={(e) => handleIngredientKeyDown(index, e)}
                      className={styles.textInput}
                      placeholder={index === 0 ? 'e.g., 2 oz Bourbon' : `Ingredient ${index + 1}`}
                      style={{ flex: 1 }}
                    />
                    {(editedRecipe.ingredients?.length ?? 0) > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeIngredient(index)}
                        style={{ padding: '8px', minWidth: 'auto', color: 'var(--color-semantic-error)' }}
                        aria-label="Remove ingredient"
                      >
                        <Trash2 size={18} />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addIngredient}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <Plus size={16} />
                  Add Ingredient
                </Button>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  Press Enter to quickly add another ingredient
                </span>
              </div>
            ) : (
              <>
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
              </>
            )}
          </section>

          {/* Instructions */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Instructions</h3>
            {isEditMode ? (
              <textarea
                value={editedRecipe.instructions || ''}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, instructions: e.target.value })}
                className={styles.textarea}
                placeholder="Describe how to make this cocktail..."
                rows={4}
              />
            ) : (
              <>
                {recipe.instructions ? (
                  <p className={styles.instructions}>{recipe.instructions}</p>
                ) : (
                  <p className={styles.emptyText}>No instructions provided</p>
                )}
              </>
            )}
          </section>

          {/* Glass Type */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Serve In</h3>
            {isEditMode ? (
              <input
                type="text"
                value={editedRecipe.glass || ''}
                onChange={(e) => setEditedRecipe({ ...editedRecipe, glass: e.target.value })}
                className={styles.textInput}
                placeholder="e.g., Rocks glass, Coupe, Highball"
              />
            ) : (
              <>
                {recipe.glass ? (
                  <p className={styles.glassType}>{recipe.glass}</p>
                ) : (
                  <p className={styles.emptyText}>No glass type specified</p>
                )}
              </>
            )}
          </section>

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

          {/* Collection Assignment Section */}
          {!isEditMode && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Collection</h3>
              {showCollectionSelect ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={selectedCollectionId ?? ''}
                    onChange={(e) => setSelectedCollectionId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-text-body)',
                      backgroundColor: 'var(--color-ui-bg-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">No Collection</option>
                    {(Array.isArray(collections) ? collections : []).map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                  <Button variant="primary" size="sm" onClick={handleAssignCollection}>
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCollectionSelect(false);
                      setSelectedCollectionId(recipe?.collection_id || null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'var(--color-text-subtle)' }}>
                    {recipe?.collection_id
                      ? (Array.isArray(collections) ? collections : []).find((c) => c.id === recipe.collection_id)?.name || 'Unknown Collection'
                      : 'Not in a collection'}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setShowCollectionSelect(true)}>
                    <FolderOpen size={16} style={{ marginRight: '6px' }} />
                    Change
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {isEditMode ? (
            <>
              <Button
                variant="outline"
                onClick={handleDelete}
                className={styles.deleteBtn}
              >
                <Trash2 size={18} style={{ marginRight: '8px' }} />
                Delete
              </Button>
              <div style={{ flex: 1 }} />
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave}>
                <Save size={18} style={{ marginRight: '8px' }} />
                Save Changes
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
