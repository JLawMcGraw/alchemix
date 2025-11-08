'use client';

import { useState } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import styles from './CSVUploadModal.module.css';

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'bottles' | 'recipes';
  onUpload: (file: File) => Promise<void>;
}

export function CSVUploadModal({ isOpen, onClose, type, onUpload }: CSVUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      await onUpload(file);
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
    onClose();
  };

  const title = type === 'bottles' ? 'Import Bar Stock CSV' : 'Import Recipes CSV';
  const exampleFormat = type === 'bottles'
    ? 'Spirit,Brand,Age/Type,Quantity (ml),Cost ($),Date Added,...'
    : 'Name,Category,Ingredients,Instructions,Tags';

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Upload size={24} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
            {title}
          </h2>
          <button className={styles.closeBtn} onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            Upload a CSV file to import {type === 'bottles' ? 'your bar inventory' : 'cocktail recipes'}.
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
            variant="primary"
            onClick={handleUpload}
            disabled={!file || uploading || success}
          >
            {uploading ? 'Importing...' : 'Import CSV'}
          </Button>
        </div>
      </div>
    </div>
  );
}
