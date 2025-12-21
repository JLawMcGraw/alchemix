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

  // Helper function to open the login modal (signup mode first, then switch to login)
  const openLoginModal = async () => {
    render(<LoginPage />);
    // Click the "Get Started" button to open modal (opens in signup mode)
    const getStartedButton = screen.getByText('Get Started');
    await userEvent.click(getStartedButton);
    // Switch to login mode by clicking "Log in" link
    const loginLink = screen.getByText('Log in');
    await userEvent.click(loginLink);
  };

  // Helper function to open signup modal
  const openSignupModal = async () => {
    render(<LoginPage />);
    // Click the "Get Started" button to open modal (opens in signup mode)
    const getStartedButton = screen.getByText('Get Started');
    await userEvent.click(getStartedButton);
  };

  describe('Rendering', () => {
    it('should render hero page with logo', () => {
      render(<LoginPage />);
      expect(screen.getByTestId('logo')).toBeInTheDocument();
    });

    it('should render Get Started button', () => {
      render(<LoginPage />);
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    it('should render periodic table preview elements', () => {
      render(<LoginPage />);
      // Check for sample elements from the preview
      expect(screen.getByText('Rum')).toBeInTheDocument();
      expect(screen.getByText('Gin')).toBeInTheDocument();
    });

    it('should open modal and render login form when Get Started is clicked', async () => {
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

      // Submit button text is "Log In" in login mode
      const submitButton = screen.getByText('Log In');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'Password123!' });
      });
    });

    it('should show validation error for empty fields', async () => {
      await openLoginModal();

      const submitButton = screen.getByText('Log In');
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
      const submitButton = screen.getByText('Log In');
      expect(submitButton).toBeInTheDocument();
    });
  });
});
