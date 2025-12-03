/**
 * Button Component
 *
 * Accessible button with multiple variants and sizes.
 * Supports all standard button attributes including ARIA properties.
 *
 * Accessibility:
 * - Uses native button element (keyboard accessible by default)
 * - Supports aria-label, aria-describedby, aria-pressed, etc.
 * - Disabled state properly communicated to assistive technology
 * - Loading state indicated via aria-busy
 */

import React, { forwardRef } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'text' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  /** Show loading spinner and disable interactions */
  loading?: boolean;
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  children,
  className = '',
  disabled,
  'aria-label': ariaLabel,
  ...props
}, ref) => {
  const classNames = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    loading ? styles.loading : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      className={classNames}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading}
      aria-disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <span className={styles.loadingContent}>
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.srOnly}>Loading...</span>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
});

Button.displayName = 'Button';
