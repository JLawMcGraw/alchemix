/**
 * Card Component
 *
 * Accessible container with surface background and shadow.
 *
 * Accessibility:
 * - When clickable: proper keyboard navigation and role
 * - Focus visible styles for keyboard users
 * - Supports aria-label for non-text content
 */

import React from 'react';
import styles from './Card.module.css';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  /** ARIA label for clickable cards */
  'aria-label'?: string;
  /** ARIA role override */
  role?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  hover = false,
  onClick,
  style,
  'aria-label': ariaLabel,
  role,
}) => {
  const isClickable = !!onClick;
  const classNames = [
    styles.card,
    styles[`padding-${padding}`],
    hover ? styles.hover : '',
    isClickable ? styles.clickable : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Handle keyboard activation for clickable cards
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={classNames}
      onClick={onClick}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      style={style}
      role={role || (isClickable ? 'button' : undefined)}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
};
