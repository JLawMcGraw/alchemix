'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { authApi } from '@/lib/api';
import styles from './verify-email.module.css';

type VerificationStatus = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Use ref to prevent duplicate API calls in React StrictMode
  const verificationAttempted = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token provided.');
      return;
    }

    // Prevent duplicate API calls (React StrictMode double-mount)
    if (verificationAttempted.current) {
      return;
    }
    verificationAttempted.current = true;

    // Verify the email
    const verifyEmail = async () => {
      try {
        await authApi.verifyEmail(token);
        setStatus('success');

        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
      } catch (error: unknown) {
        setStatus('error');
        const axiosError = error as { response?: { data?: { error?: string } } };
        setErrorMessage(
          axiosError.response?.data?.error || 'Failed to verify email. The link may be invalid or expired.'
        );
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      setResendSuccess(true);
    } catch (error: unknown) {
      // User might not be logged in
      const axiosError = error as { response?: { data?: { error?: string } } };
      setErrorMessage(
        axiosError.response?.data?.error || 'Unable to resend verification email. Please log in and try again.'
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card padding="lg" className={styles.card}>
        {status === 'loading' && (
          <div className={styles.statusContainer}>
            <Loader2 className={styles.loadingIcon} size={64} />
            <h1 className={styles.title}>Verifying your email...</h1>
            <p className={styles.subtitle}>Please wait while we verify your email address.</p>
          </div>
        )}

        {status === 'success' && (
          <div className={styles.statusContainer}>
            <CheckCircle className={styles.successIcon} size={64} />
            <h1 className={styles.title}>Email Verified!</h1>
            <p className={styles.subtitle}>
              Your email has been successfully verified. You now have full access to all features.
            </p>
            <p className={styles.redirectText}>Redirecting to dashboard...</p>
            <Link href="/dashboard">
              <Button variant="primary" size="lg">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.statusContainer}>
            <XCircle className={styles.errorIcon} size={64} />
            <h1 className={styles.title}>Verification Failed</h1>
            <p className={styles.subtitle}>{errorMessage}</p>

            {resendSuccess ? (
              <div className={styles.resendSuccess}>
                <Mail size={20} />
                <span>A new verification email has been sent!</span>
              </div>
            ) : (
              <div className={styles.actions}>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleResendVerification}
                  disabled={resending}
                >
                  {resending ? (
                    <>
                      <Loader2 className={styles.buttonSpinner} size={18} />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail size={18} />
                      Resend Verification Email
                    </>
                  )}
                </Button>
                <Link href="/login">
                  <Button variant="outline" size="lg">
                    Back to Login
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <Card padding="lg" className={styles.card}>
            <div className={styles.statusContainer}>
              <Loader2 className={styles.loadingIcon} size={64} />
              <h1 className={styles.title}>Loading...</h1>
            </div>
          </Card>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
