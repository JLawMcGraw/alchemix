/**
 * Skeleton Component
 *
 * Animated placeholder for loading states.
 * Provides visual feedback while content is being fetched.
 *
 * Features:
 * - Shimmer animation effect
 * - Multiple variants (text, circular, rectangular)
 * - Configurable dimensions
 * - Composable for complex layouts
 *
 * Usage:
 *   <Skeleton variant="text" width="200px" />
 *   <Skeleton variant="circular" width={40} height={40} />
 *   <Skeleton variant="rectangular" height={200} />
 */

import React from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /** Shape variant */
  variant?: 'text' | 'circular' | 'rectangular';
  /** Width - number (px) or string (any CSS unit) */
  width?: number | string;
  /** Height - number (px) or string (any CSS unit) */
  height?: number | string;
  /** Animation style */
  animation?: 'pulse' | 'wave' | 'none';
  /** Additional CSS classes */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Number of skeleton lines (for text variant) */
  lines?: number;
  /** Accessibility label */
  'aria-label'?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  animation = 'wave',
  className = '',
  style = {},
  lines = 1,
  'aria-label': ariaLabel = 'Loading...',
}) => {
  // Convert number to px string
  const formatDimension = (value: number | string | undefined): string | undefined => {
    if (value === undefined) return undefined;
    return typeof value === 'number' ? `${value}px` : value;
  };

  const baseStyle: React.CSSProperties = {
    width: formatDimension(width),
    height: formatDimension(height),
    ...style,
  };

  // Set default heights based on variant
  if (!height) {
    if (variant === 'text') {
      baseStyle.height = '1em';
    } else if (variant === 'circular') {
      baseStyle.height = baseStyle.width || '40px';
    }
  }

  // Set default width for text
  if (!width && variant === 'text') {
    baseStyle.width = '100%';
  }

  const classNames = [
    styles.skeleton,
    styles[variant],
    styles[animation],
    className,
  ].filter(Boolean).join(' ');

  // Render multiple lines for text variant
  if (variant === 'text' && lines > 1) {
    return (
      <div
        role="status"
        aria-label={ariaLabel}
        aria-busy="true"
        className={styles.skeletonGroup}
      >
        {Array.from({ length: lines }).map((_, index) => (
          <span
            key={index}
            className={classNames}
            style={{
              ...baseStyle,
              // Last line is shorter for natural look
              width: index === lines - 1 ? '80%' : baseStyle.width,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      className={classNames}
      style={baseStyle}
    />
  );
};

/**
 * Pre-built skeleton layouts for common patterns
 */

export interface CardSkeletonProps {
  /** Show image placeholder */
  hasImage?: boolean;
  /** Number of text lines */
  lines?: number;
  /** Additional CSS classes */
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  hasImage = false,
  lines = 3,
  className = '',
}) => {
  return (
    <div className={`${styles.cardSkeleton} ${className}`} role="status" aria-label="Loading card...">
      {hasImage && (
        <Skeleton
          variant="rectangular"
          height={160}
          animation="wave"
          aria-label="Loading image"
        />
      )}
      <div className={styles.cardSkeletonContent}>
        <Skeleton variant="text" width="60%" height="1.5em" aria-label="Loading title" />
        <Skeleton variant="text" lines={lines} aria-label="Loading content" />
      </div>
    </div>
  );
};

export interface TableRowSkeletonProps {
  /** Number of columns */
  columns?: number;
  /** Additional CSS classes */
  className?: string;
}

export const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({
  columns = 4,
  className = '',
}) => {
  return (
    <tr className={`${styles.tableRowSkeleton} ${className}`} role="status" aria-label="Loading row...">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index}>
          <Skeleton variant="text" width={index === 0 ? '80%' : '60%'} />
        </td>
      ))}
    </tr>
  );
};

export interface ListItemSkeletonProps {
  /** Show avatar placeholder */
  hasAvatar?: boolean;
  /** Show action button placeholder */
  hasAction?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const ListItemSkeleton: React.FC<ListItemSkeletonProps> = ({
  hasAvatar = false,
  hasAction = false,
  className = '',
}) => {
  return (
    <div className={`${styles.listItemSkeleton} ${className}`} role="status" aria-label="Loading item...">
      {hasAvatar && (
        <Skeleton variant="circular" width={40} height={40} aria-label="Loading avatar" />
      )}
      <div className={styles.listItemContent}>
        <Skeleton variant="text" width="40%" height="1.2em" aria-label="Loading title" />
        <Skeleton variant="text" width="70%" aria-label="Loading description" />
      </div>
      {hasAction && (
        <Skeleton variant="rectangular" width={80} height={32} aria-label="Loading action" />
      )}
    </div>
  );
};

/**
 * Dashboard-specific skeletons
 */

export const StatCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`${styles.statCardSkeleton} ${className}`} role="status" aria-label="Loading statistic...">
      <Skeleton variant="circular" width={48} height={48} aria-label="Loading icon" />
      <div className={styles.statCardContent}>
        <Skeleton variant="text" width="60%" height="0.9em" aria-label="Loading label" />
        <Skeleton variant="text" width="40%" height="2em" aria-label="Loading value" />
      </div>
    </div>
  );
};

export const InsightSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`${styles.insightSkeleton} ${className}`} role="status" aria-label="Loading insight...">
      <p className={styles.insightLoadingMessage}>Compiling lab notes...</p>
    </div>
  );
};

export default Skeleton;
