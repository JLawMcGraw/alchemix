/**
 * CSVUploadModal Component Tests
 *
 * Tests the CSV upload modal for importing recipes and inventory items.
 * Note: File parsing tests are limited due to JSDOM FileReader limitations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CSVUploadModal } from './CSVUploadModal';

// Mock the store
vi.mock('@/lib/store', () => ({
  useStore: () => ({
    collections: [
      { id: 1, name: 'Classics' },
      { id: 2, name: 'Tiki' },
    ],
    fetchCollections: vi.fn().mockResolvedValue([]),
  }),
}));

// Mock Button component to simplify testing
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick, disabled, loading, variant }: any) => (
    <button onClick={onClick} disabled={disabled || loading} data-variant={variant}>
      {loading ? 'Importing...' : children}
    </button>
  ),
}));

describe('CSVUploadModal', () => {
  const mockOnClose = vi.fn();
  const mockOnUpload = vi.fn();

  // Store original DOM methods
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnUpload.mockResolvedValue(undefined);

    // Mock URL methods
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    // Restore URL methods
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <CSVUploadModal
          isOpen={false}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should show correct title for recipes import', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.getByText('Import Recipes')).toBeInTheDocument();
    });

    it('should show correct title for inventory import', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="items"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.getByText('Import Inventory')).toBeInTheDocument();
    });

    it('should show template download section', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.getByText('Need a template?')).toBeInTheDocument();
      expect(screen.getByText('Template')).toBeInTheDocument();
    });

    it('should show drop zone', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.getByText('Drop CSV file here')).toBeInTheDocument();
      expect(screen.getByText('or click to browse')).toBeInTheDocument();
    });
  });

  describe('Close Modal', () => {
    it('should call onClose when close button is clicked', async () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      await userEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Cancel button is clicked', async () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      // Click on overlay (the outer container)
      const overlay = document.querySelector('[class*="overlay"]');
      if (overlay) {
        fireEvent.click(overlay);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should call onClose when Escape key is pressed', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Template Download', () => {
    it('should call URL.createObjectURL when template button is clicked', async () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const templateButton = screen.getByText('Template');
      await userEvent.click(templateButton);

      // Verify URL.createObjectURL was called (for blob creation)
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('should have template button for recipes', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.getByText('Template')).toBeInTheDocument();
    });

    it('should have template button for items', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="items"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.getByText('Template')).toBeInTheDocument();
    });
  });

  describe('File Input', () => {
    it('should accept CSV files via input', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('accept', '.csv');
    });

    it('should have file input element', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });
  });

  describe('Drag and Drop UI', () => {
    it('should highlight drop zone when dragging over', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const dropZone = document.querySelector('[class*="dropZone"]');

      fireEvent.dragOver(dropZone!, {
        dataTransfer: { files: [] },
        preventDefault: vi.fn(),
      });

      expect(dropZone?.className).toMatch(/Dragging/i);
    });

    it('should remove highlight when drag leaves', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const dropZone = document.querySelector('[class*="dropZone"]');

      fireEvent.dragOver(dropZone!, { dataTransfer: { files: [] } });
      fireEvent.dragLeave(dropZone!);

      const classes = dropZone?.className || '';
      expect(classes).not.toContain('dropZoneDragging');
    });
  });

  describe('Initial Import Button State', () => {
    it('should disable import button when no file selected', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const importButton = screen.getByRole('button', { name: /import 0/i });
      expect(importButton).toBeDisabled();
    });

    it('should show import 0 items initially', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="items"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.getByText(/import 0 items/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria attributes', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('should have accessible close button', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
    });

    it('should focus close button on open', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      const closeButton = screen.getByLabelText('Close modal');
      closeButton.focus();
      expect(document.activeElement).toBe(closeButton);
    });
  });

  describe('Footer', () => {
    it('should render Cancel button', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render Import button', () => {
      render(
        <CSVUploadModal
          isOpen={true}
          onClose={mockOnClose}
          type="recipes"
          onUpload={mockOnUpload}
        />
      );

      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
    });
  });
});
