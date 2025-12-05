'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Wine,
  BookOpen,
  Star,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';
import { inventoryApi, recipeApi, favoritesApi, collectionsApi, authApi } from '@/lib/api';
import styles from './account.module.css';

interface AccountStats {
  inventoryCount: number;
  recipeCount: number;
  favoriteCount: number;
  collectionCount: number;
}

export default function AccountPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const { user, logout } = useStore();
  const [stats, setStats] = useState<AccountStats>({
    inventoryCount: 0,
    recipeCount: 0,
    favoriteCount: 0,
    collectionCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const hasFetched = useRef(false);

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

  // Fetch stats on mount - only once
  useEffect(() => {
    if (!isAuthenticated || isValidating || hasFetched.current) return;

    const fetchStats = async () => {
      try {
        hasFetched.current = true;
        setIsLoading(true);

        // Fetch all counts directly from API
        const [categoryCounts, recipesRes, favoritesRes, collectionsRes] = await Promise.all([
          inventoryApi.getCategoryCounts(),
          recipeApi.getAll(),
          favoritesApi.getAll(),
          collectionsApi.getAll(),
        ]);

        // Use 'all' key from category counts (it's the pre-calculated total)
        const inventoryCount = categoryCounts.all || 0;

        setStats({
          inventoryCount,
          recipeCount: recipesRes.pagination?.total || recipesRes.recipes?.length || 0,
          favoriteCount: Array.isArray(favoritesRes) ? favoritesRes.length : 0,
          collectionCount: Array.isArray(collectionsRes) ? collectionsRes.length : 0,
        });
      } catch (error) {
        console.error('Failed to fetch account stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [isAuthenticated, isValidating]);

  // Format date nicely
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
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
      // Logout and redirect
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

  // Reset password modal state
  const resetPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  };

  // Reset delete modal state
  const resetDeleteModal = () => {
    setDeletePassword('');
    setDeleteConfirmText('');
    setDeleteError('');
  };

  if (isValidating) {
    return (
      <div className={styles.account}>
        <div className={styles.container}>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.account}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>Account</h1>
          <p className={styles.subtitle}>Manage your profile and view your stats</p>
        </header>

        {/* Profile Section */}
        <section className={styles.section}>
          <Card padding="lg" className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <div className={styles.avatar}>
                <User size={32} />
              </div>
              <div className={styles.profileInfo}>
                <h2 className={styles.profileName}>
                  {user?.email?.split('@')[0] || 'User'}
                </h2>
                <span className={styles.memberBadge}>Member</span>
              </div>
            </div>

            <div className={styles.profileDetails}>
              <div className={styles.detailRow}>
                <Mail size={18} className={styles.detailIcon} />
                <span className={styles.detailLabel}>Email</span>
                <span className={styles.detailValue}>{user?.email}</span>
              </div>

              <div className={styles.detailRow}>
                <Calendar size={18} className={styles.detailIcon} />
                <span className={styles.detailLabel}>Member since</span>
                <span className={styles.detailValue}>
                  {formatDate(user?.created_at)}
                </span>
              </div>

              <div className={styles.detailRow}>
                <Shield size={18} className={styles.detailIcon} />
                <span className={styles.detailLabel}>Email verified</span>
                <span className={`${styles.detailValue} ${user?.is_verified ? styles.verified : styles.unverified}`}>
                  {user?.is_verified ? 'Verified' : 'Not verified'}
                </span>
              </div>
            </div>
          </Card>
        </section>

        {/* Stats Section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Your Bar Stats</h3>
          <div className={styles.statsGrid}>
            <Card padding="md" className={styles.statCard} onClick={() => router.push('/bar')}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(61, 214, 193, 0.1)' }}>
                <Wine size={24} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  {isLoading ? '...' : stats.inventoryCount}
                </span>
                <span className={styles.statLabel}>Items in Bar</span>
              </div>
              <ChevronRight size={20} className={styles.statArrow} />
            </Card>

            <Card padding="md" className={styles.statCard} onClick={() => router.push('/recipes')}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(242, 164, 75, 0.1)' }}>
                <BookOpen size={24} style={{ color: 'var(--color-secondary)' }} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  {isLoading ? '...' : stats.recipeCount}
                </span>
                <span className={styles.statLabel}>Recipes Saved</span>
              </div>
              <ChevronRight size={20} className={styles.statArrow} />
            </Card>

            <Card padding="md" className={styles.statCard} onClick={() => router.push('/favorites')}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)' }}>
                <Star size={24} style={{ color: '#ffc107' }} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  {isLoading ? '...' : stats.favoriteCount}
                </span>
                <span className={styles.statLabel}>Favorites</span>
              </div>
              <ChevronRight size={20} className={styles.statArrow} />
            </Card>

            <Card padding="md" className={styles.statCard} onClick={() => router.push('/recipes')}>
              <div className={styles.statIcon} style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)' }}>
                <MessageSquare size={24} style={{ color: '#9c27b0' }} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  {isLoading ? '...' : stats.collectionCount}
                </span>
                <span className={styles.statLabel}>Collections</span>
              </div>
              <ChevronRight size={20} className={styles.statArrow} />
            </Card>
          </div>
        </section>

        {/* Account Actions Section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Account Actions</h3>
          <Card padding="md" className={styles.actionsCard}>
            <button
              className={styles.actionItem}
              onClick={() => {
                resetPasswordModal();
                setShowPasswordModal(true);
              }}
            >
              <Key size={18} />
              <span className={styles.actionText}>Change Password</span>
              <ChevronRight size={18} className={styles.actionArrow} />
            </button>

            <div className={styles.actionDivider} />

            <button
              className={`${styles.actionItem} ${styles.dangerAction}`}
              onClick={() => {
                resetDeleteModal();
                setShowDeleteModal(true);
              }}
            >
              <AlertTriangle size={18} />
              <span className={styles.actionText}>Delete Account</span>
              <ChevronRight size={18} className={styles.actionArrow} />
            </button>
          </Card>
        </section>

        {/* Back to Settings */}
        <div className={styles.backLink}>
          <Button variant="ghost" onClick={() => router.push('/settings')}>
            Go to Settings
          </Button>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
      >
        <div className={styles.modalContent}>
          <p className={styles.modalDescription}>
            Enter your current password and choose a new password.
          </p>

          {passwordError && (
            <div className={styles.errorMessage}>{passwordError}</div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Current Password</label>
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
            <label className={styles.formLabel}>New Password</label>
            <div className={styles.passwordInputWrapper}>
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 12 chars)"
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
            <label className={styles.formLabel}>Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          <div className={styles.modalActions}>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleChangePassword}
              loading={passwordLoading}
            >
              Change Password
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
            <AlertTriangle size={24} />
            <p>
              This action is <strong>permanent</strong> and cannot be undone. All your data will be deleted including your inventory, recipes, favorites, and collections.
            </p>
          </div>

          {deleteError && (
            <div className={styles.errorMessage}>{deleteError}</div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Password</label>
            <Input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Type <strong>DELETE</strong> to confirm
            </label>
            <Input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
            />
          </div>

          <div className={styles.modalActions}>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              loading={deleteLoading}
            >
              Delete My Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
