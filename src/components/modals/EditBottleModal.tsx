'use client';

import { useState, useEffect, useRef } from 'react';
import { Edit2, X, AlertCircle } from 'lucide-react';
import { Button, Input, Spinner, SuccessCheckmark } from '@/components/ui';
import type { Bottle } from '@/types';
import styles from './BottleFormModal.module.css';

interface EditBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottle: Bottle | null;
  onUpdate: (id: number, bottle: Partial<Bottle>) => Promise<void>;
}

export function EditBottleModal({ isOpen, onClose, bottle, onUpdate }: EditBottleModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    'Stock Number': '',
    'Liquor Type': '',
    'Detailed Spirit Classification': '',
    'Distillation Method': '',
    'ABV (%)': '',
    'Distillery Location': '',
    'Age Statement or Barrel Finish': '',
    'Additional Notes': '',
    'Profile (Nose)': '',
    'Palate': '',
    'Finish': '',
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
      setFormData({
        name: bottle.name || '',
        'Stock Number': bottle['Stock Number']?.toString() || '',
        'Liquor Type': bottle['Liquor Type'] || '',
        'Detailed Spirit Classification': bottle['Detailed Spirit Classification'] || '',
        'Distillation Method': bottle['Distillation Method'] || '',
        'ABV (%)': bottle['ABV (%)']?.toString() || '',
        'Distillery Location': bottle['Distillery Location'] || '',
        'Age Statement or Barrel Finish': bottle['Age Statement or Barrel Finish'] || '',
        'Additional Notes': bottle['Additional Notes'] || '',
        'Profile (Nose)': bottle['Profile (Nose)'] || '',
        'Palate': bottle['Palate'] || '',
        'Finish': bottle['Finish'] || '',
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
      case 'Stock Number': {
        if (!value) return '';
        const num = parseInt(value);
        if (isNaN(num)) return 'Must be a valid number';
        if (num < 0) return 'Cannot be negative';
        return '';
      }
      case 'ABV (%)': {
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
      const updates: Partial<Bottle> = {
        name: formData.name,
        'Stock Number': formData['Stock Number'] ? parseInt(formData['Stock Number']) : undefined,
        'Liquor Type': formData['Liquor Type'] || undefined,
        'Detailed Spirit Classification': formData['Detailed Spirit Classification'] || undefined,
        'Distillation Method': formData['Distillation Method'] || undefined,
        'ABV (%)': formData['ABV (%)'] || undefined,
        'Distillery Location': formData['Distillery Location'] || undefined,
        'Age Statement or Barrel Finish': formData['Age Statement or Barrel Finish'] || undefined,
        'Additional Notes': formData['Additional Notes'] || undefined,
        'Profile (Nose)': formData['Profile (Nose)'] || undefined,
        'Palate': formData['Palate'] || undefined,
        'Finish': formData['Finish'] || undefined,
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
                  type="number"
                  value={formData['Stock Number']}
                  onChange={(e) => handleChange('Stock Number', e.target.value)}
                  placeholder="e.g., 123"
                  fullWidth
                  error={fieldErrors['Stock Number']}
                />
                <Input
                  label="Liquor Type"
                  value={formData['Liquor Type']}
                  onChange={(e) => handleChange('Liquor Type', e.target.value)}
                  placeholder="e.g., Whiskey, Rum, Gin"
                  fullWidth
                />
              </div>

              {/* Classification & Details */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Classification & Details</h3>
                <Input
                  label="Detailed Spirit Classification"
                  value={formData['Detailed Spirit Classification']}
                  onChange={(e) => handleChange('Detailed Spirit Classification', e.target.value)}
                  placeholder="e.g., Kentucky Straight Bourbon"
                  fullWidth
                />
                <Input
                  label="Distillation Method"
                  value={formData['Distillation Method']}
                  onChange={(e) => handleChange('Distillation Method', e.target.value)}
                  placeholder="e.g., Pot Still, Column Still"
                  fullWidth
                />
                <Input
                  label="ABV (%)"
                  value={formData['ABV (%)']}
                  onChange={(e) => handleChange('ABV (%)', e.target.value)}
                  placeholder="e.g., 40, 43.5"
                  fullWidth
                  error={fieldErrors['ABV (%)']}
                />
              </div>

              {/* Location & Age */}
              <div className={styles.formSection}>
                <h3 className={styles.sectionTitle}>Location & Age</h3>
                <Input
                  label="Distillery Location"
                  value={formData['Distillery Location']}
                  onChange={(e) => handleChange('Distillery Location', e.target.value)}
                  placeholder="e.g., Kentucky, USA"
                  fullWidth
                />
                <Input
                  label="Age Statement or Barrel Finish"
                  value={formData['Age Statement or Barrel Finish']}
                  onChange={(e) => handleChange('Age Statement or Barrel Finish', e.target.value)}
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
                    value={formData['Profile (Nose)']}
                    onChange={(e) => handleChange('Profile (Nose)', e.target.value)}
                    placeholder="Aroma notes, e.g., vanilla, oak, caramel"
                    rows={2}
                  />
                </div>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Palate</label>
                  <textarea
                    className={styles.textarea}
                    value={formData['Palate']}
                    onChange={(e) => handleChange('Palate', e.target.value)}
                    placeholder="Flavor notes, e.g., honey, spice, fruit"
                    rows={2}
                  />
                </div>
                <div className={styles.textareaWrapper}>
                  <label className={styles.textareaLabel}>Finish</label>
                  <textarea
                    className={styles.textarea}
                    value={formData['Finish']}
                    onChange={(e) => handleChange('Finish', e.target.value)}
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
                    value={formData['Additional Notes']}
                    onChange={(e) => handleChange('Additional Notes', e.target.value)}
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
