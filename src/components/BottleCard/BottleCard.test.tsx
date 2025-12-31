import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottleCard } from './BottleCard';
import type { InventoryItem } from '@/types';

// Mock useTheme hook
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

// Mock getPeriodicTags
vi.mock('@/lib/periodicTableV2', () => ({
  getPeriodicTags: (item: InventoryItem) => {
    if (item.category === 'spirit') {
      return { group: 'Base', period: 'Grain' };
    }
    return { group: null, period: null };
  },
}));

describe('BottleCard', () => {
  const mockItem: InventoryItem = {
    id: 1,
    name: 'Buffalo Trace',
    type: 'Bourbon',
    category: 'spirit',
    abv: '45%',
    distillery_location: 'Kentucky, USA',
    stock_number: 2,
    user_id: 1,
    created_at: '2024-01-01T00:00:00.000Z',
  };

  const mockOnClick = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render item name with stock count', () => {
      render(<BottleCard item={mockItem} />);
      expect(screen.getByText('Buffalo Trace (2)')).toBeInTheDocument();
    });

    it('should render item type', () => {
      render(<BottleCard item={mockItem} />);
      expect(screen.getByText('Bourbon')).toBeInTheDocument();
    });

    it('should render ABV', () => {
      render(<BottleCard item={mockItem} />);
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('should render distillery location', () => {
      render(<BottleCard item={mockItem} />);
      expect(screen.getByText('Kentucky, USA')).toBeInTheDocument();
    });

    it('should render periodic tags for spirits', () => {
      render(<BottleCard item={mockItem} />);
      expect(screen.getByText('Base')).toBeInTheDocument();
      expect(screen.getByText('Grain')).toBeInTheDocument();
    });

    it('should not render type if not provided', () => {
      const itemWithoutType = { ...mockItem, type: undefined };
      render(<BottleCard item={itemWithoutType} />);
      expect(screen.queryByText('Type:')).not.toBeInTheDocument();
    });

    it('should not render ABV if not provided', () => {
      const itemWithoutAbv = { ...mockItem, abv: undefined };
      render(<BottleCard item={itemWithoutAbv} />);
      expect(screen.queryByText('ABV:')).not.toBeInTheDocument();
    });

    it('should not render location if not provided', () => {
      const itemWithoutLocation = { ...mockItem, distillery_location: undefined };
      render(<BottleCard item={itemWithoutLocation} />);
      expect(screen.queryByText('Location:')).not.toBeInTheDocument();
    });
  });

  describe('stock status', () => {
    it('should show stock count of 0 for out-of-stock items', () => {
      const outOfStockItem = { ...mockItem, stock_number: 0 };
      render(<BottleCard item={outOfStockItem} />);
      expect(screen.getByText('Buffalo Trace (0)')).toBeInTheDocument();
    });

    it('should handle undefined stock_number as 0', () => {
      const itemWithoutStock = { ...mockItem, stock_number: undefined };
      render(<BottleCard item={itemWithoutStock} />);
      expect(screen.getByText('Buffalo Trace (0)')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('should render checkbox unchecked by default', () => {
      render(<BottleCard item={mockItem} onSelect={mockOnSelect} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should render checkbox checked when isSelected is true', () => {
      render(<BottleCard item={mockItem} isSelected={true} onSelect={mockOnSelect} />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should call onSelect when checkbox is clicked', () => {
      render(<BottleCard item={mockItem} onSelect={mockOnSelect} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(mockOnSelect).toHaveBeenCalledWith(1);
    });

    it('should call onSelect on Enter key press on checkbox', () => {
      render(<BottleCard item={mockItem} onSelect={mockOnSelect} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.keyDown(checkbox, { key: 'Enter' });
      expect(mockOnSelect).toHaveBeenCalledWith(1);
    });

    it('should call onSelect on Space key press on checkbox', () => {
      render(<BottleCard item={mockItem} onSelect={mockOnSelect} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.keyDown(checkbox, { key: ' ' });
      expect(mockOnSelect).toHaveBeenCalledWith(1);
    });

    it('should not propagate click event from checkbox to card', () => {
      render(<BottleCard item={mockItem} onClick={mockOnClick} onSelect={mockOnSelect} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(mockOnSelect).toHaveBeenCalled();
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('click handling', () => {
    it('should call onClick when card is clicked', () => {
      render(<BottleCard item={mockItem} onClick={mockOnClick} />);
      const card = screen.getByRole('button');
      fireEvent.click(card);
      expect(mockOnClick).toHaveBeenCalledWith(mockItem);
    });

    it('should call onClick on Enter key press on card', () => {
      render(<BottleCard item={mockItem} onClick={mockOnClick} />);
      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(mockOnClick).toHaveBeenCalledWith(mockItem);
    });

    it('should call onClick on Space key press on card', () => {
      render(<BottleCard item={mockItem} onClick={mockOnClick} />);
      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: ' ' });
      expect(mockOnClick).toHaveBeenCalledWith(mockItem);
    });
  });

  describe('accessibility', () => {
    it('should have accessible label with item details', () => {
      render(<BottleCard item={mockItem} />);
      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('aria-label', 'Buffalo Trace, Bourbon, 2 in stock');
    });

    it('should have accessible label without type if not provided', () => {
      const itemWithoutType = { ...mockItem, type: undefined };
      render(<BottleCard item={itemWithoutType} />);
      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('aria-label', 'Buffalo Trace, 2 in stock');
    });

    it('should be keyboard navigable', () => {
      render(<BottleCard item={mockItem} />);
      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('ABV formatting', () => {
    it('should strip duplicate percentage signs from ABV', () => {
      const itemWithPercentInAbv = { ...mockItem, abv: '45%%' };
      render(<BottleCard item={itemWithPercentInAbv} />);
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('should add percentage sign if not present', () => {
      const itemWithNumericAbv = { ...mockItem, abv: '40' };
      render(<BottleCard item={itemWithNumericAbv} />);
      expect(screen.getByText('40%')).toBeInTheDocument();
    });
  });
});
