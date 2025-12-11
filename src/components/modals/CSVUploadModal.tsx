'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, AlertTriangle, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui';
import { useStore } from '@/lib/store';
import styles from './CSVUploadModal.module.css';

interface PreviewRow {
  name: string;
  secondary: string; // spirit for recipes, category for inventory
  count: number; // ingredients count for recipes, stock for inventory
  valid: boolean;
  error?: string;
}

interface PreviewData {
  total: number;
  valid: number;
  invalid: number;
  rows: PreviewRow[];
}

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'items' | 'recipes';
  onUpload: (file: File, collectionId?: number) => Promise<void>;
}

// Parse CSV content for preview
function parseCSVForPreview(content: string, type: 'items' | 'recipes'): PreviewData {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    return { total: 0, valid: 0, invalid: 0, rows: [] };
  }

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  const dataLines = lines.slice(1, 6); // First 5 data rows for preview

  const rows: PreviewRow[] = dataLines.map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

    if (type === 'recipes') {
      const nameIdx = headers.findIndex(h => h === 'name' || h === 'recipe');
      const spiritIdx = headers.findIndex(h => h === 'spirit' || h === 'category' || h === 'base');
      const ingredientsIdx = headers.findIndex(h => h === 'ingredients');

      const name = nameIdx >= 0 ? values[nameIdx] : values[0];
      const spirit = spiritIdx >= 0 ? values[spiritIdx] : values[1] || '';
      const ingredients = ingredientsIdx >= 0 ? values[ingredientsIdx] : '';
      const ingredientCount = ingredients ? ingredients.split(';').length : 0;

      const valid = !!name && name.length > 0;

      return {
        name: name || '',
        secondary: spirit,
        count: ingredientCount,
        valid,
        error: !valid ? 'Missing name' : undefined,
      };
    } else {
      // Inventory items
      const nameIdx = headers.findIndex(h => h === 'name' || h === 'item');
      const categoryIdx = headers.findIndex(h => h === 'category' || h === 'type');
      const stockIdx = headers.findIndex(h => h === 'stock' || h === 'quantity' || h === 'amount');

      const name = nameIdx >= 0 ? values[nameIdx] : values[0];
      const category = categoryIdx >= 0 ? values[categoryIdx] : values[1] || '';
      const stock = stockIdx >= 0 ? parseInt(values[stockIdx]) || 0 : 0;

      const valid = !!name && name.length > 0;

      return {
        name: name || '',
        secondary: category,
        count: stock,
        valid,
        error: !valid ? 'Missing name' : undefined,
      };
    }
  });

  const validCount = rows.filter(r => r.valid).length;
  const totalDataRows = lines.length - 1; // Exclude header

  return {
    total: totalDataRows,
    valid: Math.round((validCount / rows.length) * totalDataRows), // Estimate based on preview
    invalid: Math.round(((rows.length - validCount) / rows.length) * totalDataRows),
    rows,
  };
}

export function CSVUploadModal({ isOpen, onClose, type, onUpload }: CSVUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | undefined>(undefined);

  const { collections, fetchCollections } = useStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch collections when modal opens for recipes
  useEffect(() => {
    if (isOpen && type === 'recipes') {
      fetchCollections().catch(console.error);
    }
  }, [isOpen, type, fetchCollections]);

  // Focus management and keyboard shortcuts
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError(null);
    setUploading(false);
    setSelectedCollectionId(undefined);
    setIsDragging(false);
    onClose();
  }, [onClose]);

  const processFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      setFile(null);
      setPreview(null);
      return;
    }

    setFile(selectedFile);
    setError(null);

    try {
      const content = await selectedFile.text();
      const previewData = parseCSVForPreview(content, type);
      setPreview(previewData);
    } catch {
      setError('Failed to parse CSV file');
      setPreview(null);
    }
  }, [type]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      await onUpload(file, selectedCollectionId);
      handleClose();
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

  const handleDownloadTemplate = () => {
    let csvContent = '';
    let filename = '';

    if (type === 'recipes') {
      csvContent = 'Name,Category,Spirit,Ingredients,Instructions,Glass,Tags\n';
      csvContent += '"Negroni","Classic","Gin","1 oz Gin;1 oz Campari;1 oz Sweet Vermouth","Stir with ice and strain into a rocks glass","Rocks Glass","bitter,stirred"\n';
      csvContent += '"Margarita","Classic","Tequila","2 oz Tequila;1 oz Lime Juice;0.5 oz Triple Sec","Shake with ice and strain into a salt-rimmed glass","Coupe","citrus,shaken"';
      filename = 'alchemix-recipes-template.csv';
    } else {
      csvContent = 'Name,Category,Type,ABV,Stock,Notes\n';
      csvContent += '"Hendricks Gin","Spirit","Gin","41.4","750","Scottish gin"\n';
      csvContent += '"Campari","Liqueur","Bitter","25","500","Italian aperitif"';
      filename = 'alchemix-inventory-template.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  const title = type === 'items' ? 'Import Inventory' : 'Import Recipes';
  const itemLabel = type === 'items' ? 'items' : 'recipes';

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-labelledby="csv-upload-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title} id="csv-upload-title">{title}</h2>
          <button
            className={styles.closeBtn}
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Template Download */}
          {!file && (
            <div className={styles.templateBox}>
              <div className={styles.templateInfo}>
                <div className={styles.templateTitle}>Need a template?</div>
                <div className={styles.templateSubtitle}>
                  Download a pre-formatted CSV to get started
                </div>
              </div>
              <button className={styles.templateBtn} onClick={handleDownloadTemplate}>
                <Download size={16} />
                <span>Template</span>
              </button>
            </div>
          )}

          {/* Drop Zone */}
          {!preview && (
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''} ${file ? styles.dropZoneHasFile : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className={styles.fileInput}
              />

              {file ? (
                <>
                  <div className={styles.dropZoneIconSuccess}>
                    <Check size={24} />
                  </div>
                  <div className={styles.dropZoneTitle}>{file.name}</div>
                  <div className={styles.dropZoneSubtitle}>Parsing file...</div>
                </>
              ) : (
                <>
                  <div className={styles.dropZoneIcon}>
                    <Upload size={24} />
                  </div>
                  <div className={styles.dropZoneTitle}>Drop CSV file here</div>
                  <div className={styles.dropZoneSubtitle}>or click to browse</div>
                </>
              )}
            </div>
          )}

          {/* Preview */}
          {preview && file && (
            <>
              {/* Summary */}
              <div className={styles.summaryBox}>
                <div className={styles.summaryIcon}>
                  <Check size={20} />
                </div>
                <div className={styles.summaryContent}>
                  <div className={styles.summaryTitle}>{file.name}</div>
                  <div className={styles.summaryMeta}>
                    <span className={styles.summaryValid}>{preview.valid} valid</span>
                    {preview.invalid > 0 && (
                      <span className={styles.summaryInvalid}> · {preview.invalid} invalid</span>
                    )}
                    <span> · {preview.total} total rows</span>
                  </div>
                </div>
                <button className={styles.changeBtn} onClick={resetFile}>
                  Change
                </button>
              </div>

              {/* Preview Table */}
              <div className={styles.previewTable}>
                <div className={styles.previewHeader}>
                  Preview (first 5 rows)
                </div>

                {/* Table Header */}
                <div className={`${styles.previewRow} ${styles.previewRowHeader}`}>
                  <span className={styles.previewColStatus}></span>
                  <span className={styles.previewColName}>Name</span>
                  <span className={styles.previewColSecondary}>
                    {type === 'recipes' ? 'Spirit' : 'Category'}
                  </span>
                  <span className={styles.previewColCount}>
                    {type === 'recipes' ? 'Ingredients' : 'Stock'}
                  </span>
                </div>

                {/* Table Rows */}
                {preview.rows.map((row, i) => (
                  <div
                    key={i}
                    className={`${styles.previewRow} ${!row.valid ? styles.previewRowInvalid : ''}`}
                  >
                    <span className={styles.previewColStatus}>
                      {row.valid ? (
                        <Check size={16} className={styles.iconValid} />
                      ) : (
                        <AlertTriangle size={16} className={styles.iconInvalid} />
                      )}
                    </span>
                    <span className={`${styles.previewColName} ${!row.name ? styles.errorText : ''}`}>
                      {row.name || row.error}
                    </span>
                    <span className={styles.previewColSecondary}>{row.secondary}</span>
                    <span className={styles.previewColCount}>{row.count}</span>
                  </div>
                ))}
              </div>

              {/* Invalid Warning */}
              {preview.invalid > 0 && (
                <div className={styles.warningBox}>
                  <AlertTriangle size={16} className={styles.warningIcon} />
                  <div>
                    <div className={styles.warningTitle}>
                      {preview.invalid} row{preview.invalid > 1 ? 's' : ''} will be skipped
                    </div>
                    <div className={styles.warningSubtitle}>
                      Invalid rows are missing required fields
                    </div>
                  </div>
                </div>
              )}

              {/* Collection Selector for Recipes */}
              {type === 'recipes' && collections.length > 0 && (
                <div className={styles.collectionSection}>
                  <label className={styles.collectionLabel}>
                    Add to collection (optional)
                  </label>
                  <select
                    className={styles.collectionSelect}
                    value={selectedCollectionId ?? ''}
                    onChange={(e) => setSelectedCollectionId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    disabled={uploading}
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
            </>
          )}

          {/* Error */}
          {error && (
            <div className={styles.errorBox}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerInfo}>
            {preview && `${preview.valid} ${itemLabel} will be imported`}
          </div>
          <div className={styles.footerActions}>
            <Button variant="ghost" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!preview || preview.valid === 0 || uploading}
              loading={uploading}
            >
              {uploading ? 'Importing...' : `Import ${preview?.valid || 0} ${itemLabel}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
