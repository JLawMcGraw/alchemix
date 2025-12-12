'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import styles from './error.module.css';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorCard}>
        <div className={styles.iconWrapper}>
          <AlertTriangle size={48} />
        </div>
        <h2 className={styles.title}>Dashboard Error</h2>
        <p className={styles.message}>
          Something went wrong loading your dashboard. This might be a temporary issue.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <details className={styles.details}>
            <summary>Error Details</summary>
            <pre>{error.message}</pre>
            {error.digest && <p>Digest: {error.digest}</p>}
          </details>
        )}
        <div className={styles.actions}>
          <button onClick={reset} className={styles.retryButton}>
            <RefreshCw size={16} />
            Try Again
          </button>
          <Link href="/login" className={styles.homeLink}>
            <Home size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
