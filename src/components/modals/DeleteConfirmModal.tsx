'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import styles from './DeleteConfirmModal.module.css';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  itemName?: string;
  warningMessage?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  warningMessage = 'This action cannot be undone.',
}: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management and keyboard shortcuts
  useEffect(() => {
    if (isOpen) {
      // Auto-focus cancel button (safer for delete actions)
      setTimeout(() => deleteButtonRef.current?.focus(), 100);

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
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
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
          <div className={styles.iconWrapper}>
            <AlertCircle size={24} className={styles.alertIcon} aria-hidden="true" />
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.content} id="delete-confirm-desc">
          <h2 className={styles.title} id="delete-confirm-title">{title}</h2>
          <p className={styles.message}>{message}</p>
          {itemName && (
            <div className={styles.itemName}>
              <strong>{itemName}</strong>
            </div>
          )}
          <p className={styles.warning}>{warningMessage}</p>
        </div>

        <div className={styles.footer}>
          <Button
            ref={deleteButtonRef}
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading}
            className={styles.deleteBtn}
          >
            {loading ? (
              <>
                <Spinner size="sm" color="white" /> Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
