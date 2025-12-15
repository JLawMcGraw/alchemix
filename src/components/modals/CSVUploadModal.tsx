'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, AlertTriangle, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui';
import { useStore } from '@/lib/store';
import styles from './CSVUploadModal.module.css';

interface PreviewRow {
  name: string;
  secondary: string; // ingredients (truncated) for recipes, type for inventory
  tertiary: string; // instructions (truncated) for recipes, empty for inventory
  count: number; // ingredient count for recipes, stock for inventory
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

/**
 * Find header index matching any of the possible names (case-insensitive)
 */
function findHeaderIndex(headers: string[], possibleNames: string[]): number {
  const lowerNames = possibleNames.map(n => n.toLowerCase());
  return headers.findIndex(h => lowerNames.includes(h.toLowerCase()));
}

/**
 * Helper to truncate text for preview display
 */
function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  // Replace newlines with spaces for display
  const cleaned = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '...' : cleaned;
}

/**
 * Parse CSV content handling quoted fields with embedded newlines/commas
 * Returns array of rows, where each row is an array of cell values
 */
function parseCSVContent(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        currentCell += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // End of cell
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        // End of row
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        if (char === '\r') i++; // Skip \n in \r\n
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
  }

  // Don't forget last cell/row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Parse CSV content for preview
function parseCSVForPreview(content: string, type: 'items' | 'recipes'): PreviewData {
  const rows = parseCSVContent(content);

  if (rows.length < 2) {
    return { total: 0, valid: 0, invalid: 0, rows: [] };
  }

  // First row is headers
  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Find name column index
  const nameIdx = type === 'recipes'
    ? findHeaderIndex(headers, [
        'name', 'Name', 'NAME', 'Recipe Name', 'recipe name', 'Recipe', 'recipe',
        'Cocktail', 'cocktail', 'Cocktail Name', 'cocktail name',
        'Drink', 'drink', 'Drink Name', 'drink name'
      ])
    : findHeaderIndex(headers, [
        'name', 'Name', 'item', 'Item',
        'Spirit Name', 'spirit name', 'Spirit', 'spirit',
        'Bottle Name', 'bottle name', 'Bottle', 'bottle',
        'Product Name', 'product name', 'Product', 'product',
        'Brand', 'brand'
      ]);

  // Filter rows that have a name value
  const validDataRows = dataRows.filter(row => {
    const name = nameIdx >= 0 ? row[nameIdx] : row[0];
    return name && name.trim().length > 0;
  });

  // Preview first 5 valid rows
  const previewRows: PreviewRow[] = validDataRows.slice(0, 5).map(row => {
    if (type === 'recipes') {
      const ingredientsIdx = findHeaderIndex(headers, [
        'ingredients', 'Ingredients', 'INGREDIENTS', 'Items', 'items',
        'Recipe Items', 'recipe items', 'Components', 'components'
      ]);
      const instructionsIdx = findHeaderIndex(headers, [
        'instructions', 'Instructions', 'INSTRUCTIONS', 'Method', 'method',
        'Directions', 'directions', 'Steps', 'steps', 'How to Make', 'how to make',
        'Preparation', 'preparation'
      ]);

      const name = (nameIdx >= 0 ? row[nameIdx] : row[0]) || '';
      const ingredients = ingredientsIdx >= 0 ? row[ingredientsIdx] || '' : '';
      const instructions = instructionsIdx >= 0 ? row[instructionsIdx] || '' : '';

      return {
        name,
        secondary: truncate(ingredients, 50),
        tertiary: truncate(instructions, 40),
        count: 0,
        valid: true,
        error: undefined,
      };
    } else {
      const typeIdx = findHeaderIndex(headers, [
        'type', 'Type', 'Liquor Type', 'liquor type',
        'category', 'Category', 'Spirit Type', 'spirit type'
      ]);
      const stockIdx = findHeaderIndex(headers, [
        'stock_number', 'Stock Number', 'stock number',
        'Stock', 'stock', 'quantity', 'Quantity',
        'amount', 'Amount', 'Number', '#'
      ]);

      const name = (nameIdx >= 0 ? row[nameIdx] : row[0]) || '';
      const itemType = typeIdx >= 0 ? row[typeIdx] || '' : '';
      const stock = stockIdx >= 0 ? parseInt(row[stockIdx]) || 0 : 0;

      return {
        name,
        secondary: itemType,
        tertiary: '',
        count: stock,
        valid: true,
        error: undefined,
      };
    }
  });

  return {
    total: validDataRows.length,
    valid: validDataRows.length,
    invalid: 0,
    rows: previewRows,
  };
}

export function CSVUploadModal({ isOpen, onClose, type, onUpload }: CSVUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | undefined>(undefined);
  const [newCollectionName, setNewCollectionName] = useState('');

  const { collections, fetchCollections, addCollection } = useStore();
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
    setNewCollectionName('');
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
      let collectionId = selectedCollectionId;

      // Create new collection if requested
      if (selectedCollectionId === -1 && newCollectionName.trim()) {
        const newCollection = await addCollection({
          name: newCollectionName.trim(),
        });
        collectionId = newCollection.id;
      } else if (selectedCollectionId === -1) {
        // -1 but no name entered, treat as no collection
        collectionId = undefined;
      }

      await onUpload(file, collectionId);
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
                    {type === 'recipes' ? 'Ingredients' : 'Type'}
                  </span>
                  <span className={styles.previewColCount}>
                    {type === 'recipes' ? 'Instructions' : 'Stock'}
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
                    <span className={styles.previewColCount}>
                      {type === 'recipes' ? row.tertiary : row.count}
                    </span>
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
              {type === 'recipes' && (
                <div className={styles.collectionSection}>
                  <label className={styles.collectionLabel}>
                    Collection (optional)
                  </label>
                  <select
                    className={styles.collectionSelect}
                    value={selectedCollectionId === -1 ? 'new' : (selectedCollectionId ?? '')}
                    onChange={(e) => {
                      if (e.target.value === 'new') {
                        setSelectedCollectionId(-1); // -1 signals "create new"
                      } else {
                        setSelectedCollectionId(e.target.value ? parseInt(e.target.value, 10) : undefined);
                        setNewCollectionName('');
                      }
                    }}
                    disabled={uploading}
                  >
                    <option value="">None</option>
                    <option value="new">+ Create new</option>
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                  {selectedCollectionId === -1 && (
                    <input
                      type="text"
                      className={styles.collectionInput}
                      placeholder="Enter collection name"
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      disabled={uploading}
                      autoFocus
                    />
                  )}
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
