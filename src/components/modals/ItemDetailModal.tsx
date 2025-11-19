'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Wine, Edit2, Save, Trash2 } from 'lucide-react';
import { Button, Input, useToast } from '@/components/ui';
import { useStore } from '@/lib/store';
import type { InventoryCategory, InventoryItem } from '@/types';
import styles from './ItemDetailModal.module.css';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}

export function ItemDetailModal({
  isOpen,
  onClose,
  item
}: ItemDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedItem, setEditedItem] = useState<Partial<InventoryItem>>({});
  const { updateItem, deleteItem, fetchItems } = useStore();
  const { showToast } = useToast();

  // Initialize edit form when item changes
  useEffect(() => {
    if (item && isOpen) {
      setEditedItem({
        name: item.name,
        category: item.category,
        type: item.type,
        abv: item.abv,
        'Stock Number': item['Stock Number'],
        'Detailed Spirit Classification': item['Detailed Spirit Classification'],
        'Distillation Method': item['Distillation Method'],
        'Distillery Location': item['Distillery Location'],
        'Age Statement or Barrel Finish': item['Age Statement or Barrel Finish'],
        'Additional Notes': item['Additional Notes'],
        'Profile (Nose)': item['Profile (Nose)'],
        Palate: item.Palate,
        Finish: item.Finish,
      });
      setIsEditMode(false);

      // Reset scroll position
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  }, [item, isOpen]);

  // Handle save
  const handleSave = async () => {
    if (!item?.id) return;

    try {
      await updateItem(item.id, editedItem);
      await fetchItems();
      setIsEditMode(false);
      showToast('success', 'Item updated successfully');
    } catch (error) {
      showToast('error', 'Failed to update item');
      console.error('Failed to update item:', error);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!item?.id) return;

    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

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

  // Handle cancel edit
  const handleCancel = () => {
    if (item) {
      setEditedItem({
        name: item.name,
        category: item.category,
        type: item.type,
        abv: item.abv,
        'Stock Number': item['Stock Number'],
        'Detailed Spirit Classification': item['Detailed Spirit Classification'],
        'Distillation Method': item['Distillation Method'],
        'Distillery Location': item['Distillery Location'],
        'Age Statement or Barrel Finish': item['Age Statement or Barrel Finish'],
        'Additional Notes': item['Additional Notes'],
        'Profile (Nose)': item['Profile (Nose)'],
        Palate: item.Palate,
        Finish: item.Finish,
      });
    }
    setIsEditMode(false);
  };

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
  }, [isOpen, isEditMode, onClose]);

  if (!isOpen || !item) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-labelledby="item-detail-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <Wine size={28} className={styles.titleIcon} />
            <div>
              {isEditMode ? (
                <input
                  type="text"
                  value={editedItem.name || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })}
                  className={styles.titleInput}
                  placeholder="Item name"
                />
              ) : (
                <h2 className={styles.title} id="item-detail-title">{item.name}</h2>
              )}
              <div className={styles.categoryBadge}>
                {isEditMode ? (
                  <select
                    value={editedItem.category || 'spirit'}
                    onChange={(e) =>
                      setEditedItem({ ...editedItem, category: e.target.value as InventoryCategory })
                    }
                    className={styles.categorySelect}
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
                ) : (
                  <span className={styles.category}>{item.category}</span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.headerActions}>
            {isEditMode ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave}>
                  <Save size={16} />
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                  <Edit2 size={16} />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={handleDelete} className={styles.deleteBtn}>
                  <Trash2 size={16} />
                  Delete
                </Button>
              </>
            )}
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content} ref={contentRef}>
          {/* Basic Information */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Basic Information</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Type</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={editedItem.type || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, type: e.target.value })}
                    className={styles.input}
                    placeholder="e.g., Bourbon, Gin"
                  />
                ) : (
                  <p className={styles.value}>{item.type || '-'}</p>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>ABV</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={editedItem.abv || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, abv: e.target.value })}
                    className={styles.input}
                    placeholder="e.g., 40%"
                  />
                ) : (
                  <p className={styles.value}>
                    {item.abv ? `${item.abv}${item.abv.toString().includes('%') ? '' : '%'}` : '-'}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Stock Number</label>
                {isEditMode ? (
                  <input
                    type="number"
                    value={editedItem['Stock Number'] || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, 'Stock Number': parseInt(e.target.value) || undefined })}
                    className={styles.input}
                    placeholder="e.g., 123"
                  />
                ) : (
                  <p className={styles.value}>{item['Stock Number'] || '-'}</p>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Detailed Classification</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={editedItem['Detailed Spirit Classification'] || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, 'Detailed Spirit Classification': e.target.value })}
                    className={styles.input}
                    placeholder="e.g., Kentucky Straight Bourbon"
                  />
                ) : (
                  <p className={styles.value}>{item['Detailed Spirit Classification'] || '-'}</p>
                )}
              </div>
            </div>
          </section>

          {/* Production Details */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Production Details</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Distillation Method</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={editedItem['Distillation Method'] || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, 'Distillation Method': e.target.value })}
                    className={styles.input}
                    placeholder="e.g., Pot Still, Column Still"
                  />
                ) : (
                  <p className={styles.value}>{item['Distillation Method'] || '-'}</p>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Distillery Location</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={editedItem['Distillery Location'] || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, 'Distillery Location': e.target.value })}
                    className={styles.input}
                    placeholder="e.g., Kentucky, USA"
                  />
                ) : (
                  <p className={styles.value}>{item['Distillery Location'] || '-'}</p>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Age Statement or Barrel Finish</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={editedItem['Age Statement or Barrel Finish'] || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, 'Age Statement or Barrel Finish': e.target.value })}
                    className={styles.input}
                    placeholder="e.g., 12 Year, Sherry Cask"
                  />
                ) : (
                  <p className={styles.value}>{item['Age Statement or Barrel Finish'] || '-'}</p>
                )}
              </div>
            </div>
          </section>

          {/* Tasting Profile */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Tasting Profile</h3>
            <div className={styles.field}>
              <label className={styles.label}>Profile (Nose)</label>
              {isEditMode ? (
                <textarea
                  value={editedItem['Profile (Nose)'] || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, 'Profile (Nose)': e.target.value })}
                  className={styles.textarea}
                  placeholder="Aroma notes, e.g., vanilla, oak, caramel"
                  rows={3}
                />
              ) : (
                <p className={styles.value}>{item['Profile (Nose)'] || '-'}</p>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Palate</label>
              {isEditMode ? (
                <textarea
                  value={editedItem.Palate || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, Palate: e.target.value })}
                  className={styles.textarea}
                  placeholder="Flavor notes, e.g., honey, spice, fruit"
                  rows={3}
                />
              ) : (
                <p className={styles.value}>{item.Palate || '-'}</p>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Finish</label>
              {isEditMode ? (
                <textarea
                  value={editedItem.Finish || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, Finish: e.target.value })}
                  className={styles.textarea}
                  placeholder="Finish notes, e.g., long, smooth, warming"
                  rows={3}
                />
              ) : (
                <p className={styles.value}>{item.Finish || '-'}</p>
              )}
            </div>
          </section>

          {/* Additional Notes */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Additional Notes</h3>
            <div className={styles.field}>
              {isEditMode ? (
                <textarea
                  value={editedItem['Additional Notes'] || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, 'Additional Notes': e.target.value })}
                  className={styles.textarea}
                  placeholder="Any other notes or comments"
                  rows={4}
                />
              ) : (
                <p className={styles.value}>{item['Additional Notes'] || '-'}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
