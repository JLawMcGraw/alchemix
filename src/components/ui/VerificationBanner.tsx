'use client';

import { useState } from 'react';
import { AlertTriangle, Mail, X, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import styles from './VerificationBanner.module.css';

/**
 * VerificationBanner Component
 *
 * Displays a warning banner for users who haven't verified their email.
 * Appears at the top of authenticated pages when user.is_verified is false.
 *
 * Features:
 * - Shows warning message about limited access
 * - Resend verification email button
 * - Dismissible (but reappears on page refresh)
 *
 * Soft Block Implementation:
 * - Unverified users can browse (view inventory, recipes, etc.)
 * - Unverified users CANNOT modify data (add, edit, delete)
 * - This banner reminds them to verify to unlock full access
 */
export function VerificationBanner() {
  const { user } = useStore();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');

  // Don't show if:
  // - No user logged in
  // - User is already verified
  // - Banner has been dismissed (this session)
  if (!user || user.is_verified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setResending(true);
    setResendError('');

    try {
      await authApi.resendVerification();
      setResendSuccess(true);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      setResendError(
        axiosError.response?.data?.error || 'Failed to send verification email. Please try again.'
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={styles.banner} role="alert">
      <div className={styles.content}>
        <AlertTriangle className={styles.icon} size={20} />
        <div className={styles.message}>
          <strong>Please verify your email</strong>
          <span className={styles.description}>
            {resendSuccess
              ? 'Verification email sent! Check your inbox.'
              : 'Verify your email to unlock all features. Some actions are restricted until verified.'}
          </span>
          {resendError && <span className={styles.error}>{resendError}</span>}
        </div>
      </div>

      <div className={styles.actions}>
        {!resendSuccess && (
          <button
            className={styles.resendButton}
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? (
              <>
                <Loader2 className={styles.spinner} size={16} />
                Sending...
              </>
            ) : (
              <>
                <Mail size={16} />
                Resend Email
              </>
            )}
          </button>
        )}
        <button
          className={styles.dismissButton}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss banner"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
