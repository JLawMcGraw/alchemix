'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSettings, type Theme, type Units, type RecipeView } from '@/hooks/useSettings';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { authApi } from '@/lib/api';
import {
  Palette,
  Scale,
  LayoutGrid,
  Bell,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Moon,
  Sun,
  Monitor,
  Check,
} from 'lucide-react';
import styles from './settings.module.css';

export default function SettingsPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const { settings, isLoaded, setTheme, setUnits, setRecipeView } = useSettings();
  // Export Data State
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Clear AI History State
  const [showClearAIModal, setShowClearAIModal] = useState(false);
  const [aiCleared, setAICleared] = useState(false);

  // Clear All Data State
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  // Import Data State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    inventory: number;
    recipes: number;
    favorites: number;
    collections: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [overwriteData, setOverwriteData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Export Data
  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const data = await authApi.exportData();

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alchemix-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to export data:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Clear AI History
  const handleClearAIHistory = () => {
    // Clear conversation from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('alchemix-conversation');
      localStorage.removeItem('alchemix-ai-history');
    }
    setAICleared(true);
    setShowClearAIModal(false);
    setTimeout(() => setAICleared(false), 3000);
  };

  // Handle Import Data
  const handleImportClick = () => {
    setImportResult(null);
    setImportError(null);
    setOverwriteData(false);
    setShowImportModal(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setImportError(null);
      setImportResult(null);

      const text = await file.text();
      const importData = JSON.parse(text);

      // Validate the import data structure
      if (!importData || typeof importData !== 'object') {
        throw new Error('Invalid import file format');
      }

      // Extract the data to import
      const dataToImport = {
        inventory: importData.inventory || [],
        recipes: importData.recipes || [],
        favorites: importData.favorites || [],
        collections: importData.collections || [],
      };

      // Call the import API
      const result = await authApi.importData(dataToImport, { overwrite: overwriteData });
      setImportResult(result.imported);
    } catch (error) {
      console.error('Failed to import data:', error);
      if (error instanceof SyntaxError) {
        setImportError('Invalid JSON file. Please select a valid AlcheMix export file.');
      } else if (error instanceof Error) {
        setImportError(error.message);
      } else {
        setImportError('Failed to import data. Please try again.');
      }
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportResult(null);
    setImportError(null);
    setOverwriteData(false);
  };

  if (isValidating || !isLoaded) {
    return (
      <div className={styles.settings}>
        <div className={styles.container}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun size={18} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={18} /> },
    { value: 'system', label: 'System', icon: <Monitor size={18} /> },
  ];

  const unitOptions: { value: Units; label: string }[] = [
    { value: 'oz', label: 'Ounces (oz)' },
    { value: 'ml', label: 'Milliliters (ml)' },
    { value: 'cl', label: 'Centiliters (cl)' },
  ];

  const viewOptions: { value: RecipeView; label: string }[] = [
    { value: 'cards', label: 'Cards' },
    { value: 'list', label: 'List' },
    { value: 'compact', label: 'Compact' },
  ];

  return (
    <div className={styles.settings}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Customize your AlcheMix experience</p>
        </header>

        {/* Display Section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Palette size={20} />
            Display
          </h3>

          <Card padding="lg" className={styles.settingsCard}>
            {/* Theme */}
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Theme</span>
                <span className={styles.settingDescription}>
                  Choose your preferred color scheme
                </span>
              </div>
              <div className={styles.themeSelector}>
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`${styles.themeOption} ${
                      settings.theme === option.value ? styles.themeActive : ''
                    }`}
                    onClick={() => setTheme(option.value)}
                  >
                    {option.icon}
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.settingDivider} />

            {/* Units */}
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>
                  <Scale size={18} style={{ marginRight: '8px' }} />
                  Measurement Units
                </span>
                <span className={styles.settingDescription}>
                  Default units for recipe amounts
                </span>
              </div>
              <div className={styles.selectWrapper}>
                <select
                  value={settings.units}
                  onChange={(e) => setUnits(e.target.value as Units)}
                  className={styles.select}
                >
                  {unitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.settingDivider} />

            {/* Recipe View */}
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>
                  <LayoutGrid size={18} style={{ marginRight: '8px' }} />
                  Recipe View
                </span>
                <span className={styles.settingDescription}>
                  How recipes are displayed in lists
                </span>
              </div>
              <div className={styles.selectWrapper}>
                <select
                  value={settings.recipeView}
                  onChange={(e) => setRecipeView(e.target.value as RecipeView)}
                  className={styles.select}
                >
                  {viewOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        </section>

        {/* Notifications Section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Bell size={20} />
            Notifications
          </h3>

          <Card padding="lg" className={styles.settingsCard}>
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Low stock alerts</span>
                <span className={styles.settingDescription}>
                  Get notified when items run low
                </span>
              </div>
              <div className={styles.comingSoonBadge}>Coming Soon</div>
            </div>

            <div className={styles.settingDivider} />

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Recipe suggestions</span>
                <span className={styles.settingDescription}>
                  Receive new recipe recommendations
                </span>
              </div>
              <div className={styles.comingSoonBadge}>Coming Soon</div>
            </div>

            <div className={styles.settingDivider} />

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Weekly bar report</span>
                <span className={styles.settingDescription}>
                  Summary of your bar activity
                </span>
              </div>
              <div className={styles.comingSoonBadge}>Coming Soon</div>
            </div>
          </Card>
        </section>

        {/* Data & Privacy Section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <Download size={20} />
            Data & Privacy
          </h3>

          <Card padding="lg" className={styles.settingsCard}>
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Export my data</span>
                <span className={styles.settingDescription}>
                  Download all your data as JSON
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
                loading={isExporting}
              >
                {exportSuccess ? (
                  <>
                    <Check size={16} style={{ marginRight: '6px' }} />
                    Exported!
                  </>
                ) : (
                  <>
                    <Download size={16} style={{ marginRight: '6px' }} />
                    Export
                  </>
                )}
              </Button>
            </div>

            <div className={styles.settingDivider} />

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Import data</span>
                <span className={styles.settingDescription}>
                  Restore data from an export file
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportClick}
              >
                <Upload size={16} style={{ marginRight: '6px' }} />
                Import
              </Button>
            </div>

            <div className={styles.settingDivider} />

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Clear AI history</span>
                <span className={styles.settingDescription}>
                  Delete all AI conversation history
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearAIModal(true)}
              >
                {aiCleared ? (
                  <>
                    <Check size={16} style={{ marginRight: '6px' }} />
                    Cleared!
                  </>
                ) : (
                  <>
                    <Trash2 size={16} style={{ marginRight: '6px' }} />
                    Clear
                  </>
                )}
              </Button>
            </div>

            <div className={styles.settingDivider} />

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={`${styles.settingLabel} ${styles.dangerLabel}`}>
                  <AlertTriangle size={18} style={{ marginRight: '8px' }} />
                  Clear all data
                </span>
                <span className={styles.settingDescription}>
                  Permanently delete all your data
                </span>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => router.push('/account')}
              >
                <Trash2 size={16} style={{ marginRight: '6px' }} />
                Go to Account
              </Button>
            </div>
          </Card>
        </section>

        {/* Back to Account */}
        <div className={styles.backLink}>
          <Button variant="ghost" onClick={() => router.push('/account')}>
            Go to Account
          </Button>
        </div>
      </div>

      {/* Clear AI History Modal */}
      <Modal
        isOpen={showClearAIModal}
        onClose={() => setShowClearAIModal(false)}
        title="Clear AI History"
      >
        <div className={styles.modalContent}>
          <p className={styles.modalDescription}>
            This will clear all your AI conversation history. This action cannot be undone.
          </p>
          <div className={styles.modalActions}>
            <Button variant="outline" onClick={() => setShowClearAIModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleClearAIHistory}>
              Clear History
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Data Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={closeImportModal}
        title="Import Data"
      >
        <div className={styles.modalContent}>
          {!importResult && !importError && (
            <>
              <p className={styles.modalDescription}>
                Select an AlcheMix export file (.json) to import your data.
              </p>
              <div className={styles.importOptions}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={overwriteData}
                    onChange={(e) => setOverwriteData(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <span>Overwrite existing data</span>
                </label>
                <p className={styles.checkboxHint}>
                  {overwriteData
                    ? 'Warning: This will replace all your existing data'
                    : 'Data will be merged with your existing data'}
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileSelect}
                className={styles.fileInput}
                disabled={isImporting}
              />
              <div className={styles.modalActions}>
                <Button variant="outline" onClick={closeImportModal}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                  loading={isImporting}
                >
                  <Upload size={16} style={{ marginRight: '6px' }} />
                  Select File
                </Button>
              </div>
            </>
          )}

          {importError && (
            <>
              <div className={styles.importError}>
                <AlertTriangle size={24} />
                <p>{importError}</p>
              </div>
              <div className={styles.modalActions}>
                <Button variant="outline" onClick={closeImportModal}>
                  Close
                </Button>
                <Button variant="primary" onClick={() => setImportError(null)}>
                  Try Again
                </Button>
              </div>
            </>
          )}

          {importResult && (
            <>
              <div className={styles.importSuccess}>
                <Check size={24} />
                <p>Import completed successfully!</p>
              </div>
              <div className={styles.importResults}>
                <div className={styles.importResultItem}>
                  <span>Inventory items:</span>
                  <span>{importResult.inventory}</span>
                </div>
                <div className={styles.importResultItem}>
                  <span>Recipes:</span>
                  <span>{importResult.recipes}</span>
                </div>
                <div className={styles.importResultItem}>
                  <span>Favorites:</span>
                  <span>{importResult.favorites}</span>
                </div>
                <div className={styles.importResultItem}>
                  <span>Collections:</span>
                  <span>{importResult.collections}</span>
                </div>
              </div>
              <div className={styles.modalActions}>
                <Button variant="primary" onClick={closeImportModal}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
