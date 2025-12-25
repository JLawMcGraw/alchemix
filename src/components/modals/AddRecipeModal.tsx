'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { SuccessCheckmark } from '@/components/ui';
import { ConfirmModal } from './ConfirmModal';
import { GlassSelector } from '@/components/GlassSelector';
import type { Recipe, Collection } from '@/types';
import styles from './AddRecipeModal.module.css';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (recipe: Omit<Recipe, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  collections?: Collection[];
}

type FormState = {
  name: string;
  spirits: string[];
  ingredients: string;
  instructions: string;
  glass: string;
  collection_id: string;
  notes: string;
};

const createInitialFormState = (): FormState => ({
  name: '',
  spirits: [],
  ingredients: '',
  instructions: '',
  glass: '',
  collection_id: '',
  notes: '',
});

const SPIRITS = [
  { value: 'gin', label: 'Gin', color: '#0EA5E9' },
  { value: 'whiskey', label: 'Whiskey', color: '#D97706' },
  { value: 'rum', label: 'Rum', color: '#65A30D' },
  { value: 'tequila', label: 'Tequila', color: '#0D9488' },
  { value: 'vodka', label: 'Vodka', color: '#94A3B8' },
  { value: 'other', label: 'Other', color: '#8B5CF6' },
];

export function AddRecipeModal({ isOpen, onClose, onAdd, collections = [] }: AddRecipeModalProps) {
  const [formData, setFormData] = useState<FormState>(createInitialFormState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const doClose = useCallback(() => {
    setFormData(createInitialFormState());
    setError(null);
    setIsDirty(false);
    setShowSuccess(false);
    setShowDetails(false);
    setShowConfirmClose(false);
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (isDirty && !showSuccess && !loading) {
      setShowConfirmClose(true);
      return;
    }
    doClose();
  }, [isDirty, showSuccess, loading, doClose]);

  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);

      setTimeout(() => firstInputRef.current?.focus(), 100);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
          return;
        }

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
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSpiritToggle = (spiritValue: string) => {
    const newSpirits = formData.spirits.includes(spiritValue)
      ? formData.spirits.filter(s => s !== spiritValue)
      : [...formData.spirits, spiritValue];
    handleChange('spirits', newSpirits);
  };

  // Parse ingredients count from textarea
  const ingredientCount = formData.ingredients
    .split('\n')
    .filter(line => line.trim()).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Recipe name is required');
      return;
    }

    if (!formData.ingredients.trim()) {
      setError('At least one ingredient is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parse ingredients from textarea (one per line)
      const ingredientsArray = formData.ingredients
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      await onAdd({
        name: formData.name.trim(),
        ingredients: ingredientsArray,
        instructions: formData.instructions.trim() || undefined,
        glass: formData.glass || undefined,
        category: formData.notes.trim() || undefined,
        spirit_type: formData.spirits[0] || undefined,
        collection_id: formData.collection_id ? parseInt(formData.collection_id, 10) : undefined,
      });

      setShowSuccess(true);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recipe');
    } finally {
      setLoading(false);
    }
  };

  const primarySpirit = SPIRITS.find(s => s.value === formData.spirits[0]);

  if (showSuccess) {
    return (
      <SuccessCheckmark
        message="Recipe added successfully!"
        onComplete={doClose}
      />
    );
  }

  return (
    <>
      <div className={styles.overlay} onClick={handleClose}>
        <div
          className={styles.modal}
          onClick={(e) => e.stopPropagation()}
          ref={modalRef}
          role="dialog"
          aria-labelledby="add-recipe-title"
          aria-modal="true"
        >
          {/* Header */}
          <div className={styles.header}>
            <h2 className={styles.title} id="add-recipe-title">Add Recipe</h2>
            <button
              className={styles.closeBtn}
              onClick={handleClose}
              aria-label="Close modal"
              type="button"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.content}>
              {/* Name */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Name <span className={styles.required}>*</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  className={styles.input}
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Jungle Bird"
                />
              </div>

              {/* Base Spirit(s) */}
              <div className={styles.fieldGroup}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>
                    Base Spirit{formData.spirits.length > 1 ? 's' : ''}
                  </label>
                  {formData.spirits.length > 1 && (
                    <span className={styles.labelHint}>
                      Primary: {primarySpirit?.label}
                    </span>
                  )}
                </div>
                <div className={styles.spiritGrid}>
                  {SPIRITS.map((spirit) => {
                    const isSelected = formData.spirits.includes(spirit.value);
                    const isPrimary = formData.spirits[0] === spirit.value;
                    return (
                      <button
                        key={spirit.value}
                        type="button"
                        className={`${styles.spiritBtn} ${isSelected ? styles.spiritBtnSelected : ''}`}
                        onClick={() => handleSpiritToggle(spirit.value)}
                        style={isSelected ? { borderColor: spirit.color } : {}}
                      >
                        <span
                          className={styles.spiritDot}
                          style={{
                            backgroundColor: spirit.color,
                            boxShadow: isPrimary ? `0 0 0 2px white, 0 0 0 3px ${spirit.color}` : 'none'
                          }}
                        />
                        {spirit.label}
                      </button>
                    );
                  })}
                </div>
                {formData.spirits.length > 1 && (
                  <p className={styles.fieldHint}>
                    First selected = primary color for recipe card
                  </p>
                )}
              </div>

              {/* Ingredients */}
              <div className={styles.fieldGroup}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>
                    Ingredients <span className={styles.required}>*</span>
                  </label>
                  {ingredientCount > 0 && (
                    <span className={styles.labelHint}>
                      {ingredientCount} ingredient{ingredientCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <textarea
                  className={styles.ingredientsTextarea}
                  value={formData.ingredients}
                  onChange={(e) => handleChange('ingredients', e.target.value)}
                  placeholder={"2 oz Rum\n0.75 oz Campari\n1.5 oz Pineapple juice\n0.5 oz Lime juice\n0.5 oz Simple syrup"}
                  rows={5}
                />
                <p className={styles.fieldHint}>One ingredient per line</p>
              </div>

              {/* Instructions */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Instructions <span className={styles.optional}>(optional)</span>
                </label>
                <textarea
                  className={styles.textarea}
                  value={formData.instructions}
                  onChange={(e) => handleChange('instructions', e.target.value)}
                  placeholder="Shake all ingredients with ice and strain into a rocks glass over fresh ice. Garnish with pineapple."
                  rows={3}
                />
              </div>

              {/* Collection */}
              {collections.length > 0 && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    Collection <span className={styles.optional}>(optional)</span>
                  </label>
                  <div className={styles.collectionGrid}>
                    {collections.filter((col) => col.id !== undefined).map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        className={`${styles.collectionTag} ${formData.collection_id === String(col.id) ? styles.collectionTagSelected : ''}`}
                        onClick={() => handleChange('collection_id', formData.collection_id === String(col.id) ? '' : String(col.id))}
                      >
                        {col.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Expand for more details */}
              <button
                type="button"
                className={styles.detailsToggle}
                onClick={() => setShowDetails(!showDetails)}
                aria-expanded={showDetails}
              >
                <span>{showDetails ? 'Hide details' : 'More details'}</span>
                {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {/* Collapsible Details */}
              {showDetails && (
                <div className={styles.detailsSection}>
                  {/* Glass Type */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Glass</label>
                    <GlassSelector
                      value={formData.glass}
                      onChange={(glass) => handleChange('glass', glass)}
                    />
                  </div>

                  {/* Notes */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Notes</label>
                    <textarea
                      className={styles.textarea}
                      rows={2}
                      placeholder="Variations, history, or personal tips..."
                      value={formData.notes}
                      onChange={(e) => handleChange('notes', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className={styles.error}>
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading || !formData.name.trim() || !formData.ingredients.trim()}
              >
                {loading ? (
                  'Adding...'
                ) : (
                  <>
                    {formData.spirits.length > 0 && (
                      <span className={styles.submitDots}>
                        {formData.spirits.slice(0, 3).map((spiritValue, i) => {
                          const spirit = SPIRITS.find(s => s.value === spiritValue);
                          return (
                            <span
                              key={spiritValue}
                              className={styles.submitDot}
                              style={{
                                backgroundColor: spirit?.color,
                                marginLeft: i > 0 ? '-2px' : 0,
                              }}
                            />
                          );
                        })}
                      </span>
                    )}
                    Add Recipe
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmClose}
        onClose={() => setShowConfirmClose(false)}
        onConfirm={doClose}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to close this form?"
        confirmText="Discard"
        cancelText="Keep Editing"
        variant="warning"
      />
    </>
  );
}
