'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import styles from '../dashboard/error.module.css';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BarError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Bar error:', error);
  }, [error]);

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorCard}>
        <div className={styles.iconWrapper}>
          <AlertTriangle size={48} />
        </div>
        <h2 className={styles.title}>My Bar Error</h2>
        <p className={styles.message}>
          Something went wrong loading your bar inventory. This might be a temporary issue.
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
          <Link href="/dashboard" className={styles.homeLink}>
            <Home size={16} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
