/**
 * Login Page Tests
 *
 * Tests the login/signup page functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './page';

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock store
const mockLogin = vi.fn();
const mockSignup = vi.fn();
const mockValidateToken = vi.fn();

vi.mock('@/lib/store', () => ({
  useStore: () => ({
    login: mockLogin,
    signup: mockSignup,
    validateToken: mockValidateToken,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    _hasHydrated: true,
  }),
}));

// Mock passwordPolicy
vi.mock('@/lib/passwordPolicy', () => ({
  validatePassword: () => ({ isValid: true, errors: [] }),
  checkPasswordRequirements: () => ({
    minLength: true,
    hasUppercase: true,
    hasLowercase: true,
    hasNumber: true,
    hasSpecial: true,
  }),
}));

// Mock UI components
vi.mock('@/components/ui', () => ({
  AlcheMixLogo: () => <div data-testid="logo">Logo</div>,
  Button: ({ children, onClick, disabled, loading, type }: any) => (
    <button onClick={onClick} disabled={disabled || loading} type={type}>
      {loading ? 'Loading...' : children}
    </button>
  ),
  Card: ({ children }: any) => <div>{children}</div>,
  Input: ({ placeholder, type, value, onChange, ...props }: any) => (
    <input placeholder={placeholder} type={type} value={value} onChange={onChange} {...props} />
  ),
}));

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
    mockSignup.mockResolvedValue(undefined);
    mockValidateToken.mockResolvedValue(false);
  });

  describe('Rendering', () => {
    it('should render login form by default', () => {
      render(<LoginPage />);

      // Check for essential elements using actual placeholders
      expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<LoginPage />);
      // There are two "Log In" buttons (tab + submit), find the submit one
      const submitButtons = screen.getAllByRole('button', { name: /log in/i });
      const actualSubmit = submitButtons.find(btn => btn.getAttribute('type') === 'submit');
      expect(actualSubmit).toBeInTheDocument();
    });

    it('should render email input field', () => {
      render(<LoginPage />);
      const emailInput = screen.getByPlaceholderText('you@example.com');
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should render password input field', () => {
      render(<LoginPage />);
      const passwordInput = screen.getByPlaceholderText('Enter password');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Form Submission', () => {
    it('should call login with email and password', async () => {
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('you@example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');

      const submitButtons = screen.getAllByRole('button', { name: /log in/i });
      const submitButton = submitButtons.find(btn => btn.getAttribute('type') === 'submit')!;
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'Password123!' });
      });
    });

    it('should show validation error for empty fields', async () => {
      render(<LoginPage />);

      const submitButtons = screen.getAllByRole('button', { name: /log in/i });
      const submitButton = submitButtons.find(btn => btn.getAttribute('type') === 'submit')!;
      await userEvent.click(submitButton);

      // Login should not be called for empty fields
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  describe('Sign Up Mode', () => {
    it('should have sign up link', () => {
      render(<LoginPage />);
      // Look for any element that mentions sign up
      expect(screen.getByText(/sign up/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible email input', () => {
      render(<LoginPage />);
      const emailInput = screen.getByPlaceholderText('you@example.com');
      expect(emailInput).toBeInTheDocument();
    });

    it('should have accessible password input', () => {
      render(<LoginPage />);
      const passwordInput = screen.getByPlaceholderText('Enter password');
      expect(passwordInput).toBeInTheDocument();
    });

    it('should have accessible submit button', () => {
      render(<LoginPage />);
      const submitButtons = screen.getAllByRole('button', { name: /log in/i });
      const submitButton = submitButtons.find(btn => btn.getAttribute('type') === 'submit');
      expect(submitButton).toBeInTheDocument();
    });
  });
});
