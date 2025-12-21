/**
 * StepperInput Component
 *
 * Precise quantity input with +/- buttons for scientific measurements.
 * Displays values with leading zeros (e.g., "01.50 oz").
 *
 * Accessibility:
 * - Buttons have aria-labels for screen readers
 * - Input is keyboard accessible
 * - Disabled state properly communicated
 */

import React, { forwardRef, useCallback, useId } from 'react';
import { formatDecimal } from '@/lib/formatters';
import styles from './StepperInput.module.css';

export interface StepperInputProps {
  /** Current value */
  value: number;
  /** Called when value changes */
  onChange: (value: number) => void;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 99) */
  max?: number;
  /** Step increment (default: 0.25) */
  step?: number;
  /** Unit to display (e.g., "oz", "ml") */
  unit?: string;
  /** Show decimals (default: true) */
  showDecimals?: boolean;
  /** Number of decimal places (default: 2) */
  decimals?: number;
  /** Label text */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Full width mode */
  fullWidth?: boolean;
  /** Additional class name */
  className?: string;
}

export const StepperInput = forwardRef<HTMLInputElement, StepperInputProps>(({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 0.25,
  unit,
  showDecimals = true,
  decimals = 2,
  label,
  disabled = false,
  fullWidth = false,
  className = '',
}, ref) => {
  const generatedId = useId();
  const inputId = label ? `stepper-${generatedId}` : undefined;

  const handleDecrement = useCallback(() => {
    const newValue = Math.max(min, value - step);
    // Round to avoid floating point errors
    onChange(Math.round(newValue * 1000) / 1000);
  }, [value, min, step, onChange]);

  const handleIncrement = useCallback(() => {
    const newValue = Math.min(max, value + step);
    // Round to avoid floating point errors
    onChange(Math.round(newValue * 1000) / 1000);
  }, [value, max, step, onChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(Math.round(clamped * 1000) / 1000);
    }
  }, [min, max, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    }
  }, [handleIncrement, handleDecrement]);

  // Format the display value
  const displayValue = showDecimals
    ? formatDecimal(value, 2, decimals)
    : Math.round(value).toString().padStart(2, '0');

  const canDecrement = value > min;
  const canIncrement = value < max;

  const wrapperClasses = [
    styles.wrapper,
    fullWidth ? styles.fullWidth : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.container}>
        <button
          type="button"
          className={styles.button}
          onClick={handleDecrement}
          disabled={disabled || !canDecrement}
          aria-label={`Decrease by ${step}`}
          tabIndex={-1}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <div className={styles.inputWrapper}>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            role="spinbutton"
            className={styles.input}
            value={displayValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
          />
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
        <button
          type="button"
          className={styles.button}
          onClick={handleIncrement}
          disabled={disabled || !canIncrement}
          aria-label={`Increase by ${step}`}
          tabIndex={-1}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
});

StepperInput.displayName = 'StepperInput';
