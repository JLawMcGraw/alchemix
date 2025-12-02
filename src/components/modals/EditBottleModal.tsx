'use client';

import { useState, useEffect, useRef } from 'react';
import { Edit2, X, AlertCircle } from 'lucide-react';
import { Button, Input, Spinner, SuccessCheckmark } from '@/components/ui';
import type { InventoryItem, InventoryCategory } from '@/types';
import styles from './BottleFormModal.module.css';

interface EditBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: InventoryItem | null;
  onUpdate: (id: number, item: Partial<InventoryItem>) => Promise<void>;
}

type FormDataState = {
  name: string;
  category: InventoryCategory;
  type: string;
  abv: string;
  stock_number: string;
  spirit_classification: string;
  distillation_method: string;
  distillery_location: string;
  age_statement: string;
  additional_notes: string;
  profile_nose: string;
  palate: string;
  finish: string;
};

export function EditBottleModal({ isOpen, onClose, bottle, onUpdate }: EditBottleModalProps) {
  const [formData, setFormData] = useState<FormDataState>({
    name: '',
    category: 'spirit',
    type: '',
    abv: '',
    stock_number: '',
    spirit_classification: '',
    distillation_method: '',
    distillery_location: '',
    age_statement: '',
    additional_notes: '',
    profile_nose: '',
    palate: '',
    finish: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bottle) {
      const stockValue = bottle.stock_number !== null && bottle.stock_number !== undefined
        ? bottle.stock_number.toString()
        : '0';

      setFormData({
        name: bottle.name || '',
        category: bottle.category || 'spirit',
        type: bottle.type || '',
        abv: bottle.abv?.toString() || '',
        stock_number: stockValue,
        spirit_classification: bottle.spirit_classification || '',
        distillation_method: bottle.distillation_method || '',
        distillery_location: bottle.distillery_location || '',
        age_statement: bottle.age_statement || '',
        additional_notes: bottle.additional_notes || '',
        profile_nose: bottle.profile_nose || '',
        palate: bottle.palate || '',
        finish: bottle.finish || '',
      });
      // Reset scroll position when bottle changes
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  }, [bottle]);

  // Focus management and keyboard shortcuts
  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';

      // Reset content scroll position
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }

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
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        // Unlock body scroll when modal closes
        document.body.style.overflow = '';
      };
    } else {
      // Ensure body scroll is unlocked when modal is closed
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  if (!isOpen || !bottle) return null;

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'name':
        return !value.trim() ? 'Name is required' : '';
      case 'stock_number': {
        if (!value) return '';
        const num = parseInt(value);
        if (isNaN(num)) return 'Must be a valid number';
        if (num < 0) return 'Cannot be negative';
        return '';
      }
      case 'abv': {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return 'Must be a valid number';
        if (num < 0 || num > 100) return 'Must be between 0 and 100';
        return '';
      }
      default:
        return '';
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true); // Mark form as dirty

    // Validate the field
    const error = validateField(field, value);
    setFieldErrors((prev) => ({
      ...prev,
      [field]: error,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updates: Partial<InventoryItem> = {
        name: formData.name,
        category: formData.category,
        type: formData.type || undefined,
        abv: formData.abv || undefined,
        stock_number: formData.stock_number !== '' ? parseInt(formData.stock_number) : undefined,
        spirit_classification: formData.spirit_classification || undefined,
        distillation_method: formData.distillation_method || undefined,
        distillery_location: formData.distillery_location || undefined,
        age_statement: formData.age_statement || undefined,
        additional_notes: formData.additional_notes || undefined,
        profile_nose: formData.profile_nose || undefined,
        palate: formData.palate || undefined,
        finish: formData.finish || undefined,
      };

      await onUpdate(bottle.id!, updates);
      setIsDirty(false); // Reset dirty flag on successful save
      setShowSuccess(true); // Show success animation
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to update bottle');
      } else {
        setError('Failed to update bottle');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Confirm if there are unsaved changes
    if (isDirty && !loading) {
      const confirmClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close this form?'
      );
      if (!confirmClose) return;
    }

    setError(null);
    setLoading(false);
    setIsDirty(false);
    onClose();
  };

  return (
    <>
      {showSuccess && (
        <SuccessCheckmark
          message="Bottle updated successfully!"
          onComplete={handleClose}
        />
      )}
      <div className={styles.overlay} onClick={handleClose}>
        <div
          className={styles.modal}
          onClick={(e) => e.stopPropagation()}
          ref={modalRef}
        role="dialog"
        aria-labelledby="edit-bottle-title"
        aria-describedby="edit-bottle-desc"
        aria-modal="true"
      >
        <div className={styles.header}>
          <h2 className={styles.title} id="edit-bottle-title">
            <Edit2 size={24} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
            Edit Bottle
          </h2>
          <button
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.content} id="edit-bottle-desc" ref={contentRef}>
            <div className={styles.formGrid}>
              {/* Basic Information */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Basic Information</h3>
                <Input
                  ref={firstInputRef}
                  label="Name *"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., Maker's Mark Bourbon"
                  required
                  fullWidth
                  error={fieldErrors.name}
                />
                <Input
                  label="Stock Number"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.stock_number}
                  onChange={(e) => {
                    // Only allow digits
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    handleChange('stock_number', value);
                  }}
                  placeholder="e.g., 0, 1, 2..."
                  fullWidth
                  error={fieldErrors.stock_number}
                />
                <Input
                  label="Type"
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  placeholder="e.g., Bourbon, Gin, Citrus"
                  fullWidth
                />
              </div>

              {/* Classification & Details */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Classification & Details</h3>
                <Input
                  label="Detailed Spirit Classification"
                  value={formData.spirit_classification}
                  onChange={(e) => handleChange('spirit_classification', e.target.value)}
                  placeholder="e.g., Kentucky Straight Bourbon"
                  fullWidth
                />
                <Input
                  label="Distillation Method"
                  value={formData.distillation_method}
                  onChange={(e) => handleChange('distillation_method', e.target.value)}
                  placeholder="e.g., Pot Still, Column Still"
                  fullWidth
                />
                <Input
                  label="ABV (%)"
                  type="number"
                  step="0.1"
                  value={formData.abv}
                  onChange={(e) => handleChange('abv', e.target.value)}
                  placeholder="e.g., 40, 43.5"
                  fullWidth
                  error={fieldErrors.abv}
                />
              </div>

              {/* Location & Age */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Location & Age</h3>
                <Input
                  label="Distillery Location"
                  value={formData.distillery_location}
                  onChange={(e) => handleChange('distillery_location', e.target.value)}
                  placeholder="e.g., Kentucky, USA"
                  fullWidth
                />
                <Input
                  label="Age Statement or Barrel Finish"
                  value={formData.age_statement}
                  onChange={(e) => handleChange('age_statement', e.target.value)}
                  placeholder="e.g., 12 Year, Sherry Cask Finish"
                  fullWidth
                />
              </div>

              {/* Tasting Profile */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Tasting Profile</h3>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Profile (Nose)</label>
                  <textarea
                    className={styles.textarea}
                    value={formData.profile_nose}
                    onChange={(e) => handleChange('profile_nose', e.target.value)}
                    placeholder="Aroma notes, e.g., vanilla, oak, caramel"
                    rows={2}
                  />
                </div>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Palate</label>
                  <textarea
                    className={styles.textarea}
                    value={formData.palate}
                    onChange={(e) => handleChange('palate', e.target.value)}
                    placeholder="Flavor notes, e.g., honey, spice, fruit"
                    rows={2}
                  />
                </div>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Finish</label>
                  <textarea
                    className={styles.textarea}
                    value={formData.finish}
                    onChange={(e) => handleChange('finish', e.target.value)}
                    placeholder="Finish notes, e.g., long, smooth, warming"
                    rows={2}
                  />
                </div>
              </div>

              {/* Additional Notes */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Additional Information</h3>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Additional Notes</label>
                  <textarea
                    className={styles.textarea}
                    value={formData.additional_notes}
                    onChange={(e) => handleChange('additional_notes', e.target.value)}
                    placeholder="Any other notes or comments"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className={styles.error}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? (
                <>
                  <Spinner size="sm" color="white" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </>
  );
}
