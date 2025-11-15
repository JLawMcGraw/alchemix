'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import { Button, Input, Spinner, SuccessCheckmark } from '@/components/ui';
import type { Bottle } from '@/types';
import styles from './BottleFormModal.module.css';

interface AddBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (bottle: Omit<Bottle, 'id'>) => Promise<void>;
}

export function AddBottleModal({ isOpen, onClose, onAdd }: AddBottleModalProps) {
  const [formData, setFormData] = useState({
    Spirit: '',
    Brand: '',
    'Age/Type': '',
    'Quantity (ml)': '',
    'Cost ($)': '',
    'Date Added': new Date().toISOString().split('T')[0],
    'Date Opened': '',
    'Estimated Remaining (ml)': '',
    'Restock Threshold (ml)': '200',
    Location: '',
    'Tasting Notes': '',
    Tags: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus management and keyboard shortcuts
  useEffect(() => {
    if (isOpen) {
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

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'Spirit':
        return !value.trim() ? 'Spirit type is required' : '';
      case 'Brand':
        return !value.trim() ? 'Brand is required' : '';
      case 'Quantity (ml)': {
        const num = parseFloat(value);
        if (!value) return 'Quantity is required';
        if (isNaN(num)) return 'Must be a valid number';
        if (num <= 0) return 'Must be greater than 0';
        if (num > 5000) return 'Unusually large bottle size';
        return '';
      }
      case 'Cost ($)': {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return 'Must be a valid number';
        if (num < 0) return 'Cannot be negative';
        return '';
      }
      case 'Date Added': {
        if (!value) return 'Date added is required';
        const date = new Date(value);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (date > today) return 'Cannot be in the future';
        return '';
      }
      case 'Date Opened': {
        if (!value) return '';
        const dateOpened = new Date(value);
        const dateAdded = new Date(formData['Date Added']);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (dateOpened > today) return 'Cannot be in the future';
        if (formData['Date Added'] && dateOpened < dateAdded) return 'Cannot be before date added';
        return '';
      }
      case 'Estimated Remaining (ml)': {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return 'Must be a valid number';
        if (num < 0) return 'Cannot be negative';
        const quantity = parseFloat(formData['Quantity (ml)']);
        if (!isNaN(quantity) && num > quantity) return 'Cannot exceed bottle quantity';
        return '';
      }
      case 'Restock Threshold (ml)': {
        if (!value) return '';
        const num = parseFloat(value);
        if (isNaN(num)) return 'Must be a valid number';
        if (num < 0) return 'Cannot be negative';
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
      // Map form data to Bottle type fields
      const bottle: Omit<Bottle, 'id'> = {
        name: formData.Spirit || '', // Use Spirit as the bottle name
        'Liquor Type': formData.Brand || '', // Map Brand to Liquor Type for now
        'Detailed Spirit Classification': formData['Age/Type'] || '',
        'ABV (%)': '', // Not in form
        'Additional Notes': formData['Tasting Notes'] || '',
      };

      await onAdd(bottle);
      setIsDirty(false); // Reset dirty flag on successful save
      setShowSuccess(true); // Show success animation
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to add bottle');
      } else {
        setError('Failed to add bottle');
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

    setFormData({
      Spirit: '',
      Brand: '',
      'Age/Type': '',
      'Quantity (ml)': '',
      'Cost ($)': '',
      'Date Added': new Date().toISOString().split('T')[0],
      'Date Opened': '',
      'Estimated Remaining (ml)': '',
      'Restock Threshold (ml)': '200',
      Location: '',
      'Tasting Notes': '',
      Tags: '',
    });
    setError(null);
    setLoading(false);
    setIsDirty(false);
    onClose();
  };

  return (
    <>
      {showSuccess && (
        <SuccessCheckmark
          message="Bottle added successfully!"
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
            Add New Bottle
          </h2>
          <button
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.content} id="add-bottle-desc">
            <div className={styles.formGrid}>
              {/* Required Fields */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Basic Information</h3>
                <Input
                  ref={firstInputRef}
                  label="Spirit Type *"
                  value={formData.Spirit}
                  onChange={(e) => handleChange('Spirit', e.target.value)}
                  placeholder="e.g., Whiskey, Rum, Gin"
                  required
                  fullWidth
                  error={fieldErrors.Spirit}
                />
                <Input
                  label="Brand *"
                  value={formData.Brand}
                  onChange={(e) => handleChange('Brand', e.target.value)}
                  placeholder="e.g., Maker's Mark"
                  required
                  fullWidth
                  error={fieldErrors.Brand}
                />
                <Input
                  label="Age/Type"
                  value={formData['Age/Type']}
                  onChange={(e) => handleChange('Age/Type', e.target.value)}
                  placeholder="e.g., 12 Year, VSOP"
                  fullWidth
                />
              </div>

              {/* Quantity & Cost */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Quantity & Cost</h3>
                <div className={styles.formRow}>
                  <Input
                    label="Quantity (ml) *"
                    type="number"
                    value={formData['Quantity (ml)']}
                    onChange={(e) => handleChange('Quantity (ml)', e.target.value)}
                    placeholder="750"
                    required
                    fullWidth
                    error={fieldErrors['Quantity (ml)']}
                  />
                  <Input
                    label="Cost ($)"
                    type="number"
                    step="0.01"
                    value={formData['Cost ($)']}
                    onChange={(e) => handleChange('Cost ($)', e.target.value)}
                    placeholder="45.00"
                    fullWidth
                    error={fieldErrors['Cost ($)']}
                  />
                </div>
                <div className={styles.formRow}>
                  <Input
                    label="Estimated Remaining (ml)"
                    type="number"
                    value={formData['Estimated Remaining (ml)']}
                    onChange={(e) => handleChange('Estimated Remaining (ml)', e.target.value)}
                    placeholder="Leave empty if unopened"
                    fullWidth
                    error={fieldErrors['Estimated Remaining (ml)']}
                  />
                  <Input
                    label="Restock Threshold (ml)"
                    type="number"
                    value={formData['Restock Threshold (ml)']}
                    onChange={(e) => handleChange('Restock Threshold (ml)', e.target.value)}
                    placeholder="200"
                    fullWidth
                    error={fieldErrors['Restock Threshold (ml)']}
                  />
                </div>
              </div>

              {/* Dates & Location */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Dates & Location</h3>
                <div className={styles.formRow}>
                  <Input
                    label="Date Added *"
                    type="date"
                    value={formData['Date Added']}
                    onChange={(e) => handleChange('Date Added', e.target.value)}
                    required
                    fullWidth
                    error={fieldErrors['Date Added']}
                  />
                  <Input
                    label="Date Opened"
                    type="date"
                    value={formData['Date Opened']}
                    onChange={(e) => handleChange('Date Opened', e.target.value)}
                    fullWidth
                    error={fieldErrors['Date Opened']}
                  />
                </div>
                <Input
                  label="Location"
                  value={formData.Location}
                  onChange={(e) => handleChange('Location', e.target.value)}
                  placeholder="e.g., Top shelf, Cabinet A"
                  fullWidth
                />
              </div>

              {/* Notes & Tags */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Additional Details</h3>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Tasting Notes</label>
                  <textarea
                    className={styles.textarea}
                    value={formData['Tasting Notes']}
                    onChange={(e) => handleChange('Tasting Notes', e.target.value)}
                    placeholder="Notes about flavor, aroma, etc."
                    rows={3}
                  />
                </div>
                <Input
                  label="Tags"
                  value={formData.Tags}
                  onChange={(e) => handleChange('Tags', e.target.value)}
                  placeholder="e.g., smooth, smoky, gift"
                  fullWidth
                />
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
                'Add Bottle'
              )}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </>
  );
}
