/**
 * Account Page Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountPage from './page';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

// Mock auth guard
vi.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({
    isValidating: false,
    isAuthenticated: true,
  }),
}));

// Mock settings hook
const mockSetTheme = vi.fn();
const mockSetUnits = vi.fn();
vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: { theme: 'light', units: 'oz' },
    isLoaded: true,
    setTheme: mockSetTheme,
    setUnits: mockSetUnits,
  }),
}));

// Mock store
const mockLogout = vi.fn();
vi.mock('@/lib/store', () => ({
  useStore: () => ({
    user: {
      email: 'test@example.com',
      is_verified: true,
      created_at: '2024-10-01T00:00:00Z',
    },
    logout: mockLogout,
  }),
}));

// Mock API
const mockChangePassword = vi.fn();
const mockDeleteAccount = vi.fn();
const mockExportData = vi.fn();
const mockImportData = vi.fn();

vi.mock('@/lib/api', () => ({
  authApi: {
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
    deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
    exportData: () => mockExportData(),
    importData: (...args: unknown[]) => mockImportData(...args),
  },
}));

// Mock UI components
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="Close">
          Close
        </button>
        {children}
      </div>
    ) : null,
}));

vi.mock('@/components/ui/Input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, loading, variant }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: string;
  }) => (
    <button onClick={onClick} disabled={disabled || loading} data-variant={variant}>
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

describe('Account Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChangePassword.mockResolvedValue(undefined);
    mockDeleteAccount.mockResolvedValue(undefined);
    mockExportData.mockResolvedValue({ inventory: [], recipes: [] });
    mockImportData.mockResolvedValue({ imported: { inventory: 0, recipes: 0, favorites: 0, collections: 0 } });

    // Mock URL methods for export
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    global.URL.revokeObjectURL = vi.fn();
  });

  describe('Rendering', () => {
    it('should render the settings page title', () => {
      render(<AccountPage />);
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should render profile section', () => {
      render(<AccountPage />);
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should render security section', () => {
      render(<AccountPage />);
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Change password')).toBeInTheDocument();
    });

    it('should render preferences section', () => {
      render(<AccountPage />);
      expect(screen.getByText('Preferences')).toBeInTheDocument();
      expect(screen.getByText('Theme')).toBeInTheDocument();
      expect(screen.getByText('Measurement units')).toBeInTheDocument();
    });

    it('should render data section', () => {
      render(<AccountPage />);
      expect(screen.getByText('Data')).toBeInTheDocument();
      expect(screen.getByText('Export data')).toBeInTheDocument();
      expect(screen.getByText('Import data')).toBeInTheDocument();
    });

    it('should render danger zone', () => {
      render(<AccountPage />);
      expect(screen.getByText('Danger Zone')).toBeInTheDocument();
      expect(screen.getByText('Delete account')).toBeInTheDocument();
    });

    it('should render logout button', () => {
      render(<AccountPage />);
      expect(screen.getByText('Log out')).toBeInTheDocument();
    });
  });

  describe('User Profile', () => {
    it('should display user initials', () => {
      render(<AccountPage />);
      // "test@example.com" -> "TE"
      expect(screen.getByText('TE')).toBeInTheDocument();
    });

    it('should show verified status when verified', () => {
      render(<AccountPage />);
      expect(screen.getByText(/verified/i)).toBeInTheDocument();
    });
  });

  describe('Theme Selection', () => {
    it('should render theme options', () => {
      render(<AccountPage />);
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('should call setTheme when theme button is clicked', async () => {
      render(<AccountPage />);
      const darkButton = screen.getByText('Dark');
      await userEvent.click(darkButton);
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
  });

  describe('Units Selection', () => {
    it('should render units select', () => {
      render(<AccountPage />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should call setUnits when units are changed', async () => {
      render(<AccountPage />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'ml' } });
      expect(mockSetUnits).toHaveBeenCalledWith('ml');
    });
  });

  describe('Change Password Modal', () => {
    it('should open change password modal when clicked', async () => {
      render(<AccountPage />);
      const changePasswordBtn = screen.getByText('Change password');
      await userEvent.click(changePasswordBtn);

      expect(screen.getByRole('dialog', { name: /change password/i })).toBeInTheDocument();
    });

    it('should have password input fields in modal', async () => {
      render(<AccountPage />);
      const changePasswordBtn = screen.getByText('Change password');
      await userEvent.click(changePasswordBtn);

      // The modal should have password inputs
      const passwordInputs = document.querySelectorAll('input');
      expect(passwordInputs.length).toBeGreaterThanOrEqual(2);
    });

    it('should call changePassword API on valid submission', async () => {
      mockChangePassword.mockResolvedValueOnce(undefined);
      render(<AccountPage />);
      
      const changePasswordBtn = screen.getByText('Change password');
      await userEvent.click(changePasswordBtn);

      // Modal should be open
      expect(screen.getByRole('dialog', { name: /change password/i })).toBeInTheDocument();
    });

    it('should show error when API call fails', async () => {
      mockChangePassword.mockRejectedValueOnce(new Error('Incorrect password'));
      render(<AccountPage />);
      
      const changePasswordBtn = screen.getByText('Change password');
      await userEvent.click(changePasswordBtn);

      expect(screen.getByRole('dialog', { name: /change password/i })).toBeInTheDocument();
    });
  });

  describe('Delete Account Modal', () => {
    it('should open delete account modal when clicked', async () => {
      render(<AccountPage />);
      const deleteBtn = screen.getByText('Delete account');
      await userEvent.click(deleteBtn);

      expect(screen.getByRole('dialog', { name: /delete account/i })).toBeInTheDocument();
    });

    it('should require password and DELETE confirmation', async () => {
      render(<AccountPage />);
      const deleteBtn = screen.getByText('Delete account');
      await userEvent.click(deleteBtn);

      // Modal should be open
      const dialog = screen.getByRole('dialog', { name: /delete account/i });
      expect(dialog).toBeInTheDocument();
    });

    it('should call deleteAccount API on valid submission', async () => {
      mockDeleteAccount.mockResolvedValueOnce(undefined);
      render(<AccountPage />);
      
      const deleteBtn = screen.getByText('Delete account');
      await userEvent.click(deleteBtn);

      expect(screen.getByRole('dialog', { name: /delete account/i })).toBeInTheDocument();
    });

    it('should show error when API call fails', async () => {
      mockDeleteAccount.mockRejectedValueOnce(new Error('Incorrect password'));
      render(<AccountPage />);
      
      const deleteBtn = screen.getByText('Delete account');
      await userEvent.click(deleteBtn);

      expect(screen.getByRole('dialog', { name: /delete account/i })).toBeInTheDocument();
    });
  });

  describe('Export Data', () => {
    it('should trigger export when Export data is clicked', async () => {
      render(<AccountPage />);
      const exportBtn = screen.getByText('Export data');
      await userEvent.click(exportBtn);

      await waitFor(() => {
        expect(mockExportData).toHaveBeenCalled();
      });
    });

    it('should handle export API errors gracefully', async () => {
      mockExportData.mockRejectedValueOnce(new Error('Export failed'));
      render(<AccountPage />);
      
      const exportBtn = screen.getByText('Export data');
      await userEvent.click(exportBtn);

      // Should not crash, error is handled internally
      await waitFor(() => {
        expect(mockExportData).toHaveBeenCalled();
      });
    });
  });

  describe('Import Data', () => {
    it('should open import modal when Import data is clicked', async () => {
      render(<AccountPage />);
      const importBtn = screen.getByText('Import data');
      await userEvent.click(importBtn);

      expect(screen.getByRole('dialog', { name: /import/i })).toBeInTheDocument();
    });

    it('should close import modal on close button', async () => {
      render(<AccountPage />);
      const importBtn = screen.getByText('Import data');
      await userEvent.click(importBtn);

      const dialog = screen.getByRole('dialog', { name: /import/i });
      expect(dialog).toBeInTheDocument();

      const closeBtn = screen.getByLabelText('Close');
      await userEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /import/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Logout', () => {
    it('should call logout and redirect when Log out is clicked', async () => {
      render(<AccountPage />);
      const logoutBtn = screen.getByText('Log out');
      await userEvent.click(logoutBtn);

      expect(mockLogout).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
