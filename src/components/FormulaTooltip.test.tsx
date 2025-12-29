import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FormulaTooltip } from './FormulaTooltip';

// Mock parseFormulaSymbols from recipe-molecule
vi.mock('@alchemix/recipe-molecule', () => ({
  parseFormulaSymbols: (formula: string) => {
    // Simple mock that parses basic formulas
    if (!formula) return [];

    const result = [];
    const parts = formula.split(' · ');

    for (const part of parts) {
      // Match patterns like "Rm₄", "3Li₂", "Ss"
      const match = part.match(/^(\d)?([A-Z][a-z]?)([₀₁₂₃₄₅₆₇₈₉]+)?$/);
      if (match) {
        const [, coef, symbol, sub] = match;

        // Map symbols to names
        const symbolNames: Record<string, string> = {
          'Rm': 'Rum',
          'Li': 'Lime',
          'Ss': 'Simple Syrup',
          'Gn': 'Gin',
          'Vd': 'Vodka',
          'An': 'Angostura',
        };

        // Convert subscript to number
        const subscriptMap: Record<string, number> = {
          '₀': 0, '₁': 1, '₂': 2, '₃': 3, '₄': 4,
          '₅': 5, '₆': 6, '₇': 7, '₈': 8, '₉': 9,
        };

        let subscriptNum = 1;
        if (sub) {
          subscriptNum = parseInt(sub.split('').map(c => subscriptMap[c] || 0).join(''), 10);
        }

        result.push({
          symbol,
          displayText: part,
          name: symbolNames[symbol] || symbol,
          coefficient: coef ? parseInt(coef, 10) : 1,
          subscript: subscriptNum,
        });
      }
    }

    return result;
  },
}));

describe('FormulaTooltip', () => {
  beforeEach(() => {
    // Create portal target
    const portalRoot = document.createElement('div');
    portalRoot.setAttribute('id', 'portal-root');
    document.body.appendChild(portalRoot);
  });

  afterEach(() => {
    // Clean up portal root
    const portalRoot = document.getElementById('portal-root');
    if (portalRoot) {
      document.body.removeChild(portalRoot);
    }
  });

  describe('rendering', () => {
    it('should render the formula text', () => {
      render(<FormulaTooltip formula="Rm₄ · Li₂ · Ss" />);
      expect(screen.getByText('Rm₄ · Li₂ · Ss')).toBeInTheDocument();
    });

    it('should return null for empty formula', () => {
      const { container } = render(<FormulaTooltip formula="" />);
      expect(container.firstChild).toBeNull();
    });

    it('should apply custom className', () => {
      render(<FormulaTooltip formula="Rm₄" className="custom-class" />);
      const trigger = screen.getByText('Rm₄');
      expect(trigger).toHaveClass('custom-class');
    });
  });

  describe('tooltip interaction', () => {
    it('should show tooltip on mouse enter', async () => {
      render(<FormulaTooltip formula="Rm₄ · Li₂" />);
      const trigger = screen.getByText('Rm₄ · Li₂');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      render(<FormulaTooltip formula="Rm₄" />);
      const trigger = screen.getByText('Rm₄');

      fireEvent.mouseEnter(trigger);
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('should display "Formula Breakdown" header in tooltip', async () => {
      render(<FormulaTooltip formula="Rm₄" />);
      const trigger = screen.getByText('Rm₄');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByText('Formula Breakdown')).toBeInTheDocument();
      });
    });
  });

  describe('symbol display', () => {
    it('should display symbol with name', async () => {
      render(<FormulaTooltip formula="Rm₄" />);
      const trigger = screen.getByText('Rm₄');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByText('Rum')).toBeInTheDocument();
      });
    });

    it('should display coefficient for multiple ingredients', async () => {
      render(<FormulaTooltip formula="3Rm₂" />);
      const trigger = screen.getByText('3Rm₂');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByText(/3x/)).toBeInTheDocument();
      });
    });

    it('should display ratio for subscripts > 1', async () => {
      render(<FormulaTooltip formula="Rm₄" />);
      const trigger = screen.getByText('Rm₄');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByText(/ratio: 4/)).toBeInTheDocument();
      });
    });

    it('should display hint text', async () => {
      render(<FormulaTooltip formula="Rm₄" />);
      const trigger = screen.getByText('Rm₄');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByText('Coefficients show count, subscripts show ratio')).toBeInTheDocument();
      });
    });
  });

  describe('multiple symbols', () => {
    it('should display all symbols in formula', async () => {
      render(<FormulaTooltip formula="Rm₄ · Li₂ · Ss" />);
      const trigger = screen.getByText('Rm₄ · Li₂ · Ss');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByText('Rum')).toBeInTheDocument();
        expect(screen.getByText('Lime')).toBeInTheDocument();
        expect(screen.getByText('Simple Syrup')).toBeInTheDocument();
      });
    });

    it('should show equals sign between symbol and name', async () => {
      render(<FormulaTooltip formula="Rm₄" />);
      const trigger = screen.getByText('Rm₄');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByText('=')).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle single symbol without subscript', async () => {
      render(<FormulaTooltip formula="Gn" />);
      const trigger = screen.getByText('Gn');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        expect(screen.getByText('Gin')).toBeInTheDocument();
      });
    });

    it('should handle formula with unknown symbols', async () => {
      render(<FormulaTooltip formula="Xx₂" />);
      const trigger = screen.getByText('Xx₂');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        // Should show symbol as name if unknown
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have tooltip role', async () => {
      render(<FormulaTooltip formula="Rm₄" />);
      const trigger = screen.getByText('Rm₄');

      fireEvent.mouseEnter(trigger);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toBeInTheDocument();
      });
    });
  });
});
