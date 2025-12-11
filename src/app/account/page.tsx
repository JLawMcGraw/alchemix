'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useSettings, type Theme, type Units } from '@/hooks/useSettings';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ChevronRight, Check, Eye, EyeOff, AlertTriangle, Download, Upload } from 'lucide-react';
import { authApi } from '@/lib/api';
import styles from './account.module.css';

export default function AccountPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const { user, logout } = useStore();
  const { settings, isLoaded, setTheme, setUnits } = useSettings();

  // Change Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Delete Account Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Export/Import State
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
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

  // Format date nicely
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  // Get user initials
  const getInitials = (email: string | undefined) => {
    if (!email) return 'U';
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  // Handle Change Password
  const handleChangePassword = async () => {
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 12) {
      setPasswordError('Password must be at least 12 characters');
      return;
    }

    try {
      setPasswordLoading(true);
      await authApi.changePassword(currentPassword, newPassword);
      setShowPasswordModal(false);
      logout();
      router.push('/login?message=password_changed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to change password';
      setPasswordError(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle Delete Account
  const handleDeleteAccount = async () => {
    setDeleteError('');

    if (!deletePassword) {
      setDeleteError('Password is required');
      return;
    }

    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }

    try {
      setDeleteLoading(true);
      await authApi.deleteAccount(deletePassword);
      logout();
      router.push('/login?message=account_deleted');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      setDeleteError(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle Export Data
  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const data = await authApi.exportData();

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

  // Handle Import
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

      if (!importData || typeof importData !== 'object') {
        throw new Error('Invalid import file format');
      }

      const dataToImport = {
        inventory: importData.inventory || [],
        recipes: importData.recipes || [],
        favorites: importData.favorites || [],
        collections: importData.collections || [],
      };

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

  // Reset modals
  const resetPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  };

  const resetDeleteModal = () => {
    setDeletePassword('');
    setDeleteConfirmText('');
    setDeleteError('');
  };

  // Handle Logout
  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (isValidating || !isLoaded) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  const unitOptions: { value: Units; label: string }[] = [
    { value: 'oz', label: 'Ounces (oz)' },
    { value: 'ml', label: 'Milliliters (ml)' },
    { value: 'cl', label: 'Centiliters (cl)' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Account, preferences, and data management</p>
        </header>

        <div className={styles.sections}>
          {/* Profile Section */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Profile</div>
            <div className={styles.sectionCard}>
              {/* User Info */}
              <div className={styles.profileRow}>
                <div className={styles.avatar}>
                  <span>{getInitials(user?.email)}</span>
                </div>
                <div className={styles.profileInfo}>
                  <div className={styles.profileEmail}>{user?.email}</div>
                  <div className={styles.profileMeta}>Member since {formatDate(user?.created_at)}</div>
                </div>
              </div>

              {/* Email Status */}
              <div className={styles.row}>
                <span className={styles.rowLabel}>Email status</span>
                <span className={`${styles.rowValue} ${user?.is_verified ? styles.verified : styles.unverified}`}>
                  {user?.is_verified ? '✓ Verified' : 'Unverified'}
                </span>
              </div>
            </div>
          </section>

          {/* Security Section */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Security</div>
            <div className={styles.sectionCard}>
              <button
                className={styles.rowBtn}
                onClick={() => {
                  resetPasswordModal();
                  setShowPasswordModal(true);
                }}
              >
                <div className={styles.rowBtnContent}>
                  <div className={styles.rowBtnTitle}>Change password</div>
                  <div className={styles.rowBtnSubtitle}>Last changed: Never</div>
                </div>
                <ChevronRight size={16} className={styles.rowBtnIcon} />
              </button>

              <button className={styles.rowBtn}>
                <div className={styles.rowBtnContent}>
                  <div className={styles.rowBtnTitle}>Active sessions</div>
                  <div className={styles.rowBtnSubtitle}>1 device</div>
                </div>
                <ChevronRight size={16} className={styles.rowBtnIcon} />
              </button>
            </div>
          </section>

          {/* Preferences Section */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Preferences</div>
            <div className={styles.sectionCard}>
              {/* Theme */}
              <div className={styles.row}>
                <span className={styles.rowLabel}>Theme</span>
                <div className={styles.themeSelector}>
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`${styles.themeBtn} ${settings.theme === option.value ? styles.themeBtnActive : ''}`}
                      onClick={() => setTheme(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Units */}
              <div className={styles.row}>
                <span className={styles.rowLabel}>Measurement units</span>
                <select
                  className={styles.select}
                  value={settings.units}
                  onChange={(e) => setUnits(e.target.value as Units)}
                >
                  {unitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Data Section */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Data</div>
            <div className={styles.sectionCard}>
              <button className={styles.rowBtn} onClick={handleExportData} disabled={isExporting}>
                <div className={styles.rowBtnContent}>
                  <div className={styles.rowBtnTitle}>Export data</div>
                  <div className={styles.rowBtnSubtitle}>Download your inventory & recipes</div>
                </div>
                {exportSuccess ? (
                  <Check size={16} className={styles.rowBtnIconSuccess} />
                ) : (
                  <Download size={16} className={styles.rowBtnIcon} />
                )}
              </button>

              <button className={styles.rowBtn} onClick={handleImportClick}>
                <div className={styles.rowBtnContent}>
                  <div className={styles.rowBtnTitle}>Import data</div>
                  <div className={styles.rowBtnSubtitle}>Restore from a backup file</div>
                </div>
                <Upload size={16} className={styles.rowBtnIcon} />
              </button>
            </div>
          </section>

          {/* Danger Zone */}
          <section className={styles.section}>
            <div className={styles.sectionLabelDanger}>Danger Zone</div>
            <div className={styles.sectionCardDanger}>
              <button
                className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                onClick={() => {
                  resetDeleteModal();
                  setShowDeleteModal(true);
                }}
              >
                <div className={styles.rowBtnContent}>
                  <div className={styles.rowBtnTitleDanger}>Delete account</div>
                  <div className={styles.rowBtnSubtitle}>Permanently delete all your data</div>
                </div>
                <ChevronRight size={16} className={styles.rowBtnIconDanger} />
              </button>
            </div>
          </section>

          {/* Log Out */}
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
      >
        <div className={styles.modalContent}>
          {passwordError && (
            <div className={styles.errorMessage}>{passwordError}</div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Current password</label>
            <div className={styles.passwordInputWrapper}>
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>New password</label>
            <div className={styles.passwordInputWrapper}>
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 12 characters"
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Confirm new password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleChangePassword}
              loading={passwordLoading}
            >
              Update Password
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Account"
      >
        <div className={styles.modalContent}>
          <div className={styles.dangerWarning}>
            <p>
              This will permanently delete your account and all data including inventory, recipes, favorites, and collections. This cannot be undone.
            </p>
          </div>

          {deleteError && (
            <div className={styles.errorMessage}>{deleteError}</div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Enter your password</label>
            <Input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Password"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Type <span className={styles.deleteText}>DELETE</span> to confirm
            </label>
            <Input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
            />
          </div>

          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              loading={deleteLoading}
              disabled={deleteConfirmText !== 'DELETE'}
            >
              Delete Account
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
                <Button variant="ghost" onClick={closeImportModal}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                  loading={isImporting}
                >
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
                <Button variant="ghost" onClick={closeImportModal}>
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
