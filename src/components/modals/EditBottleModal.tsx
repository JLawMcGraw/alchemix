'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, ChevronDown, ChevronUp, AlertCircle, Plus, Minus, Trash2 } from 'lucide-react';
import { SuccessCheckmark } from '@/components/ui';
import { ConfirmModal } from './ConfirmModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { InventoryItem, InventoryCategory } from '@/types';
import styles from './EditBottleModal.module.css';

interface EditBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: InventoryItem | null;
  onUpdate: (id: number, item: Partial<InventoryItem>) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

type FormState = {
  name: string;
  category: InventoryCategory;
  type: string;
  quantity: number;
  abv: string;
  origin: string;
  notes: string;
};

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: 'spirit', label: 'Spirit' },
  { value: 'liqueur', label: 'Liqueur' },
  { value: 'wine', label: 'Wine' },
  { value: 'beer', label: 'Beer & Cider' },
  { value: 'bitters', label: 'Bitters' },
  { value: 'mixer', label: 'Mixer' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'garnish', label: 'Garnish' },
  { value: 'pantry', label: 'Pantry' },
];

export function EditBottleModal({ isOpen, onClose, bottle, onUpdate, onDelete }: EditBottleModalProps) {
  const [formData, setFormData] = useState<FormState>({
    name: '',
    category: 'spirit',
    type: '',
    quantity: 1,
    abv: '',
    origin: '',
    notes: '',
  });

  const [originalData, setOriginalData] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Calculate changed fields
  const changedFields = useMemo(() => {
    if (!originalData) return [];
    return Object.keys(formData).filter(
      key => formData[key as keyof FormState] !== originalData[key as keyof FormState]
    );
  }, [formData, originalData]);

  const hasChanges = changedFields.length > 0;

  // Check if details section has changes
  const detailsHaveChanges = changedFields.some(f => ['abv', 'origin', 'notes'].includes(f));

  const doClose = useCallback(() => {
    setError(null);
    setLoading(false);
    setShowSuccess(false);
    setShowDetails(false);
    setShowConfirmClose(false);
    setShowDeleteConfirm(false);
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (hasChanges && !loading && !showSuccess) {
      setShowConfirmClose(true);
      return;
    }
    doClose();
  }, [hasChanges, loading, showSuccess, doClose]);

  // Populate form when bottle changes
  useEffect(() => {
    if (bottle) {
      const data: FormState = {
        name: bottle.name || '',
        category: bottle.category || 'spirit',
        type: bottle.type || '',
        quantity: bottle.stock_number ?? 1,
        abv: bottle.abv?.toString() || '',
        origin: bottle.distillery_location || '',
        notes: bottle.tasting_notes || bottle.additional_notes || '',
      };
      setFormData(data);
      setOriginalData(data);
      setShowDetails(false);
    }
  }, [bottle]);

  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      document.body.style.overflow = 'hidden';

      setTimeout(() => firstInputRef.current?.focus(), 100);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
          return;
        }

        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
            'button, input, textarea, [tabindex]:not([tabindex="-1"])'
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
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, handleClose]);

  if (!isOpen || !bottle) return null;

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuantityChange = (delta: number) => {
    const newValue = Math.max(0, formData.quantity + delta);
    handleChange('quantity', newValue);
  };

  const isFieldChanged = (field: keyof FormState) => changedFields.includes(field);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (!hasChanges) return;

    setLoading(true);
    setError(null);

    try {
      const updates: Partial<InventoryItem> = {
        name: formData.name,
        category: formData.category,
        type: formData.type || undefined,
        stock_number: formData.quantity,
        abv: formData.abv || undefined,
        distillery_location: formData.origin || undefined,
        tasting_notes: formData.notes || undefined,
      };

      await onUpdate(bottle.id!, updates);
      setShowSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to update item');
      } else {
        setError('Failed to update item');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    if (!onDelete || !bottle?.id) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete || !bottle?.id) return;

    setLoading(true);
    setError(null);

    try {
      await onDelete(bottle.id);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to delete item');
      } else {
        setError('Failed to delete item');
      }
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <SuccessCheckmark
        message="Item updated successfully!"
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
          aria-labelledby="edit-bottle-title"
          aria-modal="true"
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <h2 className={styles.title} id="edit-bottle-title">Edit Item</h2>
              {hasChanges && (
                <span className={styles.changeCount}>
                  {changedFields.length} field{changedFields.length !== 1 ? 's' : ''} changed
                </span>
              )}
            </div>
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
              {/* Quick Quantity Adjust */}
              <div className={styles.quantityCard}>
                <div className={styles.quantityInfo}>
                  <div className={styles.quantityLabel}>
                    Quantity
                    {isFieldChanged('quantity') && <span className={styles.changeIndicator} />}
                  </div>
                  <div className={styles.quantityHint}>Quick adjust stock level</div>
                </div>
                <div className={styles.quantityStepper}>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={() => handleQuantityChange(-1)}
                    disabled={formData.quantity <= 0}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="text"
                    className={`${styles.quantityInput} ${isFieldChanged('quantity') ? styles.inputChanged : ''}`}
                    value={formData.quantity}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      handleChange('quantity', parseInt(val) || 0);
                    }}
                  />
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

              {/* Name */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Name <span className={styles.required}>*</span>
                  {isFieldChanged('name') && <span className={styles.changeIndicator} />}
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  className={`${styles.input} ${isFieldChanged('name') ? styles.inputChanged : ''}`}
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
              </div>

              {/* Category */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Category
                  {isFieldChanged('category') && <span className={styles.changeIndicator} />}
                </label>
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

              {/* Type */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Type
                  {isFieldChanged('type') && <span className={styles.changeIndicator} />}
                </label>
                <input
                  type="text"
                  className={`${styles.input} ${isFieldChanged('type') ? styles.inputChanged : ''}`}
                  placeholder="e.g., Bourbon, London Dry"
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                />
              </div>

              {/* Expand for more details */}
              <button
                type="button"
                className={styles.detailsToggle}
                onClick={() => setShowDetails(!showDetails)}
                aria-expanded={showDetails}
              >
                {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <span>{showDetails ? 'Hide details' : 'More details'}</span>
                {detailsHaveChanges && !showDetails && <span className={styles.changeIndicator} />}
              </button>

              {/* Collapsible Details */}
              {showDetails && (
                <div className={styles.detailsSection}>
                  {/* ABV */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                      ABV %
                      {isFieldChanged('abv') && <span className={styles.changeIndicator} />}
                    </label>
                    <input
                      type="text"
                      className={`${styles.input} ${styles.inputSmall} ${isFieldChanged('abv') ? styles.inputChanged : ''}`}
                      placeholder="40"
                      value={formData.abv}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        handleChange('abv', val);
                      }}
                    />
                  </div>

                  {/* Origin */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                      Origin / Distillery
                      {isFieldChanged('origin') && <span className={styles.changeIndicator} />}
                    </label>
                    <input
                      type="text"
                      className={`${styles.input} ${isFieldChanged('origin') ? styles.inputChanged : ''}`}
                      placeholder="e.g., Kentucky, Islay"
                      value={formData.origin}
                      onChange={(e) => handleChange('origin', e.target.value)}
                    />
                  </div>

                  {/* Notes */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                      Notes
                      {isFieldChanged('notes') && <span className={styles.changeIndicator} />}
                    </label>
                    <textarea
                      className={`${styles.textarea} ${isFieldChanged('notes') ? styles.inputChanged : ''}`}
                      rows={3}
                      placeholder="Tasting notes, cocktail ideas..."
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
              {onDelete && (
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={handleDeleteClick}
                  disabled={loading}
                >
                  <Trash2 size={14} />
                  Delete Item
                </button>
              )}
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
                  disabled={loading || !formData.name.trim() || !hasChanges}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
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

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Item"
        message={`Are you sure you want to delete "${bottle?.name}"?`}
      />
    </>
  );
}
