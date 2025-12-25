'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronDown, ChevronUp, AlertCircle, Plus, Minus } from 'lucide-react';
import { SuccessCheckmark } from '@/components/ui';
import { ConfirmModal } from './ConfirmModal';
import type { InventoryCategory, InventoryItemInput, PeriodicGroup, PeriodicPeriod } from '@/types';
import { getPeriodicTags, PERIODIC_GROUPS, PERIODIC_PERIODS } from '@/lib/periodicTableV2';
import styles from './AddBottleModal.module.css';

interface AddBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: InventoryItemInput) => Promise<void>;
  /** Pre-fill form data when adding from periodic table element */
  preFill?: {
    name: string;
    category: InventoryCategory;
    type: string;
    periodic_group: PeriodicGroup;
    periodic_period: PeriodicPeriod;
  } | null;
}

type FormState = {
  name: string;
  category: InventoryCategory;
  type: string;
  abv: string;
  stock_number: number;
  spirit_classification: string;
  distillation_method: string;
  distillery_location: string;
  age_statement: string;
  additional_notes: string;
  profile_nose: string;
  palate: string;
  finish: string;
  tasting_notes: string;
  periodic_group: PeriodicGroup;
  periodic_period: PeriodicPeriod;
};

const createInitialFormState = (): FormState => ({
  name: '',
  category: 'spirit',
  type: '',
  abv: '',
  stock_number: 1,
  spirit_classification: '',
  distillation_method: '',
  distillery_location: '',
  age_statement: '',
  additional_notes: '',
  profile_nose: '',
  palate: '',
  finish: '',
  tasting_notes: '',
  periodic_group: 'Base',
  periodic_period: 'Grain',
});

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: 'spirit', label: 'Spirit' },
  { value: 'liqueur', label: 'Liqueur' },
  { value: 'mixer', label: 'Mixer' },
  { value: 'garnish', label: 'Garnish' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'wine', label: 'Wine' },
  { value: 'beer', label: 'Beer' },
  { value: 'other', label: 'Other' },
];

export function AddBottleModal({ isOpen, onClose, onAdd, preFill }: AddBottleModalProps) {
  const [formData, setFormData] = useState<FormState>(createInitialFormState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Actually close the modal and reset state
  const doClose = useCallback(() => {
    setFormData(createInitialFormState());
    setError(null);
    setLoading(false);
    setIsDirty(false);
    setShowSuccess(false);
    setShowDetails(false);
    setAddAnother(false);
    setShowConfirmClose(false);
    onClose();
  }, [onClose]);

  // Handle close with dirty check - defined before effects that use it
  const handleClose = useCallback(() => {
    if (isDirty && !loading) {
      setShowConfirmClose(true);
      return;
    }
    doClose();
  }, [isDirty, loading, doClose]);

  // Apply pre-fill data when modal opens, or reset if no preFill
  useEffect(() => {
    if (isOpen) {
      if (preFill) {
        setFormData(prev => ({
          ...prev,
          name: preFill.name,
          category: preFill.category,
          type: preFill.type,
          periodic_group: preFill.periodic_group,
          periodic_period: preFill.periodic_period,
        }));
      } else {
        // Reset form when opening with no preFill (e.g., "Add Other")
        setFormData(createInitialFormState());
        setError(null);
        setIsDirty(false);
        setShowDetails(false);
      }
    }
  }, [isOpen, preFill]);

  // Auto-detect periodic tags when name or category changes (but not if pre-filled)
  useEffect(() => {
    // Skip auto-detection if we just applied preFill (preFill already has correct tags)
    if (preFill && formData.name === preFill.name) {
      return;
    }
    if (formData.name.trim()) {
      const tags = getPeriodicTags({
        name: formData.name,
        category: formData.category,
        type: formData.type || undefined,
      });
      setFormData(prev => ({
        ...prev,
        periodic_group: tags.group,
        periodic_period: tags.period,
      }));
    }
  }, [formData.name, formData.category, formData.type, preFill]);

  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);

      // Auto-focus first input
      setTimeout(() => firstInputRef.current?.focus(), 100);

      // Handle keyboard events
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
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
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleQuantityChange = (delta: number) => {
    const newValue = Math.max(1, formData.stock_number + delta);
    handleChange('stock_number', newValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const item: InventoryItemInput = {
        name: formData.name,
        category: formData.category,
        type: formData.type || undefined,
        abv: formData.abv || undefined,
        stock_number: formData.stock_number,
        spirit_classification: formData.spirit_classification || undefined,
        distillation_method: formData.distillation_method || undefined,
        distillery_location: formData.distillery_location || undefined,
        age_statement: formData.age_statement || undefined,
        additional_notes: formData.additional_notes || undefined,
        profile_nose: formData.profile_nose || undefined,
        palate: formData.palate || undefined,
        finish: formData.finish || undefined,
        tasting_notes: formData.tasting_notes || undefined,
        periodic_group: formData.periodic_group,
        periodic_period: formData.periodic_period,
      };

      await onAdd(item);
      setIsDirty(false);

      if (addAnother) {
        // Reset form for another entry
        setFormData(createInitialFormState());
        setShowDetails(false);
        setError(null);
        setTimeout(() => firstInputRef.current?.focus(), 100);
      } else {
        setShowSuccess(true);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to add item');
      } else {
        setError('Failed to add item');
      }
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <SuccessCheckmark
        message="Item added successfully!"
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
          aria-labelledby="add-bottle-title"
          aria-modal="true"
        >
          {/* Header */}
          <div className={styles.header}>
            <h2 className={styles.title} id="add-bottle-title">Add to Bar</h2>
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
              {/* Name Input */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Name</label>
                <input
                  ref={firstInputRef}
                  type="text"
                  className={styles.input}
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Hendrick's Gin"
                />
              </div>

              {/* Category Buttons */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Category</label>
                <div className={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      className={`${styles.categoryBtn} ${formData.category === cat.value ? styles.categoryBtnActive : ''}`}
                      onClick={() => handleChange('category', cat.value)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Quantity</label>
                <div className={styles.quantityStepper}>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => handleQuantityChange(-1)}
                    disabled={formData.stock_number <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={16} />
                  </button>
                  <span className={styles.quantityValue}>{formData.stock_number}</span>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => handleQuantityChange(1)}
                    aria-label="Increase quantity"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Expandable Details Section */}
              <button
                type="button"
                className={styles.detailsToggle}
                onClick={() => setShowDetails(!showDetails)}
                aria-expanded={showDetails}
              >
                <span>Add more details</span>
                {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showDetails && (
                <div className={styles.detailsSection}>
                  {/* ABV */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>ABV (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      className={styles.input}
                      value={formData.abv}
                      onChange={(e) => handleChange('abv', e.target.value)}
                      placeholder="e.g., 40"
                    />
                  </div>

                  {/* Origin */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Origin</label>
                    <input
                      type="text"
                      className={styles.input}
                      value={formData.distillery_location}
                      onChange={(e) => handleChange('distillery_location', e.target.value)}
                      placeholder="e.g., Scotland"
                    />
                  </div>

                  {/* Notes */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Notes</label>
                    <textarea
                      className={styles.textarea}
                      value={formData.tasting_notes}
                      onChange={(e) => handleChange('tasting_notes', e.target.value)}
                      placeholder="Personal tasting notes..."
                      rows={3}
                    />
                  </div>

                  {/* Periodic Table Classification */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Periodic Table Classification</label>
                    <p className={styles.fieldHint}>Auto-detected based on name. Override if needed.</p>
                    <div className={styles.periodicRow}>
                      <div className={styles.periodicField}>
                        <span className={styles.periodicLabel}>Function</span>
                        <select
                          className={styles.select}
                          value={formData.periodic_group}
                          onChange={(e) => handleChange('periodic_group', e.target.value as PeriodicGroup)}
                        >
                          {PERIODIC_GROUPS.map((g) => (
                            <option key={g.value} value={g.value}>
                              {g.label} ({g.desc})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.periodicField}>
                        <span className={styles.periodicLabel}>Origin</span>
                        <select
                          className={styles.select}
                          value={formData.periodic_period}
                          onChange={(e) => handleChange('periodic_period', e.target.value as PeriodicPeriod)}
                        >
                          {PERIODIC_PERIODS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label} ({p.desc})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
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
              <label className={styles.addAnotherLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={addAnother}
                  onChange={(e) => setAddAnother(e.target.checked)}
                />
                <span>Add Another</span>
              </label>

              <div className={styles.footerActions}>
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
                  disabled={loading || !formData.name.trim()}
                >
                  {loading ? 'Adding...' : 'Add to Bar'}
                </button>
              </div>
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
