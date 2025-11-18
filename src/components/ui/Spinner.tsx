import React from 'react';
import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white';
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'primary' }) => {
  return (
    <div className={`${styles.spinner} ${styles[size]} ${styles[color]}`}>
      <svg viewBox="0 0 50 50" className={styles.svg}>
        <circle
          className={styles.circle}
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
};
