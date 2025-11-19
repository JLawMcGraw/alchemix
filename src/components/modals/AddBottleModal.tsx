'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import { Button, Input, Spinner, SuccessCheckmark } from '@/components/ui';
import type { InventoryCategory, InventoryItem } from '@/types';
import styles from './BottleFormModal.module.css';

interface AddBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
}

type FormState = {
  name: string;
  category: InventoryCategory;
  type: string;
  abv: string;
  'Stock Number': string;
  'Detailed Spirit Classification': string;
  'Distillation Method': string;
  'Distillery Location': string;
  'Age Statement or Barrel Finish': string;
  'Additional Notes': string;
  'Profile (Nose)': string;
  Palate: string;
  Finish: string;
};

const createInitialFormState = (): FormState => ({
  name: '',
  category: 'spirit',
  type: '',
  abv: '',
  'Stock Number': '',
  'Detailed Spirit Classification': '',
  'Distillation Method': '',
  'Distillery Location': '',
  'Age Statement or Barrel Finish': '',
  'Additional Notes': '',
  'Profile (Nose)': '',
  Palate: '',
  Finish: '',
});

export function AddBottleModal({ isOpen, onClose, onAdd }: AddBottleModalProps) {
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
  }, [isOpen]);

  if (!isOpen) return null;

  const validateField = (field: string, value: string | InventoryCategory): string => {
    switch (field) {
      case 'name':
        return !value.trim() ? 'Name is required' : '';
      case 'category':
        const validCategories = ['spirit', 'liqueur', 'mixer', 'garnish', 'syrup', 'wine', 'beer', 'other'];
        return !validCategories.includes(value) ? 'Invalid category' : '';
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

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true); // Mark form as dirty

    // Validate the field
    const error = validateField(field, value as string);
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
      // Map form data to InventoryItem type
      const item: Omit<InventoryItem, 'id'> = {
        name: formData.name,
        category: formData.category,
        type: formData.type || undefined,
        abv: formData.abv || undefined,
        'Stock Number': formData['Stock Number'] ? parseInt(formData['Stock Number']) : undefined,
        'Detailed Spirit Classification': formData['Detailed Spirit Classification'] || undefined,
        'Distillation Method': formData['Distillation Method'] || undefined,
        'Distillery Location': formData['Distillery Location'] || undefined,
        'Age Statement or Barrel Finish': formData['Age Statement or Barrel Finish'] || undefined,
        'Additional Notes': formData['Additional Notes'] || undefined,
        'Profile (Nose)': formData['Profile (Nose)'] || undefined,
        Palate: formData.Palate || undefined,
        Finish: formData.Finish || undefined,
      };

      await onAdd(item);
      setIsDirty(false); // Reset dirty flag on successful save
      setShowSuccess(true); // Show success animation
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

  const handleClose = () => {
    // Confirm if there are unsaved changes
    if (isDirty && !loading) {
      const confirmClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close this form?'
      );
      if (!confirmClose) return;
    }

    setFormData(createInitialFormState());
    setError(null);
    setLoading(false);
    setIsDirty(false);
    setShowSuccess(false);
    onClose();
  };

  return (
    <>
      {showSuccess && (
        <SuccessCheckmark
          message="Item added successfully!"
          onComplete={handleClose}
        />
      )}
      <div className={styles.overlay} onClick={handleClose}>
        <div
          className={styles.modal}
          onClick={(e) => e.stopPropagation()}
          ref={modalRef}
        role="dialog"
        aria-labelledby="add-bottle-title"
        aria-describedby="add-bottle-desc"
        aria-modal="true"
      >
        <div className={styles.header}>
          <h2 className={styles.title} id="add-bottle-title">
            <Plus size={24} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
            Add New Item
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
          <div className={styles.content} id="add-bottle-desc">
            <div className={styles.formGrid}>
              {/* Required Fields */}
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
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value as InventoryCategory)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '14px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'var(--color-ui-bg-surface)',
                      color: 'var(--color-text-body)',
                    }}
                  >
                    <option value="spirit">Spirit</option>
                    <option value="liqueur">Liqueur</option>
                    <option value="mixer">Mixer</option>
                    <option value="garnish">Garnish</option>
                    <option value="syrup">Syrup</option>
                    <option value="wine">Wine</option>
                    <option value="beer">Beer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <Input
                  label="Type"
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  placeholder="e.g., Bourbon, Gin, Citrus"
                  fullWidth
                />
                <Input
                  label="ABV (%)"
                  type="number"
                  step="0.1"
                  value={formData.abv}
                  onChange={(e) => handleChange('abv', e.target.value)}
                  placeholder="e.g., 40"
                  fullWidth
                  error={fieldErrors.abv}
                />
              </div>

              {/* Optional Details for Spirits */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Additional Details (Optional)</h3>
                <Input
                  label="Detailed Classification"
                  value={formData['Detailed Spirit Classification']}
                  onChange={(e) => handleChange('Detailed Spirit Classification', e.target.value)}
                  placeholder="e.g., Single Malt Scotch"
                  fullWidth
                />
                <Input
                  label="Age Statement / Barrel Finish"
                  value={formData['Age Statement or Barrel Finish']}
                  onChange={(e) => handleChange('Age Statement or Barrel Finish', e.target.value)}
                  placeholder="e.g., 12 Year, VSOP"
                  fullWidth
                />
                <Input
                  label="Distillery Location"
                  value={formData['Distillery Location']}
                  onChange={(e) => handleChange('Distillery Location', e.target.value)}
                  placeholder="e.g., Kentucky, Scotland"
                  fullWidth
                />
              </div>

              {/* Tasting Notes */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Tasting Notes (Optional)</h3>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Nose</label>
                  <textarea
                    className={styles.textarea}
                    value={formData['Profile (Nose)']}
                    onChange={(e) => handleChange('Profile (Nose)', e.target.value)}
                    placeholder="Aroma and scent profile"
                    rows={2}
                  />
                </div>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Palate</label>
                  <textarea
                    className={styles.textarea}
                    value={formData.Palate}
                    onChange={(e) => handleChange('Palate', e.target.value)}
                    placeholder="Taste and flavor profile"
                    rows={2}
                  />
                </div>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Finish</label>
                  <textarea
                    className={styles.textarea}
                    value={formData.Finish}
                    onChange={(e) => handleChange('Finish', e.target.value)}
                    placeholder="Aftertaste and lingering notes"
                    rows={2}
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
                  <Spinner size="sm" color="white" /> Adding...
                </>
              ) : (
                'Add Item'
              )}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </>
  );
}
