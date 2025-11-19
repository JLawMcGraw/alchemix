'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { useStore } from '@/lib/store';
import styles from './CSVUploadModal.module.css';

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'items' | 'recipes';
  onUpload: (file: File, collectionId?: number) => Promise<void>;
}

export function CSVUploadModal({ isOpen, onClose, type, onUpload }: CSVUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | undefined>(undefined);

  const { collections, fetchCollections } = useStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);

  // Fetch collections when modal opens for recipes
  useEffect(() => {
    if (isOpen && type === 'recipes') {
      fetchCollections().catch(console.error);
    }
  }, [isOpen, type, fetchCollections]);

  // Focus management and keyboard shortcuts
  useEffect(() => {
    if (isOpen) {
      // Auto-focus upload button
      setTimeout(() => uploadButtonRef.current?.focus(), 100);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      await onUpload(file, selectedCollectionId);
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || `Failed to import ${type}`);
      } else {
        setError(`Failed to import ${type}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError(null);
    setSuccess(false);
    setUploading(false);
    setSelectedCollectionId(undefined);
    onClose();
  };

  const title = type === 'items' ? 'Import Bar Stock CSV' : 'Import Recipes CSV';
  const exampleFormat = type === 'items'
    ? 'Name,Category,Type,ABV,Stock Number,...'
    : 'Name,Category,Ingredients,Instructions,Tags';

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-labelledby="csv-upload-title"
        aria-describedby="csv-upload-desc"
        aria-modal="true"
      >
        <div className={styles.header}>
          <h2 className={styles.title} id="csv-upload-title">
            <Upload size={24} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
            {title}
          </h2>
          <button
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        <div className={styles.content} id="csv-upload-desc">
          <p className={styles.description}>
            Upload a CSV file to import {type === 'items' ? 'your bar inventory' : 'cocktail recipes'}.
          </p>

          <div className={styles.formatInfo}>
            <strong>Expected Format:</strong>
            <code className={styles.exampleFormat}>{exampleFormat}</code>
          </div>

          <div className={styles.uploadSection}>
            <label htmlFor="csv-upload" className={styles.fileLabel}>
              <Upload size={32} />
              <span>
                {file ? file.name : 'Choose CSV file'}
              </span>
              <input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className={styles.fileInput}
              />
            </label>
          </div>

          {type === 'recipes' && (
            <div style={{ marginTop: '16px' }}>
              <label
                htmlFor="collection-select"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--color-text-body)',
                }}
              >
                Collection (optional)
              </label>
              <select
                id="collection-select"
                value={selectedCollectionId ?? ''}
                onChange={(e) => setSelectedCollectionId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-body)',
                  backgroundColor: 'var(--color-ui-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                }}
              >
                <option value="">No Collection</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className={styles.alert} data-type="error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.alert} data-type="success">
              <CheckCircle size={20} />
              <span>Successfully imported {type}!</span>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            ref={uploadButtonRef}
            variant="primary"
            onClick={handleUpload}
            disabled={!file || uploading || success}
          >
            {uploading ? (
              <>
                <Spinner size="sm" color="white" /> Importing...
              </>
            ) : (
              'Import CSV'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
