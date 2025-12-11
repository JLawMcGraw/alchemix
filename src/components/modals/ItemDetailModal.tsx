'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { X, Pencil, Plus, Minus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/ui';
import type { InventoryCategory, InventoryItem } from '@/types';
import styles from './ItemDetailModal.module.css';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}

type FormState = {
  name: string;
  category: InventoryCategory;
  type: string;
  quantity: number;
  abv: string;
  origin: string;
  tasting_notes: string; // Combined nose/palate/finish for AI recommendations
};

const CATEGORY_COLORS: Record<string, string> = {
  spirit: '#D97706',
  liqueur: '#8B5CF6',
  mixer: '#0EA5E9',
  syrup: '#6366F1',
  garnish: '#10B981',
  wine: '#BE185D',
  beer: '#CA8A04',
  other: '#94A3B8',
};

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: 'spirit', label: 'Spirit' },
  { value: 'liqueur', label: 'Liqueur' },
  { value: 'mixer', label: 'Mixer' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'garnish', label: 'Garnish' },
  { value: 'wine', label: 'Wine' },
  { value: 'beer', label: 'Beer' },
  { value: 'other', label: 'Other' },
];

export function ItemDetailModal({ isOpen, onClose, item }: ItemDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { updateItem, deleteItem, fetchItems } = useStore();
  const { showToast } = useToast();

  // Form state
  const [formData, setFormData] = useState<FormState>({
    name: '',
    category: 'spirit',
    type: '',
    quantity: 1,
    abv: '',
    origin: '',
    tasting_notes: '',
  });

  // Original data for comparison
  const [originalData, setOriginalData] = useState<FormState | null>(null);

  // Initialize form when item changes
  useEffect(() => {
    if (item && isOpen) {
      // Combine existing flavor profile fields into tasting_notes if present
      let combinedNotes = item.tasting_notes || '';
      if (!combinedNotes && (item.profile_nose || item.palate || item.finish)) {
        const parts: string[] = [];
        if (item.profile_nose) parts.push(`Nose: ${item.profile_nose}`);
        if (item.palate) parts.push(`Palate: ${item.palate}`);
        if (item.finish) parts.push(`Finish: ${item.finish}`);
        combinedNotes = parts.join('\n');
      }

      const data: FormState = {
        name: item.name || '',
        category: item.category || 'spirit',
        type: item.type || '',
        quantity: item.stock_number ?? 1,
        abv: item.abv?.toString() || '',
        origin: item.distillery_location || '',
        tasting_notes: combinedNotes,
      };
      setFormData(data);
      setOriginalData(data);
      setIsEditMode(false);
      setShowDeleteConfirm(false);

      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  }, [item, isOpen]);

  // Track unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!originalData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  }, [formData, originalData]);

  // Keyboard handling
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (isEditMode) {
            handleCancel();
          } else {
            handleClose();
          }
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
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isEditMode]);

  if (!isOpen || !item) return null;

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuantityChange = (delta: number) => {
    const newValue = Math.max(0, formData.quantity + delta);
    handleChange('quantity', newValue);
  };

  const handleSave = async () => {
    if (!item?.id || !hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      await updateItem(item.id, {
        name: formData.name,
        category: formData.category,
        type: formData.type || undefined,
        stock_number: formData.quantity,
        abv: formData.abv || undefined,
        distillery_location: formData.origin || undefined,
        tasting_notes: formData.tasting_notes || undefined,
      });
      await fetchItems();
      setOriginalData(formData);
      setIsEditMode(false);
      showToast('success', 'Item updated successfully');
    } catch (error) {
      showToast('error', 'Failed to update item');
      console.error('Failed to update item:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm('Discard unsaved changes?')) return;
    }
    if (originalData) {
      setFormData(originalData);
    }
    setIsEditMode(false);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!confirm('Discard unsaved changes?')) return;
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!item?.id) return;

    try {
      await deleteItem(item.id);
      await fetchItems();
      showToast('success', 'Item deleted successfully');
      onClose();
    } catch (error) {
      showToast('error', 'Failed to delete item');
      console.error('Failed to delete item:', error);
    }
  };

  const categoryColor = CATEGORY_COLORS[formData.category] || '#94A3B8';

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-labelledby="item-detail-title"
        aria-modal="true"
      >
        {/* Header with category color stripe */}
        <div
          className={styles.header}
          style={{ borderTopColor: categoryColor }}
        >
          <div className={styles.headerContent}>
            {/* Edit Label (edit mode only) */}
            {isEditMode && (
              <span className={styles.editingLabel}>Editing</span>
            )}

            {/* Name */}
            {isEditMode ? (
              <input
                type="text"
                className={styles.nameInput}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Item name"
              />
            ) : (
              <h2 className={styles.title} id="item-detail-title">
                {formData.name}
              </h2>
            )}

            {/* Category Badge - colored tag below name */}
            {!isEditMode && (
              <span
                className={styles.categoryBadge}
                style={{
                  backgroundColor: `${categoryColor}15`,
                  color: categoryColor,
                }}
              >
                {formData.category}
              </span>
            )}
          </div>

          {/* Header Actions */}
          <div className={styles.headerActions}>
            {!isEditMode && (
              <button
                className={styles.editBtn}
                onClick={() => setIsEditMode(true)}
                title="Edit item"
                type="button"
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              className={styles.closeBtn}
              onClick={handleClose}
              aria-label="Close"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quantity Section - Always interactive, no background */}
        <div className={styles.quantitySection}>
          <div className={styles.quantityInfo}>
            <div className={styles.quantityLabel}>In Stock</div>
            <div className={styles.quantityHint}>
              {formData.quantity === 0
                ? 'Out of stock'
                : `${formData.quantity} bottle${formData.quantity !== 1 ? 's' : ''}`}
            </div>
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
            <span className={styles.quantityValue}>{formData.quantity}</span>
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

        {/* Content */}
        <div className={styles.content} ref={contentRef}>
          {isEditMode ? (
            /* ===== EDIT MODE ===== */
            <div className={styles.editContent}>
              {/* Category */}
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

              {/* Type */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Type</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g., Bourbon, London Dry"
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                />
              </div>

              {/* ABV */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>ABV %</label>
                <input
                  type="text"
                  className={`${styles.input} ${styles.inputSmall}`}
                  placeholder="40"
                  value={formData.abv}
                  onChange={(e) => handleChange('abv', e.target.value.replace(/[^0-9.]/g, ''))}
                />
              </div>

              {/* Origin */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Origin / Distillery</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g., Kentucky, Islay"
                  value={formData.origin}
                  onChange={(e) => handleChange('origin', e.target.value)}
                />
              </div>

              {/* Tasting Notes */}
              <div className={styles.fieldGroup}>
                <div className={styles.labelRow}>
                  <label className={styles.label}>Tasting Notes</label>
                  <span className={styles.labelHint}>Helps AI recommend cocktails</span>
                </div>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  placeholder="Nose: Vanilla, caramel, oak&#10;Palate: Rich, spicy, honey&#10;Finish: Long, warm, oaky"
                  value={formData.tasting_notes}
                  onChange={(e) => handleChange('tasting_notes', e.target.value)}
                />
              </div>
            </div>
          ) : (
            /* ===== VIEW MODE ===== */
            <div className={styles.viewContent}>
              {/* Details rows - Type, ABV, Origin */}
              {(formData.type || formData.abv || formData.origin) && (
                <div className={styles.detailsList}>
                  {formData.type && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Type</span>
                      <span className={styles.detailValue}>{formData.type}</span>
                    </div>
                  )}
                  {formData.abv && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>ABV</span>
                      <span className={styles.detailValueMono}>{formData.abv}%</span>
                    </div>
                  )}
                  {formData.origin && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Origin</span>
                      <span className={styles.detailValue}>{formData.origin}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tasting Notes */}
              {formData.tasting_notes && (
                <div className={styles.notesSection}>
                  <div className={styles.notesLabel}>Tasting Notes</div>
                  <p className={styles.notesText}>{formData.tasting_notes}</p>
                </div>
              )}

              {/* Empty state */}
              {!formData.type && !formData.abv && !formData.origin && !formData.tasting_notes && (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>No additional details</p>
                  <button
                    className={styles.addDetailsBtn}
                    onClick={() => setIsEditMode(true)}
                    type="button"
                  >
                    Add Details
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className={styles.deleteConfirm}>
              <p className={styles.deleteConfirmText}>
                Delete &ldquo;{formData.name}&rdquo; from your bar?
              </p>
              <div className={styles.deleteConfirmActions}>
                <button
                  type="button"
                  className={styles.deleteConfirmCancel}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.deleteConfirmBtn}
                  onClick={handleDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {!showDeleteConfirm && (
            <>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </button>
              <div className={styles.footerActions}>
                {isEditMode && (
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.saveBtn} ${hasUnsavedChanges ? styles.saveBtnActive : ''}`}
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges || isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
