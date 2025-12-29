'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { parseFormulaSymbols, type FormulaSymbolInfo } from '@alchemix/recipe-molecule';
import styles from './FormulaTooltip.module.css';

interface FormulaTooltipProps {
  formula: string;
  className?: string;
}

interface TooltipPosition {
  top: number;
  left: number;
}

/**
 * Formula display with hover tooltip explaining each symbol
 */
export function FormulaTooltip({ formula, className }: FormulaTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const symbols = parseFormulaSymbols(formula);

  // Ensure we're mounted (for portal)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate tooltip position
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    // Center horizontally below the trigger
    let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
    let top = triggerRect.bottom + 8;

    // Keep within viewport horizontally
    const padding = 16;
    if (left < padding) {
      left = padding;
    } else if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }

    // If not enough space below, show above
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = triggerRect.top - tooltipRect.height - 8;
    }

    setPosition({ top, left });
  }, []);

  // Update position when opened
  useEffect(() => {
    if (isOpen) {
      // Use requestAnimationFrame to ensure tooltip is rendered before measuring
      requestAnimationFrame(() => {
        updatePosition();
      });
    }
  }, [isOpen, updatePosition]);

  if (!formula || symbols.length === 0) {
    return null;
  }

  const tooltip = isOpen && mounted && (
    <div
      ref={tooltipRef}
      className={styles.tooltip}
      style={{ top: position.top, left: position.left }}
      role="tooltip"
    >
      <div className={styles.header}>Formula Breakdown</div>
      <ul className={styles.symbolList}>
        {symbols.map((sym, index) => (
          <li key={index} className={styles.symbolItem}>
            <span className={styles.symbolCode}>{sym.displayText}</span>
            <span className={styles.symbolEquals}>=</span>
            <span className={styles.symbolName}>
              {sym.coefficient > 1 && (
                <span className={styles.coefficient}>{sym.coefficient}x </span>
              )}
              {sym.name}
              {sym.subscript > 1 && (
                <span className={styles.ratio}> (ratio: {sym.subscript})</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.hint}>
        Coefficients show count, subscripts show ratio
      </div>
    </div>
  );

  return (
    <>
      <span
        ref={triggerRef}
        className={`${styles.trigger} ${className || ''}`}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        {formula}
      </span>
      {mounted && createPortal(tooltip, document.body)}
    </>
  );
}
