'use client';

import { Spinner } from '../Spinner';
import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  /** Loading message to display */
  message?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show in a card container */
  card?: boolean;
}

export function LoadingSpinner({
  message = 'Loading...',
  size = 'md',
  card = false
}: LoadingSpinnerProps) {
  const content = (
    <div className={styles.container}>
      <Spinner size={size} />
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );

  if (card) {
    return (
      <div className={styles.card}>
        {content}
      </div>
    );
  }

  return content;
}
