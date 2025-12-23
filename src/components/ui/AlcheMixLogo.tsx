'use client';

import React from 'react';
import styles from './AlcheMixLogo.module.css';

export interface AlcheMixLogoProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the text alongside the icon */
  showText?: boolean;
  /** Whether to show the tagline below the wordmark */
  showTagline?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * AlcheMix Logo - Y-shaped molecular structure
 *
 * Features:
 * - Y-shaped molecule with 4 nodes using design system colors:
 *   - Green (--bond-cane) - top-left
 *   - Blue (--bond-juniper) - top-right
 *   - Amber (--bond-grain) - bottom
 *   - Pink (--bond-botanical) - center junction
 * - Smooth Brownian motion animation on hover (GPU accelerated)
 * - Light and dark mode support
 * - Three size variants (sm, md, lg)
 */
export const AlcheMixLogo: React.FC<AlcheMixLogoProps> = ({
  size = 'md',
  showText = true,
  showTagline = false,
  className = '',
}) => {
  // Adjust SVG stroke widths based on size
  const strokeWidths = {
    sm: { bond: 5, node: 3, center: 2.5 },
    md: { bond: 4, node: 2.5, center: 2 },
    lg: { bond: 4, node: 2.5, center: 2 },
  };

  const nodeRadii = {
    sm: { outer: 11, center: 8 },
    md: { outer: 10, center: 7 },
    lg: { outer: 10, center: 7 },
  };

  const sw = strokeWidths[size];
  const nr = nodeRadii[size];

  return (
    <div className={`${styles.logoContainer} ${styles[size]} ${className}`}>
      {/* The Icon: Y-shaped Molecule */}
      <div className={styles.iconWrapper}>
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={styles.icon}
          aria-hidden="true"
        >
          {/*
            Geometry (inverted Y):
            - Center junction: (50, 50)
            - Top node: (50, 15)
            - Bottom-left node: (22, 80)
            - Bottom-right node: (78, 80)
          */}

          {/* Bonds */}
          <g className={styles.bonds} strokeWidth={sw.bond} strokeLinecap="round">
            <line x1="50" y1="50" x2="50" y2="15" />
            <line x1="50" y1="50" x2="22" y2="80" />
            <line x1="50" y1="50" x2="78" y2="80" />
          </g>

          {/* Terminal Nodes */}
          <circle
            className={`${styles.node} ${styles.nodeBlue}`}
            cx="50" cy="15" r={nr.outer}
            strokeWidth={sw.node}
          />
          <circle
            className={`${styles.node} ${styles.nodeGreen}`}
            cx="22" cy="80" r={nr.outer}
            strokeWidth={sw.node}
          />
          <circle
            className={`${styles.node} ${styles.nodeOrange}`}
            cx="78" cy="80" r={nr.outer}
            strokeWidth={sw.node}
          />

          {/* Center Junction Node */}
          <circle
            className={`${styles.node} ${styles.nodePink}`}
            cx="50" cy="50" r={nr.center}
            strokeWidth={sw.center}
          />
        </svg>
      </div>

      {/* Typography */}
      {showText && (
        <div className={styles.textWrapper}>
          <div className={styles.wordmark}>ALCHEMIX</div>
          {showTagline && (
            <span className={styles.tagline}>MOLECULAR OS V1.0</span>
          )}
        </div>
      )}
    </div>
  );
};

export default AlcheMixLogo;
