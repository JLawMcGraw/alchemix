'use client';

import { useStore } from '@/lib/store';
import { useToast } from '@/components/ui';

/**
 * useVerificationGuard Hook
 *
 * Provides a guard function to check if the user is verified before allowing
 * certain actions. Used to implement "soft block" for unverified users.
 *
 * Soft Block Implementation:
 * - Unverified users can browse (view inventory, recipes, shopping list, etc.)
 * - Unverified users CANNOT create, edit, or delete data
 *
 * Usage:
 * ```tsx
 * const { requireVerification, isVerified } = useVerificationGuard();
 *
 * const handleAddItem = async () => {
 *   if (!requireVerification()) return; // Shows toast if not verified
 *   // Proceed with add...
 * };
 * ```
 *
 * Protected Actions:
 * - Add/edit/delete inventory items
 * - Add/edit/delete recipes
 * - Import CSV files
 * - AI chat interactions
 *
 * Allowed Actions (unverified):
 * - View inventory, recipes, collections
 * - View shopping list
 * - View dashboard
 * - Account settings
 */
export function useVerificationGuard() {
  const { user } = useStore();
  const { showToast } = useToast();

  const isVerified = user?.is_verified ?? false;

  /**
   * Check if user is verified. If not, shows a toast notification.
   *
   * @returns true if verified (action can proceed), false if not verified (action blocked)
   */
  const requireVerification = (): boolean => {
    if (!user) {
      // User not logged in - this should be handled by auth guard, not verification guard
      return false;
    }

    if (!isVerified) {
      showToast(
        'info',
        'Please verify your email to perform this action. Check your inbox for the verification link.'
      );
      return false;
    }

    return true;
  };

  return {
    isVerified,
    requireVerification,
  };
}
