'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import type { Collection } from '@/types';
import styles from './DeleteConfirmModal.module.css'; // Reuse delete modal styles

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (collection: Collection) => Promise<void>;
  collection?: Collection | null; // If provided, edit mode
}

export function CollectionModal({
  isOpen,
  onClose,
  onSubmit,
  collection,
}: CollectionModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!collection;

  useEffect(() => {
    if (isOpen) {
      if (collection) {
        setFormData({
          name: collection.name || '',
          description: collection.description || '',
        });
      } else {
        setFormData({ name: '', description: '' });
      }

      // Focus name input
      setTimeout(() => nameInputRef.current?.focus(), 100);

      // Lock body scroll
      document.body.style.overflow = 'hidden';

      // Handle ESC key
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSubmitting) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, collection, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const collectionData: Collection = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };

      if (isEditMode && collection?.id) {
        collectionData.id = collection.id;
      }

      await onSubmit(collectionData);
      setFormData({ name: '', description: '' });
      onClose();
    } catch (error) {
      console.error('Failed to save collection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div
        className={styles.modal}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="collection-modal-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title} id="collection-modal-title">
            <BookOpen size={24} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
            {isEditMode ? 'Edit Collection' : 'Create Collection'}
          </h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className={styles.content}>
            <p className={styles.message} style={{ marginBottom: '20px' }}>
              {isEditMode
                ? 'Update your collection details.'
                : 'Create a new collection to organize your recipes into groups or books.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input
                ref={nameInputRef}
                label="Collection Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Classic Cocktails, Tiki Drinks"
                required
                maxLength={100}
                disabled={isSubmitting}
              />

              <div>
                <label
                  htmlFor="collection-description"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--color-text-body)',
                  }}
                >
                  Description (optional)
                </label>
                <textarea
                  id="collection-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="A brief description of this collection..."
                  maxLength={500}
                  rows={3}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-body)',
                    backgroundColor: 'var(--color-ui-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    resize: 'vertical',
                    minHeight: '80px',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !formData.name.trim()}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
