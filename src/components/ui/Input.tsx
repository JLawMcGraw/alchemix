/**
 * Input Component
 *
 * Accessible text input with label and error state.
 *
 * Accessibility:
 * - Label properly associated via htmlFor/id
 * - Error messages linked via aria-describedby
 * - Invalid state communicated via aria-invalid
 * - Required state indicated via aria-required
 * - Supports aria-label for icon-only inputs
 */

import React, { forwardRef, useId } from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Visible label text */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Full width mode */
  fullWidth?: boolean;
  /** Show terminal-style prefix character (>) */
  showPrefix?: boolean;
  /** Custom prefix character (default: ">") */
  prefixChar?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  fullWidth = false,
  showPrefix = false,
  prefixChar = '>',
  className = '',
  id,
  required,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  ...props
}, ref) => {
  // Generate stable unique ID for accessibility
  const generatedId = useId();
  const inputId = id || (label ? `input-${generatedId}` : undefined);
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  // Combine describedby IDs
  const describedBy = [ariaDescribedBy, errorId, helperId].filter(Boolean).join(' ') || undefined;

  const inputClassNames = [
    styles.input,
    error ? styles.error : '',
    showPrefix ? styles.inputWithPrefix : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={`${styles.wrapper} ${fullWidth ? styles.fullWidth : ''}`}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-hidden="true"> *</span>}
        </label>
      )}
      <div className={styles.inputContainer}>
        {showPrefix && (
          <span className={styles.inputPrefix} aria-hidden="true">
            {prefixChar}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={inputClassNames}
          aria-label={!label ? ariaLabel : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required}
          aria-describedby={describedBy}
          required={required}
          {...props}
        />
      </div>
      {helperText && !error && (
        <span id={helperId} className={styles.helperText}>
          {helperText}
        </span>
      )}
      {error && (
        <span id={errorId} className={styles.errorText} role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
