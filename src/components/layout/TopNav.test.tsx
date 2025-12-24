/**
 * TopNav Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TopNav } from './TopNav';

// Mock next/navigation
const mockPush = vi.fn();
const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockUsePathname(),
}));

// Mock zustand store
const mockLogout = vi.fn();
const mockStore = {
  user: { email: 'test@example.com', is_verified: true },
  isAuthenticated: true,
  logout: mockLogout,
  favorites: [{ id: 1 }, { id: 2 }],
  shoppingListItems: [
    { id: 1, checked: false },
    { id: 2, checked: true },
    { id: 3, checked: false },
  ],
};

vi.mock('@/lib/store', () => ({
  useStore: (selector: (state: typeof mockStore) => any) => selector(mockStore),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

// Mock UI components
vi.mock('@/components/ui', () => ({
  AlcheMixLogo: ({ size, showText }: any) => (
    <div data-testid="logo" data-size={size} data-show-text={showText}>
      AlcheMix Logo
    </div>
  ),
}));

describe('TopNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/dashboard');
  });

  describe('Rendering', () => {
    it('should render the logo', () => {
      render(<TopNav />);
      expect(screen.getByTestId('logo')).toBeInTheDocument();
    });

    it('should render navigation links', () => {
      render(<TopNav />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('My Bar')).toBeInTheDocument();
      expect(screen.getByText('Ask the Bartender')).toBeInTheDocument();
      expect(screen.getByText('Recipes')).toBeInTheDocument();
      expect(screen.getByText('Shopping List')).toBeInTheDocument();
      // Note: Favorites was moved to Recipes page as a tab (Dec 19, 2025)
    });

    it('should render user avatar with initials', () => {
      render(<TopNav />);

      // "test@example.com" -> "TE"
      expect(screen.getByText('TE')).toBeInTheDocument();
    });

  });

  describe('User Menu', () => {
    it('should open user menu when avatar is clicked', async () => {
      render(<TopNav />);

      const avatar = screen.getByLabelText('User menu');
      fireEvent.click(avatar);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Log Out')).toBeInTheDocument();
      });
    });

    it('should show user email in dropdown', async () => {
      render(<TopNav />);

      const avatar = screen.getByLabelText('User menu');
      fireEvent.click(avatar);

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('should navigate to settings when Settings is clicked', async () => {
      render(<TopNav />);

      const avatar = screen.getByLabelText('User menu');
      fireEvent.click(avatar);

      await waitFor(() => {
        const settingsLink = screen.getByText('Settings');
        expect(settingsLink.closest('a')).toHaveAttribute('href', '/account');
      });
    });

    it('should call logout and navigate when Log Out is clicked', async () => {
      render(<TopNav />);

      const avatar = screen.getByLabelText('User menu');
      fireEvent.click(avatar);

      await waitFor(() => {
        const logoutButton = screen.getByText('Log Out');
        fireEvent.click(logoutButton);
      });

      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  describe('Hidden Pages', () => {
    it('should not render on login page', () => {
      mockUsePathname.mockReturnValue('/login');
      const { container } = render(<TopNav />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render on onboarding page', () => {
      mockUsePathname.mockReturnValue('/onboarding');
      const { container } = render(<TopNav />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('AI Indicator', () => {
    it('should show AI indicator on Ask the Bartender link', () => {
      render(<TopNav />);

      const aiLink = screen.getByText('Ask the Bartender').closest('a');
      const indicator = aiLink?.querySelector('[class*="aiIndicator"]');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Logo Link', () => {
    it('should link to dashboard', () => {
      render(<TopNav />);

      const logoLink = screen.getByTestId('logo').closest('a');
      expect(logoLink).toHaveAttribute('href', '/dashboard');
    });
  });

  describe('User Initials', () => {
    it('should use first two characters of email username', () => {
      render(<TopNav />);
      // test@example.com -> "TE"
      expect(screen.getByText('TE')).toBeInTheDocument();
    });
  });
});
