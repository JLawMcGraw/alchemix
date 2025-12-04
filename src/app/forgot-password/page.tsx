'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { authApi } from '@/lib/api';
import styles from './forgot-password.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err: unknown) {
      // API always returns success to prevent email enumeration
      // But handle network errors
      void err; // Intentionally unused - we show generic error
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card padding="lg" className={styles.card}>
        {submitted ? (
          <div className={styles.successContainer}>
            <CheckCircle className={styles.successIcon} size={64} />
            <h1 className={styles.title}>Check Your Email</h1>
            <p className={styles.subtitle}>
              If an account exists with <strong>{email}</strong>, we&apos;ve sent a password reset link.
            </p>
            <p className={styles.note}>
              The link will expire in 1 hour. If you don&apos;t see the email, check your spam folder.
            </p>
            <Link href="/login">
              <Button variant="outline" size="lg" className={styles.backButton}>
                <ArrowLeft size={18} />
                Back to Login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <Mail className={styles.headerIcon} size={48} />
              <h1 className={styles.title}>Forgot Password?</h1>
              <p className={styles.subtitle}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                fullWidth
                error={error}
                disabled={loading}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className={styles.submitButton}
              >
                {loading ? (
                  <>
                    <Loader2 className={styles.spinner} size={18} />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>

            <div className={styles.footer}>
              <Link href="/login" className={styles.backLink}>
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
