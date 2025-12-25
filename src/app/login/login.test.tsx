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
  ElementCard: ({ element }: any) => (
    <div data-testid={`element-${element?.symbol}`}>{element?.name}</div>
  ),
}));

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
    mockSignup.mockResolvedValue(undefined);
    mockValidateToken.mockResolvedValue(false);
  });

  // Helper function to open the login modal
  const openLoginModal = async () => {
    render(<LoginPage />);
    // Click the "Log In" button to open modal (opens in login mode)
    const loginButton = screen.getByRole('button', { name: 'Log In' });
    await userEvent.click(loginButton);
  };

  // Helper function to open signup modal
  const openSignupModal = async () => {
    render(<LoginPage />);
    // Click the "Log In" button then switch to signup mode
    const loginButton = screen.getByRole('button', { name: 'Log In' });
    await userEvent.click(loginButton);
    // Switch to signup mode by clicking "Sign up" link
    const signupLink = screen.getByText('Sign up');
    await userEvent.click(signupLink);
  };

  // Helper to get the submit button (distinguishes from nav button)
  const getSubmitButton = () => {
    const buttons = screen.getAllByRole('button', { name: 'Log In' });
    return buttons.find(btn => btn.getAttribute('type') === 'submit')!;
  };

  describe('Rendering', () => {
    it('should render hero page with logo', () => {
      render(<LoginPage />);
      expect(screen.getByTestId('logo')).toBeInTheDocument();
    });

    it('should render Log In button in nav', () => {
      render(<LoginPage />);
      expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
    });

    it('should render periodic table preview elements', () => {
      render(<LoginPage />);
      // Check for sample elements from the preview
      expect(screen.getByText('Rum')).toBeInTheDocument();
      expect(screen.getByText('Gin')).toBeInTheDocument();
    });

    it('should open modal and render login form when Log In is clicked', async () => {
      await openLoginModal();
      // Modal should now show form elements
      expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call login with email and password', async () => {
      await openLoginModal();

      const emailInput = screen.getByPlaceholderText('you@example.com');
      // In login mode, placeholder is "Enter password"
      const passwordInput = screen.getByPlaceholderText('Enter password');

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');

      // Submit button (type="submit") in modal
      const submitButton = getSubmitButton();
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'Password123!' });
      });
    });

    it('should show validation error for empty fields', async () => {
      await openLoginModal();

      const submitButton = getSubmitButton();
      await userEvent.click(submitButton);

      // Login should not be called for empty fields
      expect(mockLogin).not.toHaveBeenCalled();
      // Should show error message
      expect(screen.getByText('Please fill in all fields')).toBeInTheDocument();
    });
  });

  describe('Sign Up Mode', () => {
    it('should have sign up link in modal', async () => {
      await openLoginModal();
      // Look for sign up link in the modal
      expect(screen.getByText(/Sign up/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible email input', async () => {
      await openLoginModal();
      const emailInput = screen.getByPlaceholderText('you@example.com');
      expect(emailInput).toBeInTheDocument();
    });

    it('should have accessible password input', async () => {
      await openLoginModal();
      const passwordInput = screen.getByPlaceholderText('Enter password');
      expect(passwordInput).toBeInTheDocument();
    });

    it('should have accessible submit button', async () => {
      await openLoginModal();
      // Use helper to get submit button (type="submit") vs nav button
      const submitButton = getSubmitButton();
      expect(submitButton).toHaveAttribute('type', 'submit');
    });
  });
});
