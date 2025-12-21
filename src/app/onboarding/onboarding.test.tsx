/**
 * Onboarding Page Tests
 *
 * Tests the 3-step onboarding flow functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

// Mock store with all required functions
vi.mock('@/lib/store', () => ({
  useStore: () => ({
    user: { id: 1, email: 'test@example.com', has_seeded_classics: false },
    isAuthenticated: true,
    isValidating: false,
    validateToken: vi.fn().mockResolvedValue(true),
    fetchItems: vi.fn().mockResolvedValue([]),
    addItem: vi.fn().mockResolvedValue({ id: 1 }),
    fetchRecipes: vi.fn().mockResolvedValue([]),
    inventoryItems: [],
    recipes: [],
  }),
}));

// Mock API
vi.mock('@/lib/api', () => ({
  inventoryApi: {
    add: vi.fn().mockResolvedValue({ id: 1 }),
  },
  recipeApi: {
    seedClassics: vi.fn().mockResolvedValue({ seeded: true, count: 20 }),
  },
}));

// Mock periodicTable
vi.mock('@/lib/periodicTable', () => ({
  PERIODIC_SECTIONS: [
    {
      title: 'BASE SPIRITS',
      elements: [
        { symbol: 'Br', name: 'Bourbon', group: 'grain', hidden: false },
        { symbol: 'Gn', name: 'Gin', group: 'juniper', hidden: false },
        { symbol: 'Vk', name: 'Vodka', group: 'neutral', hidden: false },
      ],
    },
    {
      title: 'LIQUEURS',
      elements: [
        { symbol: 'Ol', name: 'Orange Liqueur', group: 'sugar', hidden: false },
      ],
    },
    {
      title: 'MODIFIERS',
      elements: [
        { symbol: 'An', name: 'Angostura', group: 'botanical', hidden: false },
      ],
    },
    {
      title: 'CITRUS',
      elements: [
        { symbol: 'Li', name: 'Lime', group: 'acid', hidden: false },
      ],
    },
    {
      title: 'SWEETENERS',
      elements: [
        { symbol: 'Ss', name: 'Simple Syrup', group: 'sugar', hidden: false },
      ],
    },
  ],
  GROUP_COLORS: {
    grain: '#D97706',
    juniper: '#0EA5E9',
    neutral: '#94A3B8',
    sugar: '#6366F1',
    botanical: '#EC4899',
    acid: '#F59E0B',
  },
}));

// Mock recipe-molecule
vi.mock('@alchemix/recipe-molecule', () => ({
  generateFormula: vi.fn(() => 'Br₂ · Si · An₂'),
}));

// Mock modals
vi.mock('@/components/modals', () => ({
  RecipeDetailModal: ({ isOpen, onClose }: any) =>
    isOpen ? <div data-testid="recipe-modal"><button onClick={onClose}>Close</button></div> : null,
}));

// Mock UI components
vi.mock('@/components/ui', () => ({
  AlcheMixLogo: ({ size }: any) => <div data-testid="logo" data-size={size}>Logo</div>,
}));

// Import after mocks
import OnboardingPage from './page';
import { recipeApi } from '@/lib/api';

describe('Onboarding Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('replay');
  });

  describe('Step 1: Welcome', () => {
    it('should render welcome screen with logo', async () => {
      await act(async () => {
        render(<OnboardingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Welcome to AlcheMix')).toBeInTheDocument();
      });
      // Multiple logos on page (header + welcome content)
      expect(screen.getAllByTestId('logo').length).toBeGreaterThan(0);
    });

    it('should show step indicator', async () => {
      await act(async () => {
        render(<OnboardingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 1 OF 3')).toBeInTheDocument();
      });
    });

    it('should have skip button', async () => {
      await act(async () => {
        render(<OnboardingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Skip Setup')).toBeInTheDocument();
      });
    });

    it('should have continue button', async () => {
      await act(async () => {
        render(<OnboardingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to step 2 when clicking continue', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      // Allow time for animation
      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Skip Flow', () => {
    it('should call seedClassics when skipping', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Skip Setup')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Skip Setup'));
      });

      await waitFor(() => {
        expect(recipeApi.seedClassics).toHaveBeenCalled();
      });
    });

    it('should redirect to dashboard when skipping', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Skip Setup')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Skip Setup'));
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });
  });
});
