'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Eye, EyeOff, Check, X, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { authApi } from '@/lib/api';
import { checkPasswordRequirements, validatePassword } from '@/lib/passwordPolicy';
import styles from './reset-password.module.css';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const passwordRequirements = checkPasswordRequirements(password);
  const passwordValidation = validatePassword(password);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setError('No reset token provided. Please request a new password reset link.');
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password policy
    if (!passwordValidation.isValid) {
      setError('Password does not meet the requirements.');
      return;
    }

    // Check passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!token) {
      setError('Invalid reset token.');
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Failed to reset password. The link may be invalid or expired.'
      );
    } finally {
      setLoading(false);
    }
  };

  // No token provided
  if (!token && !error) {
    return (
      <div className={styles.container}>
        <Card padding="lg" className={styles.card}>
          <div className={styles.statusContainer}>
            <Loader2 className={styles.loadingIcon} size={64} />
            <h1 className={styles.title}>Loading...</h1>
          </div>
        </Card>
      </div>
    );
  }

  // Error state (no token)
  if (error && !token) {
    return (
      <div className={styles.container}>
        <Card padding="lg" className={styles.card}>
          <div className={styles.statusContainer}>
            <XCircle className={styles.errorIcon} size={64} />
            <h1 className={styles.title}>Invalid Link</h1>
            <p className={styles.subtitle}>{error}</p>
            <Link href="/forgot-password">
              <Button variant="primary" size="lg">
                Request New Reset Link
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className={styles.container}>
        <Card padding="lg" className={styles.card}>
          <div className={styles.statusContainer}>
            <CheckCircle className={styles.successIcon} size={64} />
            <h1 className={styles.title}>Password Reset!</h1>
            <p className={styles.subtitle}>
              Your password has been successfully reset. You can now log in with your new password.
            </p>
            <p className={styles.note}>Redirecting to login...</p>
            <Link href="/login">
              <Button variant="primary" size="lg">
                Go to Login
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Reset password form
  return (
    <div className={styles.container}>
      <Card padding="lg" className={styles.card}>
        <div className={styles.header}>
          <Lock className={styles.headerIcon} size={48} />
          <h1 className={styles.title}>Reset Your Password</h1>
          <p className={styles.subtitle}>
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Password Field */}
          <div className={styles.passwordField}>
            <Input
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              fullWidth
              disabled={loading}
            />
            <button
              type="button"
              className={styles.eyeButton}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Password Requirements */}
          {password && (
            <div className={styles.requirements}>
              <div className={`${styles.requirement} ${passwordRequirements.minLength ? styles.met : ''}`}>
                {passwordRequirements.minLength ? <Check size={14} /> : <X size={14} />}
                At least 8 characters
              </div>
              <div className={`${styles.requirement} ${passwordRequirements.hasUppercase ? styles.met : ''}`}>
                {passwordRequirements.hasUppercase ? <Check size={14} /> : <X size={14} />}
                One uppercase letter
              </div>
              <div className={`${styles.requirement} ${passwordRequirements.hasNumberOrSymbol ? styles.met : ''}`}>
                {passwordRequirements.hasNumberOrSymbol ? <Check size={14} /> : <X size={14} />}
                One number or symbol
              </div>
            </div>
          )}

          {/* Confirm Password Field */}
          <div className={styles.passwordField}>
            <Input
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              fullWidth
              disabled={loading}
              error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
            />
            <button
              type="button"
              className={styles.eyeButton}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading || !passwordValidation.isValid || password !== confirmPassword}
            className={styles.submitButton}
          >
            {loading ? (
              <>
                <Loader2 className={styles.spinner} size={18} />
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </Button>
        </form>

        <div className={styles.footer}>
          <Link href="/login" className={styles.backLink}>
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordContent />
    </Suspense>
  );
}
