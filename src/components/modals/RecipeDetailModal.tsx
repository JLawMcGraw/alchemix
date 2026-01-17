'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { X, Star, Edit2, Save, Trash2, FolderOpen, Plus, Download } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { useStore } from '@/lib/store';
import { RecipeMolecule } from '@/components/RecipeMolecule';
import { GlassSelector } from '@/components/GlassSelector';
import { classifyIngredient, parseIngredient, generateFormula, toOunces, TYPE_COLORS, type IngredientType } from '@alchemix/recipe-molecule';
import { FormulaTooltip } from '@/components/FormulaTooltip';
import type { Recipe, Collection } from '@/types';
import { SPIRIT_COLORS, getSpiritColorFromIngredients } from '@/lib/colors';
import { parseIngredients } from '@/lib/utils';
import styles from './RecipeDetailModal.module.css';

// Get spirit color from recipe ingredients or category
function getSpiritColor(recipe: Recipe): string {
  const ingredients = parseIngredients(recipe.ingredients);
  const color = getSpiritColorFromIngredients(ingredients);
  if (color !== SPIRIT_COLORS.default) return color;

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

// Get 2-letter symbol for ingredient type (matches classifier.ts)
const TYPE_SYMBOLS: Record<IngredientType, string> = {
  spirit: 'Sp',
  acid: 'Ac',
  sweet: 'Sw',
  bitter: 'Bt',
  salt: 'Na',
  dilution: 'Mx',
  garnish: 'Ga',
  dairy: 'Da',
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
        ? editedRecipe.ingredients.filter((ing: string) => ing.trim())
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
      ingredients: editedRecipe.ingredients.filter((_: string, i: number) => i !== index)
    });
  };

  // Handle export as styled PNG (Instagram Story format 1080x1920)
  const handleExport = useCallback(async () => {
    if (!recipe || !moleculeSvgRef.current) return;

    const ingredients = parseIngredients(recipe.ingredients);
    const formula = ingredients.length > 0 ? generateFormula(ingredients) : '';

    // Instagram Story dimensions (9:16 aspect ratio)
    const canvasWidth = 1080;
    const canvasHeight = 1920;
    const scale = 2; // For extra crisp export
    const padding = 80;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    // === CLEAN WHITE BACKGROUND ===
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // === RECIPE TITLE (at top) ===
    const titleY = 100;
    ctx.fillStyle = '#18181B';
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(recipe.name, canvasWidth / 2, titleY);

    // === FORMULA === (matches .formula style: 14px, weight 500, letter-spacing 0.02em)
    const formulaY = titleY + 70;
    ctx.fillStyle = '#71717A';
    ctx.font = '500 28px "JetBrains Mono", monospace';
    ctx.fillText(formula, canvasWidth / 2, formulaY);

    // === MOLECULE (hero element - larger, closer to formula) ===
    const moleculeY = formulaY + 30;
    const moleculeSize = 720;
    const moleculeX = (canvasWidth - moleculeSize) / 2;

    // Clone SVG and inline styles
    const svgElement = moleculeSvgRef.current;
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

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
      // Draw molecule
      ctx.drawImage(img, moleculeX, moleculeY, moleculeSize, moleculeSize * 0.75);
      URL.revokeObjectURL(svgUrl);

      // === LEGEND (below molecule) - matches Legend.tsx and molecule.module.css exactly ===
      const legendY = moleculeY + moleculeSize * 0.75 + 40;

      // Get unique ingredient types for legend (exclude spirits - they show their name)
      const usedTypes = [...new Set(ingredients.map(ing => {
        const parsed = parseIngredient(ing);
        return classifyIngredient(parsed).type;
      }))].filter(t => t !== 'spirit' && t !== 'junction');

      const typeOrder = ['acid', 'sweet', 'bitter', 'salt', 'dilution', 'dairy', 'egg', 'garnish'];
      const sortedTypes = usedTypes.sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b));

      const TYPE_ABBREV: Record<string, string> = {
        acid: 'Ac', sweet: 'Sw', bitter: 'Bt', salt: 'Na',
        dilution: 'Mx', garnish: 'Ga', dairy: 'Da', egg: 'Eg'
      };
      const TYPE_NAMES: Record<string, string> = {
        acid: 'Acid', sweet: 'Sweet', bitter: 'Bitter', salt: 'Salt',
        dilution: 'Mixer', garnish: 'Garnish', dairy: 'Dairy', egg: 'Egg'
      };

      let legendEndY = legendY;

      if (sortedTypes.length > 0) {
        // Legend title - matches .legendTitle: 10px * 2 = 20px, weight 500, letter-spacing 0.1em, uppercase
        ctx.fillStyle = '#71717A';
        ctx.font = '500 20px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RECIPE CHEMICAL STRUCTURE', canvasWidth / 2, legendY);

        // Legend items - horizontal layout matching Legend.tsx exactly
        // Format: "Ac = Acid" with .legendAbbr (bold), .legendEquals (#A1A1AA), .legendName (#71717A)
        // gap: 1rem (16px) between items, so 32px in export
        const itemGap = 32;
        const legendItemsY = legendY + 40;

        // Calculate total width for centering
        ctx.font = '600 20px "JetBrains Mono", monospace';
        let totalWidth = 0;
        const itemWidths: number[] = [];
        sortedTypes.forEach((t, i) => {
          const abbrWidth = ctx.measureText(TYPE_ABBREV[t]).width;
          ctx.font = '500 20px "JetBrains Mono", monospace';
          const equalsWidth = ctx.measureText(' = ').width;
          const nameWidth = ctx.measureText(TYPE_NAMES[t]).width;
          const itemWidth = abbrWidth + equalsWidth + nameWidth;
          itemWidths.push(itemWidth);
          totalWidth += itemWidth;
          if (i < sortedTypes.length - 1) totalWidth += itemGap;
          ctx.font = '600 20px "JetBrains Mono", monospace';
        });

        // Draw legend items centered
        let currentX = (canvasWidth - totalWidth) / 2;
        sortedTypes.forEach((t, i) => {
          // Abbreviation - bold (#27272A, weight 600)
          ctx.font = '600 20px "JetBrains Mono", monospace';
          ctx.fillStyle = '#27272A';
          ctx.textAlign = 'left';
          ctx.fillText(TYPE_ABBREV[t], currentX, legendItemsY);
          currentX += ctx.measureText(TYPE_ABBREV[t]).width;

          // Equals sign (#A1A1AA)
          ctx.font = '500 20px "JetBrains Mono", monospace';
          ctx.fillStyle = '#A1A1AA';
          ctx.fillText(' = ', currentX, legendItemsY);
          currentX += ctx.measureText(' = ').width;

          // Name (#71717A)
          ctx.fillStyle = '#71717A';
          ctx.fillText(TYPE_NAMES[t], currentX, legendItemsY);
          currentX += ctx.measureText(TYPE_NAMES[t]).width;

          // Add gap between items
          if (i < sortedTypes.length - 1) {
            currentX += itemGap;
          }
        });

        legendEndY = legendItemsY + 40;
      }

      // === INGREDIENTS SECTION ===
      const ingredientsStartY = legendEndY + 40;

      // Section title with line - matches .sectionTitle: 12px * 2 = 24px, weight 500, letter-spacing 0.15em
      ctx.fillStyle = '#71717A';
      ctx.font = '500 24px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const ingredientsTitleX = padding + 60;
      ctx.fillText('INGREDIENTS', ingredientsTitleX, ingredientsStartY);

      // Line after title (matches .sectionTitle::after) - gap 12px * 2 = 24px
      const titleWidth = ctx.measureText('INGREDIENTS').width;
      ctx.strokeStyle = '#E4E4E7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ingredientsTitleX + titleWidth + 24, ingredientsStartY);
      ctx.lineTo(canvasWidth - padding - 60, ingredientsStartY);
      ctx.stroke();

      // Helper for text wrapping
      const wrapText = (text: string, maxWidth: number): string[] => {
        ctx.font = '26px "JetBrains Mono", monospace';
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
      };

      // Draw ingredients - matches .ingredientItem and .ingredientPip
      // .ingredientsList gap: 4px * 2 = 8px between items
      // .ingredientItem padding: 8px 12px * 2 = 16px 24px, gap: 10px * 2 = 20px
      const contentStartX = padding + 60;
      const pipSize = 44; // matches .ingredientPip 22px * 2
      const pipRadius = pipSize / 2;
      const textOffsetX = pipSize + 20; // pip + gap (10px * 2)
      const maxTextWidth = canvasWidth - contentStartX - textOffsetX - padding - 60;
      const lineHeight = 36;
      const ingredientGap = 8; // .ingredientsList gap: 4px * 2
      let currentY = ingredientsStartY + 50; // margin-bottom: 12px * 2 + some padding

      ingredients.forEach((ingredient) => {
        const parsed = parseIngredient(ingredient);
        const classified = classifyIngredient(parsed);
        const color = TYPE_COLORS_HEX[classified.type];
        const symbol = TYPE_SYMBOLS[classified.type];
        const lines = wrapText(ingredient, maxTextWidth);

        // Calculate row height for proper pip centering
        const rowHeight = Math.max(lines.length * lineHeight, pipSize);

        // Color pip - matches .ingredientPip: 22px * 2 = 44px, vertically centered in row
        const pipX = contentStartX + pipRadius;
        const pipY = currentY + rowHeight / 2;

        ctx.beginPath();
        ctx.arc(pipX, pipY, pipRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Symbol in pip - matches .ingredientPip: 0.75rem * 2 = 24px, text-transform: uppercase
        // Using weight 500 for proper visual match (canvas renders heavier than CSS)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '500 24px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol.toUpperCase(), pipX, pipY);

        // Ingredient text - matches .ingredientItem: 0.8125rem * 2 = 26px mono
        ctx.fillStyle = '#27272A';
        ctx.font = '26px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const textX = contentStartX + textOffsetX;
        const textStartY = currentY + (rowHeight - lines.length * lineHeight) / 2 + lineHeight / 2;
        lines.forEach((line, lineIndex) => {
          ctx.fillText(line, textX, textStartY + lineIndex * lineHeight);
        });

        currentY += rowHeight + ingredientGap;
      });

      // === FOOTER - AlcheMix Logo as SVG (horizontal: icon + text) ===
      // Matches AlcheMixLogo.tsx exactly - icon on left, ALCHEMIX text on right
      const logoSvgString = `
        <svg viewBox="0 0 280 48" xmlns="http://www.w3.org/2000/svg">
          <!-- Icon: Inverted Y molecule (scaled to 48x48) -->
          <g transform="translate(0, 0) scale(0.48)">
            <!-- Bonds -->
            <g stroke="#3D3D3D" stroke-width="4" stroke-linecap="round">
              <line x1="50" y1="50" x2="50" y2="15"/>
              <line x1="50" y1="50" x2="22" y2="80"/>
              <line x1="50" y1="50" x2="78" y2="80"/>
            </g>
            <!-- Nodes -->
            <circle cx="50" cy="15" r="10" fill="#4A90D9" stroke="#3D3D3D" stroke-width="2.5"/>
            <circle cx="22" cy="80" r="10" fill="#65A30D" stroke="#3D3D3D" stroke-width="2.5"/>
            <circle cx="78" cy="80" r="10" fill="#F5A623" stroke="#3D3D3D" stroke-width="2.5"/>
            <circle cx="50" cy="50" r="7" fill="#EC4899" stroke="#3D3D3D" stroke-width="2"/>
          </g>
          <!-- Text: ALCHEMIX (next to icon) -->
          <text x="58" y="32" font-family="Inria Sans, sans-serif" font-size="22" font-weight="300" fill="#1E293B" letter-spacing="0.08em">ALCHEMIX</text>
        </svg>
      `;

      const logoBlob = new Blob([logoSvgString], { type: 'image/svg+xml;charset=utf-8' });
      const logoUrl = URL.createObjectURL(logoBlob);
      const logoImg = new Image();

      logoImg.onload = () => {
        // Draw logo centered at bottom
        const logoWidth = 280;
        const logoHeight = 48;
        const logoX = (canvasWidth - logoWidth) / 2;
        const logoY = canvasHeight - 90;

        ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
        URL.revokeObjectURL(logoUrl);

        // === DOWNLOAD ===
        const link = document.createElement('a');
        link.download = `${recipe.name.replace(/\s+/g, '-').toLowerCase()}-recipe.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast('success', 'Recipe exported successfully');
      };

      logoImg.onerror = () => {
        URL.revokeObjectURL(logoUrl);
        // Still download even if logo fails
        const link = document.createElement('a');
        link.download = `${recipe.name.replace(/\s+/g, '-').toLowerCase()}-recipe.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('success', 'Recipe exported');
      };

      logoImg.src = logoUrl;
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
                    <FormulaTooltip
                      formula={generateFormula(ingredientsArray)}
                      className={styles.formula}
                    />
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
                {Array.isArray(editedRecipe.ingredients) && editedRecipe.ingredients.map((ingredient: string, index: number) => (
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
                    {ingredientsArray.map((ingredient: string, index: number) => {
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

            ingredientsArray.forEach((ingredient: string) => {
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
                {recipe.missing.map((item: string, index: number) => (
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
