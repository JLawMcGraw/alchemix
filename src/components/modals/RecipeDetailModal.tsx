'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { X, Star, Edit2, Save, Trash2, FolderOpen, Plus, Download } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { useStore } from '@/lib/store';
import { RecipeMolecule } from '@/components/RecipeMolecule';
import { GlassSelector } from '@/components/GlassSelector';
import { classifyIngredient, parseIngredient, generateFormula, toOunces, TYPE_COLORS, type IngredientType } from '@alchemix/recipe-molecule';
import type { Recipe, Collection } from '@/types';
import styles from './RecipeDetailModal.module.css';

// Spirit colors for top border (matching ItemDetailModal category colors)
const SPIRIT_COLORS: Record<string, string> = {
  rum: '#65A30D',
  tequila: '#0D9488',
  mezcal: '#0D9488',
  whiskey: '#D97706',
  bourbon: '#D97706',
  rye: '#D97706',
  scotch: '#D97706',
  gin: '#0EA5E9',
  vodka: '#94A3B8',
  brandy: '#8B5CF6',
  cognac: '#8B5CF6',
  liqueur: '#8B5CF6',
  vermouth: '#10B981',
  amaro: '#10B981',
  default: '#64748B',
};

// Get spirit color from recipe ingredients or category
function getSpiritColor(recipe: Recipe): string {
  // Try to detect spirit from ingredients
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : typeof recipe.ingredients === 'string'
      ? (() => { try { return JSON.parse(recipe.ingredients); } catch { return [recipe.ingredients]; } })()
      : [];

  for (const ing of ingredients) {
    const ingLower = (typeof ing === 'string' ? ing : '').toLowerCase();
    for (const [spirit, color] of Object.entries(SPIRIT_COLORS)) {
      if (spirit !== 'default' && ingLower.includes(spirit)) {
        return color;
      }
    }
  }

  // Fallback to category
  const category = (recipe.category || '').toLowerCase();
  for (const [spirit, color] of Object.entries(SPIRIT_COLORS)) {
    if (spirit !== 'default' && category.includes(spirit)) {
      return color;
    }
  }

  return SPIRIT_COLORS.default;
}

// Map ingredient types to CSS variable names for bond colors
// Aligned with design system from globals.css
const TYPE_TO_CSS_VAR: Record<IngredientType, string> = {
  spirit: '--bond-agave',          // Teal #0D9488 - base spirits
  acid: '--bond-acid',            // Yellow #F59E0B - citrus/acids
  sweet: '--bond-sweet',          // Sky Blue #0EA5E9 - syrups/liqueurs
  bitter: '--bond-botanical',     // Pink #EC4899 - amaro/bitters
  salt: '--bond-salt',            // Red #EF4444 - salt/spices
  dilution: '--bond-carbonation', // Silver #A1A1AA - soda/tonic
  garnish: '--bond-garnish',      // Emerald #10B981 - herbs/garnishes
  dairy: '--bond-dairy',          // Light Gray #E5E5E5 - cream
  egg: '--bond-egg',              // Warm Yellow #FDE68A - eggs
  junction: '--fg-tertiary',
};

// Get 2-letter symbol for ingredient type
const TYPE_SYMBOLS: Record<IngredientType, string> = {
  spirit: 'Sp',
  acid: 'Ac',
  sweet: 'Sw',
  bitter: 'Bt',
  salt: 'Sa',
  dilution: 'Mx',
  garnish: 'Gn',
  dairy: 'Dy',
  egg: 'Eg',
  junction: '',
};

interface RecipeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onRecipeUpdated?: (updatedRecipe: Recipe) => void;
}

// Format balance value - show "trace" for very small amounts, otherwise appropriate precision
function formatBalanceValue(value: number): string {
  if (value === 0) return '0';
  if (value < 0.05) return 'trace';  // Very small amounts (like a dash)
  if (value < 1) return value.toFixed(2);  // Show 2 decimals for sub-1 values
  return value.toFixed(1);  // Show 1 decimal for larger values
}

// Color values for export (matching CSS variables from globals.css)
const TYPE_COLORS_HEX: Record<IngredientType, string> = {
  spirit: '#0D9488',  // Teal/Agave - base spirits
  acid: '#F59E0B',    // Yellow/Amber - citrus/acids
  sweet: '#0EA5E9',   // Sky Blue - syrups/liqueurs
  bitter: '#EC4899',  // Pink - amaro/bitters
  salt: '#EF4444',    // Red - salt/spices
  dilution: '#A1A1AA', // Silver - soda/tonic
  garnish: '#10B981', // Emerald - herbs/garnishes
  dairy: '#E5E5E5',   // Light Gray - cream
  egg: '#FDE68A',     // Warm Yellow - eggs
  junction: '#64748B',
};

export function RecipeDetailModal({
  isOpen,
  onClose,
  recipe,
  isFavorited,
  onToggleFavorite,
  onRecipeUpdated
}: RecipeDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const moleculeSvgRef = useRef<SVGSVGElement>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedRecipe, setEditedRecipe] = useState<Partial<Recipe>>({});
  const [showCollectionSelect, setShowCollectionSelect] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const { updateRecipe, deleteRecipe, collections, fetchCollections, fetchShoppingList } = useStore();
  const { showToast } = useToast();

  // Helper function to parse ingredients
  const parseIngredients = useCallback((ingredients: string | string[] | undefined): string[] => {
    if (!ingredients) return [];
    if (Array.isArray(ingredients)) return ingredients;
    try {
      const parsed = JSON.parse(ingredients);
      return Array.isArray(parsed) ? parsed : [ingredients];
    } catch {
      return ingredients.split(',').map(i => i.trim());
    }
  }, []);

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
  }, [recipe, isOpen, fetchCollections, parseIngredients]);

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
  const handleCancel = useCallback(() => {
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
  }, [recipe, parseIngredients]);

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

  // Handle export as styled PNG
  const handleExport = useCallback(async () => {
    if (!recipe || !moleculeSvgRef.current) return;

    const ingredients = parseIngredients(recipe.ingredients);
    const formula = ingredients.length > 0 ? generateFormula(ingredients) : '';

    // Canvas dimensions
    const canvasWidth = 600;
    const padding = 40;
    const titleHeight = 50;
    const formulaHeight = 30;
    const moleculeHeight = 320;
    const ingredientLineHeight = 32;
    const ingredientsHeight = ingredients.length * ingredientLineHeight + 40;
    const canvasHeight = padding * 2 + titleHeight + formulaHeight + moleculeHeight + ingredientsHeight;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * 2; // 2x for retina
    canvas.height = canvasHeight * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale for retina
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Title
    ctx.fillStyle = '#18181B';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(recipe.name, canvasWidth / 2, padding + 30);

    // Formula
    ctx.fillStyle = '#71717A';
    ctx.font = '500 16px "JetBrains Mono", "SF Mono", monospace';
    ctx.fillText(formula, canvasWidth / 2, padding + titleHeight + 20);

    // Convert SVG to image and draw (with inlined styles for proper export)
    const svgElement = moleculeSvgRef.current;

    // Clone SVG and inline computed styles for export
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

    // Inline styles for all elements to ensure proper rendering
    const inlineStyles = (element: Element) => {
      const computed = window.getComputedStyle(element);
      const styles: string[] = [];

      // Key style properties to inline
      const propsToInline = [
        'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity',
        'font-family', 'font-size', 'font-weight', 'letter-spacing',
        'text-anchor', 'dominant-baseline'
      ];

      for (const prop of propsToInline) {
        const value = computed.getPropertyValue(prop);
        if (value && value !== 'none' && value !== '') {
          styles.push(`${prop}: ${value}`);
        }
      }

      if (styles.length > 0) {
        const existingStyle = element.getAttribute('style') || '';
        element.setAttribute('style', existingStyle + styles.join('; '));
      }

      // Recursively process children
      for (const child of element.children) {
        inlineStyles(child);
      }
    };

    // Find original elements and apply their computed styles to cloned elements
    const originalElements = svgElement.querySelectorAll('*');
    const clonedElements = clonedSvg.querySelectorAll('*');

    originalElements.forEach((original, index) => {
      const cloned = clonedElements[index];
      if (!cloned) return;

      const computed = window.getComputedStyle(original);
      const styles: string[] = [];

      const propsToInline = [
        'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity',
        'font-family', 'font-size', 'font-weight', 'letter-spacing',
        'text-anchor', 'dominant-baseline', 'text-transform'
      ];

      for (const prop of propsToInline) {
        const value = computed.getPropertyValue(prop);
        if (value && value !== 'none' && value !== '' && value !== 'normal') {
          styles.push(`${prop}: ${value}`);
        }
      }

      if (styles.length > 0) {
        cloned.setAttribute('style', styles.join('; '));
      }
    });

    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Draw molecule centered
      const moleculeY = padding + titleHeight + formulaHeight + 10;
      const moleculeX = (canvasWidth - 440) / 2;
      ctx.drawImage(img, moleculeX, moleculeY, 440, 320);

      URL.revokeObjectURL(svgUrl);

      // Ingredients section
      const ingredientsY = moleculeY + moleculeHeight + 20;

      // Section title
      ctx.fillStyle = '#71717A';
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.letterSpacing = '0.1em';
      ctx.fillText('INGREDIENTS', padding, ingredientsY);

      // Draw line
      ctx.strokeStyle = '#E4E4E7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding + 90, ingredientsY - 4);
      ctx.lineTo(canvasWidth - padding, ingredientsY - 4);
      ctx.stroke();

      // Draw each ingredient
      ingredients.forEach((ingredient, index) => {
        const y = ingredientsY + 25 + index * ingredientLineHeight;
        const parsed = parseIngredient(ingredient);
        const classified = classifyIngredient(parsed);
        const color = TYPE_COLORS_HEX[classified.type];
        const symbol = TYPE_SYMBOLS[classified.type];

        // Color pip (circle)
        ctx.beginPath();
        ctx.arc(padding + 10, y - 4, 10, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Symbol inside pip (Sp, Ac, Sw, Bt, etc.)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, padding + 10, y - 4);

        // Ingredient text
        ctx.fillStyle = '#27272A';
        ctx.font = '13px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(ingredient, padding + 30, y);
      });

      // Download
      const link = document.createElement('a');
      link.download = `${recipe.name.replace(/\s+/g, '-').toLowerCase()}-recipe.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      showToast('success', 'Recipe exported successfully');
    };

    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      showToast('error', 'Failed to export recipe');
    };

    img.src = svgUrl;
  }, [recipe, showToast, parseIngredients]);

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
  }, [isOpen, isEditMode, onClose, handleCancel]);

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
            <div>
              {isEditMode ? (
                <>
                  <div className={styles.editingLabel}>Editing</div>
                  <input
                    type="text"
                    value={editedRecipe.name || ''}
                    onChange={(e) => setEditedRecipe({ ...editedRecipe, name: e.target.value })}
                    className={styles.titleInput}
                    placeholder="Recipe name"
                  />
                </>
              ) : (
                <>
                  <h2 className={styles.title} id="recipe-detail-title">
                    {recipe.name}
                  </h2>
                  {ingredientsArray.length > 0 && (
                    <div className={styles.formula}>
                      {generateFormula(ingredientsArray)}
                    </div>
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
                <Edit2 size={16} />
              </button>
            )}
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Molecule Visualization (View Mode Only) */}
          {!isEditMode && ingredientsArray.length > 0 && (
            <section className={styles.moleculeSection}>
              <RecipeMolecule
                recipe={recipe}
                size="full"
                showLegend={true}
                showExport={false}
                svgRef={moleculeSvgRef}
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
                    {ingredientsArray.map((ingredient, index) => {
                      const parsed = parseIngredient(ingredient);
                      const classified = classifyIngredient(parsed);
                      const cssVar = TYPE_TO_CSS_VAR[classified.type];
                      const symbol = TYPE_SYMBOLS[classified.type];

                      return (
                        <li key={index} className={styles.ingredientItem}>
                          <span
                            className={styles.ingredientPip}
                            style={{ backgroundColor: `var(${cssVar})` }}
                            title={TYPE_COLORS[classified.type].legend}
                          >
                            {symbol}
                          </span>
                          <span className={styles.ingredientText}>{ingredient}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className={styles.emptyText}>No ingredients listed</p>
                )}
              </>
            )}
          </section>

          {/* Instructions */}
          {(isEditMode || recipe.instructions) && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Instructions</h3>
              {isEditMode ? (
                <textarea
                  value={editedRecipe.instructions || ''}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, instructions: e.target.value })}
                  className={styles.textarea}
                  placeholder="Describe how to make this cocktail..."
                  rows={3}
                />
              ) : (
                <p className={styles.instructions}>{recipe.instructions}</p>
              )}
            </section>
          )}

          {/* Glass Type */}
          {(isEditMode || recipe.glass) && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Serve In</h3>
              {isEditMode ? (
                <GlassSelector
                  value={editedRecipe.glass || ''}
                  onChange={(glass) => setEditedRecipe({ ...editedRecipe, glass })}
                />
              ) : (
                <span className={styles.glassChip}>{recipe.glass}</span>
              )}
            </section>
          )}

          {/* Stoichiometric Balance */}
          {!isEditMode && ingredientsArray.length > 0 && (() => {
            // Calculate balance from ingredients (converting all to oz equivalents)
            const balanceCounts = { spirit: 0, bitter: 0, sweet: 0, acid: 0 };
            let totalVolume = 0;

            ingredientsArray.forEach((ingredient) => {
              const parsed = parseIngredient(ingredient);
              const classified = classifyIngredient(parsed);
              // Convert to oz equivalents for consistent comparison
              const volume = toOunces(parsed.amount, parsed.unit);

              if (classified.type === 'spirit') balanceCounts.spirit += volume;
              else if (classified.type === 'bitter') balanceCounts.bitter += volume;
              else if (classified.type === 'sweet') balanceCounts.sweet += volume;
              else if (classified.type === 'acid') balanceCounts.acid += volume;

              totalVolume += volume;
            });

            // Calculate percentages (relative to max for visual scaling)
            const maxValue = Math.max(...Object.values(balanceCounts), 0.01);

            // Only show if there's meaningful data
            if (totalVolume === 0) return null;

            return (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Stoichiometric Balance</h3>
                <div className={styles.balanceSection}>
                  <div className={styles.balanceRow}>
                    <span className={styles.balanceLabel}>Spirit</span>
                    <div className={styles.balanceTrack}>
                      <div
                        className={styles.balanceFill}
                        style={{
                          width: `${(balanceCounts.spirit / maxValue) * 100}%`,
                          backgroundColor: 'var(--bond-agave)'
                        }}
                      />
                    </div>
                    <span className={styles.balanceValue}>{formatBalanceValue(balanceCounts.spirit)}</span>
                  </div>
                  <div className={styles.balanceRow}>
                    <span className={styles.balanceLabel}>Bitter</span>
                    <div className={styles.balanceTrack}>
                      <div
                        className={styles.balanceFill}
                        style={{
                          width: `${(balanceCounts.bitter / maxValue) * 100}%`,
                          backgroundColor: 'var(--bond-botanical)'
                        }}
                      />
                    </div>
                    <span className={styles.balanceValue}>{formatBalanceValue(balanceCounts.bitter)}</span>
                  </div>
                  <div className={styles.balanceRow}>
                    <span className={styles.balanceLabel}>Sweet</span>
                    <div className={styles.balanceTrack}>
                      <div
                        className={styles.balanceFill}
                        style={{
                          width: `${(balanceCounts.sweet / maxValue) * 100}%`,
                          backgroundColor: 'var(--bond-sweet)'
                        }}
                      />
                    </div>
                    <span className={styles.balanceValue}>{formatBalanceValue(balanceCounts.sweet)}</span>
                  </div>
                  <div className={styles.balanceRow}>
                    <span className={styles.balanceLabel}>Acid</span>
                    <div className={styles.balanceTrack}>
                      <div
                        className={styles.balanceFill}
                        style={{
                          width: `${(balanceCounts.acid / maxValue) * 100}%`,
                          backgroundColor: 'var(--bond-acid)'
                        }}
                      />
                    </div>
                    <span className={styles.balanceValue}>{formatBalanceValue(balanceCounts.acid)}</span>
                  </div>
                </div>
              </section>
            );
          })()}

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
                <div className={styles.collectionPicker}>
                  <select
                    value={selectedCollectionId ?? ''}
                    onChange={(e) => setSelectedCollectionId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className={styles.collectionSelect}
                  >
                    <option value="">No collection</option>
                    {(Array.isArray(collections) ? collections : []).map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                  <div className={styles.collectionActions}>
                    <button onClick={handleAssignCollection} className={styles.collectionSaveBtn}>
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowCollectionSelect(false);
                        setSelectedCollectionId(recipe?.collection_id || null);
                      }}
                      className={styles.collectionCancelBtn}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.collectionDisplay}>
                  <span className={styles.collectionName}>
                    {recipe?.collection_id
                      ? (Array.isArray(collections) ? collections : []).find((c) => c.id === recipe.collection_id)?.name || 'Unknown'
                      : 'None'}
                  </span>
                  <button onClick={() => setShowCollectionSelect(true)} className={styles.collectionChangeBtn}>
                    <FolderOpen size={12} />
                    Change
                  </button>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {isEditMode ? (
            <>
              <button
                onClick={handleDelete}
                className={styles.deleteLink}
              >
                Delete
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={handleCancel} className={styles.cancelBtn}>
                Cancel
              </button>
              <button onClick={handleSave} className={styles.saveBtn}>
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onToggleFavorite}
                className={styles.favoriteBtn}
              >
                <Star
                  size={16}
                  fill={isFavorited ? 'currentColor' : 'none'}
                />
                {isFavorited ? 'Favorited' : 'Add to Favorites'}
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={handleExport} className={styles.exportBtn}>
                <Download size={16} />
                Export
              </button>
              <button onClick={onClose} className={styles.closeTextBtn}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
