'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Spinner } from '@/components/ui';
import styles from './DeleteConfirmModal.module.css';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options?: { deleteRelated?: boolean }) => Promise<void>;
  title: string;
  message: string;
  warningMessage?: string;
  /** Optional checkbox for deleting related items */
  checkboxOption?: {
    label: string;
    description?: string;
  };
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  warningMessage,
  checkboxOption,
}: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [deleteRelated, setDeleteRelated] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Reset checkbox state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeleteRelated(false);
    }
  }, [isOpen]);

  // Focus management and keyboard shortcuts
  useEffect(() => {
    if (isOpen) {
      // Auto-focus cancel button (safer for delete actions)
      setTimeout(() => cancelButtonRef.current?.focus(), 100);

      // Handle keyboard events
      const handleKeyDown = (e: KeyboardEvent) => {
        // ESC to close
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(checkboxOption ? { deleteRelated } : undefined);
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="alertdialog"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-desc"
        aria-modal="true"
      >
        <div className={styles.header}>
          <h2 className={styles.title} id="delete-confirm-title">{title}</h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.content} id="delete-confirm-desc">
          <p className={styles.message}>{message}</p>
          {checkboxOption && (
            <label className={styles.checkboxWrapper}>
              <input
                type="checkbox"
                checked={deleteRelated}
                onChange={(e) => setDeleteRelated(e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkboxContent}>
                <span className={styles.checkboxLabel}>{checkboxOption.label}</span>
                {checkboxOption.description && (
                  <span className={styles.checkboxDescription}>{checkboxOption.description}</span>
                )}
              </span>
            </label>
          )}
          {warningMessage && <p className={styles.warning}>{warningMessage}</p>}
        </div>

        <div className={styles.footer}>
          <button
            ref={cancelButtonRef}
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
          <button
            className={styles.deleteBtn}
            onClick={handleConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? (
              <>
                <Spinner size="sm" color="white" /> Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
