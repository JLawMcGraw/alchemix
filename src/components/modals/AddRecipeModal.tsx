'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, X, AlertCircle, Trash2 } from 'lucide-react';
import { Button, Input, Spinner, SuccessCheckmark } from '@/components/ui';
import type { Recipe, Collection } from '@/types';
import styles from './BottleFormModal.module.css';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (recipe: Omit<Recipe, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  collections?: Collection[];
}

type FormState = {
  name: string;
  ingredients: string[];
  instructions: string;
  glass: string;
  category: string;
  spirit_type: string;
  collection_id: string;
};

const createInitialFormState = (): FormState => ({
  name: '',
  ingredients: [''],
  instructions: '',
  glass: '',
  category: '',
  spirit_type: '',
  collection_id: '',
});

export function AddRecipeModal({ isOpen, onClose, onAdd, collections = [] }: AddRecipeModalProps) {
  const [formData, setFormData] = useState<FormState>(createInitialFormState());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);

      // Focus management and keyboard shortcuts
      // Auto-focus first input
      setTimeout(() => firstInputRef.current?.focus(), 100);

      // Handle keyboard events
      const handleKeyDown = (e: KeyboardEvent) => {
        // ESC to close
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
          return;
        }

        // Tab key focus trapping
        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
            'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
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
  }, [isOpen]);

  // Real-time validation
  const validateField = (name: string, value: string): string | null => {
    if (name === 'name' && !value.trim()) {
      return 'Recipe name is required';
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);

    // Clear field-specific error on change
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }

    // Real-time validation
    const error = validateField(name, value);
    if (error) {
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleIngredientChange = (index: number, value: string) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = value;
    setFormData((prev) => ({ ...prev, ingredients: newIngredients }));
    setIsDirty(true);

    // Clear ingredients error if at least one ingredient has content
    if (fieldErrors.ingredients && newIngredients.some(ing => ing.trim())) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.ingredients;
        return next;
      });
    }
  };

  const handleIngredientKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addIngredient();
    }
  };

  const addIngredient = () => {
    setFormData((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, '']
    }));
  };

  const removeIngredient = (index: number) => {
    if (formData.ingredients.length === 1) return; // Keep at least one
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Recipe name is required';
    }

    const hasIngredients = formData.ingredients.some(ing => ing.trim());
    if (!hasIngredients) {
      errors.ingredients = 'At least one ingredient is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Filter out empty ingredients
      const ingredientsArray = formData.ingredients
        .map(i => i.trim())
        .filter(i => i.length > 0);

      await onAdd({
        name: formData.name.trim(),
        ingredients: ingredientsArray,
        instructions: formData.instructions.trim() || undefined,
        glass: formData.glass.trim() || undefined,
        category: formData.category.trim() || undefined,
        spirit_type: formData.spirit_type.trim() || undefined,
        collection_id: formData.collection_id ? parseInt(formData.collection_id, 10) : undefined,
      });

      // Success - show checkmark animation
      setShowSuccess(true);

      // Reset form after animation
      setTimeout(() => {
        setFormData(createInitialFormState());
        setIsDirty(false);
        setError(null);
        setFieldErrors({});
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recipe');
      console.error('Failed to add recipe:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (isDirty && !showSuccess) {
      const confirmClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmClose) return;
    }

    setFormData(createInitialFormState());
    setError(null);
    setFieldErrors({});
    setIsDirty(false);
    setShowSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={handleClose}
      aria-hidden="true"
    >
      {/* Modal */}
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-labelledby="add-recipe-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 id="add-recipe-title" className={styles.modalTitle}>
            <Plus size={24} />
            Add New Recipe
          </h2>
          <button
            onClick={handleClose}
            className={styles.closeButton}
            aria-label="Close modal"
            disabled={loading}
          >
            <X size={24} />
          </button>
        </div>

        {/* Success Animation Overlay */}
        {showSuccess && (
          <div className={styles.successOverlay}>
            <SuccessCheckmark />
            <p className={styles.successText}>Recipe added successfully!</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.modalContent}>
          {/* Error Message */}
          {error && (
            <div className={styles.errorBanner} role="alert">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Basic Information */}
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Basic Information</h3>

            <Input
              ref={firstInputRef}
              label="Recipe Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={fieldErrors.name}
              fullWidth
              required
              placeholder="e.g., Margarita"
            />

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Ingredients <span className={styles.required}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {formData.ingredients.map((ingredient, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={ingredient}
                      onChange={(e) => handleIngredientChange(index, e.target.value)}
                      onKeyDown={(e) => handleIngredientKeyDown(index, e)}
                      className={`${styles.textarea} ${fieldErrors.ingredients ? styles.inputError : ''}`}
                      placeholder={index === 0 ? 'e.g., 2 oz Tequila' : `Ingredient ${index + 1}`}
                      style={{
                        flex: 1,
                        minHeight: 'auto',
                        padding: '10px 12px',
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-base)',
                      }}
                    />
                    {formData.ingredients.length > 1 && (
                      <Button
                        type="button"
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
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addIngredient}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <Plus size={16} />
                  Add Ingredient
                </Button>
              </div>
              {fieldErrors.ingredients && (
                <span className={styles.errorText}>{fieldErrors.ingredients}</span>
              )}
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Press Enter to quickly add another ingredient
              </span>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="instructions" className={styles.label}>
                Instructions
              </label>
              <textarea
                id="instructions"
                name="instructions"
                value={formData.instructions}
                onChange={handleChange}
                className={styles.textarea}
                placeholder="Enter preparation steps..."
                rows={4}
              />
            </div>
          </div>

          {/* Details */}
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Details</h3>

            <Input
              label="Glass Type"
              name="glass"
              value={formData.glass}
              onChange={handleChange}
              fullWidth
              placeholder="e.g., Coupe, Rocks, Highball"
            />

            <Input
              label="Category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              fullWidth
              placeholder="e.g., Classic, Modern, Tiki"
            />

            <Input
              label="Spirit Type"
              name="spirit_type"
              value={formData.spirit_type}
              onChange={handleChange}
              fullWidth
              placeholder="e.g., Tequila, Gin, Vodka"
            />

            <div className={styles.formGroup}>
              <label htmlFor="collection_id" className={styles.label}>
                Collection (Optional)
              </label>
              <select
                id="collection_id"
                name="collection_id"
                value={formData.collection_id}
                onChange={handleChange}
                className={styles.select}
              >
                <option value="">Uncategorized</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? (
                <>
                  <Spinner size="sm" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Add Recipe
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
