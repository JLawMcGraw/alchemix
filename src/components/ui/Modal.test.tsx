import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset body overflow after each test
    document.body.style.overflow = '';
  });

  describe('Rendering', () => {
    it('should render when isOpen is true', () => {
      render(<Modal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render title correctly', () => {
      render(<Modal {...defaultProps} title="Custom Title" />);

      expect(screen.getByRole('heading', { name: 'Custom Title' })).toBeInTheDocument();
    });

    it('should render children content', () => {
      render(
        <Modal {...defaultProps}>
          <p>Custom children content</p>
          <button>Action button</button>
        </Modal>
      );

      expect(screen.getByText('Custom children content')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action button' })).toBeInTheDocument();
    });

    it('should have correct accessibility attributes', () => {
      render(<Modal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should render close button with accessible label', () => {
      render(<Modal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument();
    });
  });

  describe('Close interactions', () => {
    it('should call onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<Modal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: 'Close modal' }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should call onClose when backdrop is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<Modal {...defaultProps} onClose={onClose} />);

      // The backdrop has the onClick handler
      const backdrop = screen.getByRole('dialog').parentElement;
      if (backdrop) {
        await user.click(backdrop);
        expect(onClose).toHaveBeenCalledOnce();
      }
    });

    it('should not call onClose when modal content is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(<Modal {...defaultProps} onClose={onClose} />);

      // Click on the modal dialog itself, not the backdrop
      await user.click(screen.getByRole('dialog'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should call onClose when Escape key is pressed', () => {
      const onClose = vi.fn();

      render(<Modal {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should not call onClose on Escape when modal is closed', () => {
      const onClose = vi.fn();

      render(<Modal {...defaultProps} isOpen={false} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Body scroll prevention', () => {
    it('should set body overflow to hidden when modal opens', () => {
      render(<Modal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should reset body overflow when modal closes', () => {
      const { rerender } = render(<Modal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<Modal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('');
    });

    it('should reset body overflow on unmount', () => {
      const { unmount } = render(<Modal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');

      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Event listener cleanup', () => {
    it('should remove keydown listener when modal closes', () => {
      const onClose = vi.fn();
      const addSpy = vi.spyOn(document, 'addEventListener');
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const { rerender } = render(<Modal {...defaultProps} onClose={onClose} />);
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      rerender(<Modal {...defaultProps} isOpen={false} onClose={onClose} />);
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('should remove keydown listener on unmount', () => {
      const onClose = vi.fn();
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<Modal {...defaultProps} onClose={onClose} />);
      unmount();

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeSpy.mockRestore();
    });
  });

  describe('Multiple modals', () => {
    it('should handle opening and closing properly', () => {
      const onClose = vi.fn();
      const { rerender } = render(<Modal {...defaultProps} onClose={onClose} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(<Modal {...defaultProps} isOpen={false} onClose={onClose} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      rerender(<Modal {...defaultProps} isOpen={true} onClose={onClose} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
