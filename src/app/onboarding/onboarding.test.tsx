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
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock store with all required functions
const mockValidateToken = vi.fn().mockResolvedValue(true);
let mockUser: { id: number; email: string; has_seeded_classics: boolean } | null = {
  id: 1,
  email: 'test@example.com',
  has_seeded_classics: false,
};
let mockIsAuthenticated = true;

vi.mock('@/lib/store', () => ({
  useStore: () => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    isValidating: false,
    validateToken: mockValidateToken,
    fetchItems: vi.fn().mockResolvedValue([]),
    addItem: vi.fn().mockResolvedValue({ id: 1 }),
    fetchRecipes: vi.fn().mockResolvedValue([]),
    inventoryItems: [],
    recipes: [],
  }),
}));

// Mock API
const mockGetAll = vi.fn().mockResolvedValue({ items: [], pagination: {} });
const mockAdd = vi.fn().mockResolvedValue({ id: 1 });
const mockSeedClassics = vi.fn().mockResolvedValue({ seeded: true, count: 105 });
vi.mock('@/lib/api', () => ({
  inventoryApi: {
    add: (...args: unknown[]) => mockAdd(...args),
    getAll: () => mockGetAll(),
  },
  recipeApi: {
    seedClassics: () => mockSeedClassics(),
    // Mock classic recipes - need 13+ recipes to test pagination (6 per page)
    getClassics: vi.fn().mockResolvedValue([
      {
        name: 'Old Fashioned',
        ingredients: ['2 oz Bourbon', '1 Sugar cube', '2-3 dashes Angostura bitters'],
        instructions: 'Muddle sugar with bitters. Add whiskey and ice. Stir.',
        glass: 'Rocks',
        spirit_type: 'whiskey',
        requires: ['Bb'],
      },
      {
        name: 'Margarita',
        ingredients: ['2 oz Tequila', '1 oz Lime juice', '1/2 oz Triple sec'],
        instructions: 'Shake with ice. Strain into salt-rimmed glass.',
        glass: 'Rocks',
        spirit_type: 'tequila',
        requires: ['Tq', 'Ol', 'Li'],
      },
      {
        name: 'Daiquiri',
        ingredients: ['2 oz Rum', '1 oz Lime juice', '3/4 oz Simple syrup'],
        instructions: 'Shake with ice. Strain into coupe.',
        glass: 'Coupe',
        spirit_type: 'rum',
        requires: ['Rm', 'Li'],
      },
      {
        name: 'Mojito',
        ingredients: ['2 oz Rum', '1 oz Lime juice', 'Mint', 'Soda'],
        instructions: 'Muddle mint. Add rum and lime. Top with soda.',
        glass: 'Highball',
        spirit_type: 'rum',
        requires: ['Rm', 'Li', 'Mt'],
      },
      {
        name: 'Moscow Mule',
        ingredients: ['2 oz Vodka', '1/2 oz Lime juice', 'Ginger beer'],
        instructions: 'Build in copper mug over ice.',
        glass: 'Copper Mug',
        spirit_type: 'vodka',
        requires: ['Vd', 'Li', 'Gb'],
      },
      {
        name: 'Gin and Tonic',
        ingredients: ['2 oz Gin', 'Tonic water'],
        instructions: 'Build over ice. Garnish with lime.',
        glass: 'Highball',
        spirit_type: 'gin',
        requires: ['Gn'],
      },
      {
        name: 'Whiskey Sour',
        ingredients: ['2 oz Bourbon', '3/4 oz Lemon juice', '1/2 oz Simple syrup'],
        instructions: 'Shake with ice. Strain into rocks glass.',
        glass: 'Rocks',
        spirit_type: 'whiskey',
        requires: ['Bb', 'Le'],
      },
      {
        name: 'Negroni',
        ingredients: ['1 oz Gin', '1 oz Campari', '1 oz Sweet Vermouth'],
        instructions: 'Stir with ice. Strain into rocks glass.',
        glass: 'Rocks',
        spirit_type: 'gin',
        requires: ['Gn', 'Cp', 'Sv'],
      },
      // Additional recipes to enable pagination testing
      {
        name: 'Vodka Martini',
        ingredients: ['2 oz Vodka', '1/2 oz Dry Vermouth'],
        instructions: 'Stir with ice. Strain into martini glass.',
        glass: 'Martini',
        spirit_type: 'vodka',
        requires: ['Vd', 'Dv'],
      },
      {
        name: 'Gimlet',
        ingredients: ['2 oz Gin', '3/4 oz Lime juice'],
        instructions: 'Shake with ice. Strain into coupe.',
        glass: 'Coupe',
        spirit_type: 'gin',
        requires: ['Gn', 'Li'],
      },
      {
        name: 'Dark and Stormy',
        ingredients: ['2 oz Rum', 'Ginger beer', 'Lime'],
        instructions: 'Build over ice. Top with ginger beer.',
        glass: 'Highball',
        spirit_type: 'rum',
        requires: ['Rm', 'Gb'],
      },
      {
        name: 'Rum Punch',
        ingredients: ['2 oz Rum', '1 oz Lime juice', '1 oz Grenadine'],
        instructions: 'Shake all ingredients with ice. Strain into glass.',
        glass: 'Highball',
        spirit_type: 'rum',
        requires: ['Rm', 'Li', 'Gr'],
      },
      {
        name: 'Gin Fizz',
        ingredients: ['2 oz Gin', '1 oz Lemon juice', 'Soda water'],
        instructions: 'Shake gin and lemon. Top with soda.',
        glass: 'Collins',
        spirit_type: 'gin',
        requires: ['Gn', 'Le'],
      },
      {
        name: 'Paloma',
        ingredients: ['2 oz Tequila', '1/2 oz Lime juice', 'Grapefruit soda'],
        instructions: 'Build over ice in salt-rimmed glass.',
        glass: 'Highball',
        spirit_type: 'tequila',
        requires: ['Tq', 'Li', 'Gf'],
      },
    ]),
  },
}));

// Mock periodicTable - must match what getQuickAddElements() returns
vi.mock('@/lib/periodicTable', () => ({
  PERIODIC_SECTIONS: [
    {
      title: 'BASE SPIRITS',
      elements: [
        { symbol: 'Rm', name: 'Rum', group: 'cane', hidden: false },
        { symbol: 'Vd', name: 'Vodka', group: 'neutral', hidden: false },
        { symbol: 'Gn', name: 'Gin', group: 'juniper', hidden: false },
        { symbol: 'Bb', name: 'Bourbon', group: 'grain', hidden: false },
        { symbol: 'Ry', name: 'Rye', group: 'grain', hidden: false },
        { symbol: 'Sc', name: 'Scotch', group: 'grain', hidden: false },
        { symbol: 'Tq', name: 'Tequila', group: 'agave', hidden: false },
        { symbol: 'Mz', name: 'Mezcal', group: 'agave', hidden: false },
        { symbol: 'Br', name: 'Brandy', group: 'grape', hidden: false },
        { symbol: 'Cg', name: 'Cognac', group: 'grape', hidden: false },
      ],
    },
    {
      title: 'LIQUEURS',
      elements: [
        { symbol: 'Ol', name: 'Orange Liqueur', group: 'sugar', hidden: false },
        { symbol: 'Cf', name: 'Coffee Liqueur', group: 'sugar', hidden: false },
        { symbol: 'Ms', name: 'Maraschino', group: 'sugar', hidden: false },
        { symbol: 'Ct', name: 'Chartreuse', group: 'sugar', hidden: false },
        { symbol: 'Am', name: 'Amaretto', group: 'sugar', hidden: false },
        { symbol: 'Co', name: 'Crème de Cacao', group: 'sugar', hidden: false },
      ],
    },
    {
      title: 'BITTERS & BOTANICALS',
      elements: [
        { symbol: 'Cp', name: 'Campari', group: 'botanical', hidden: false },
        { symbol: 'Ap', name: 'Aperol', group: 'botanical', hidden: false },
        { symbol: 'Sv', name: 'Sweet Vermouth', group: 'botanical', hidden: false },
        { symbol: 'Dv', name: 'Dry Vermouth', group: 'botanical', hidden: false },
        { symbol: 'Ab', name: 'Absinthe', group: 'botanical', hidden: false },
      ],
    },
    {
      title: 'MIXERS & OTHER',
      elements: [
        { symbol: 'Sp', name: 'Sparkling Wine', group: 'grape', hidden: false },
        { symbol: 'Gb', name: 'Ginger Beer', group: 'carbonation', hidden: false },
        { symbol: 'Cr', name: 'Cream', group: 'dairy', hidden: false },
        { symbol: 'Nc', name: 'Coconut Cream', group: 'dairy', hidden: false },
      ],
    },
    {
      title: 'GARNISHES',
      elements: [
        { symbol: 'Mt', name: 'Fresh Mint', group: 'garnish', hidden: false },
      ],
    },
    {
      title: 'SWEETENERS',
      elements: [
        { symbol: 'Og', name: 'Orgeat', group: 'sugar', hidden: false },
        { symbol: 'Hn', name: 'Honey', group: 'sugar', hidden: false },
        { symbol: 'Gr', name: 'Grenadine', group: 'sugar', hidden: false },
      ],
    },
    {
      title: 'CITRUS & ACIDS',
      elements: [
        { symbol: 'Li', name: 'Lime', group: 'acid', hidden: false },
        { symbol: 'Le', name: 'Lemon', group: 'acid', hidden: false },
        { symbol: 'Gf', name: 'Grapefruit', group: 'acid', hidden: false },
      ],
    },
  ],
  GROUP_COLORS: {
    grain: '#D97706',
    juniper: '#0EA5E9',
    neutral: '#94A3B8',
    cane: '#22C55E',
    agave: '#14B8A6',
    sugar: '#6366F1',
    botanical: '#EC4899',
    acid: '#F59E0B',
    grape: '#8B5CF6',
    carbonation: '#CBD5E1',
    garnish: '#34D399',
    dairy: '#F5F5DC',
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

describe('Onboarding Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockUser = { id: 1, email: 'test@example.com', has_seeded_classics: false };
    mockIsAuthenticated = true;
    mockGetAll.mockResolvedValue({ items: [], pagination: {} });
    mockAdd.mockResolvedValue({ id: 1 });
    mockSeedClassics.mockResolvedValue({ seeded: true, count: 105 });
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
        expect(mockSeedClassics).toHaveBeenCalled();
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

  describe('Step 2: Element Selection', () => {
    it('should show element grid on step 2', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Should show elements
      await waitFor(() => {
        expect(screen.getByText('Bourbon')).toBeInTheDocument();
        expect(screen.getByText('Gin')).toBeInTheDocument();
      });
    });

    it('should allow selecting elements', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click on Bourbon element
      await waitFor(() => {
        expect(screen.getByText('Bourbon')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      // Should have selected class on element
      await waitFor(() => {
        const bourbonCard = screen.getByText('Bourbon').parentElement;
        expect(bourbonCard?.className).toContain('selected');
      });
    });
  });

  describe('Step 3: Results with Pagination', () => {
    it('should show pagination when more than 6 recipes are makeable', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select multiple elements to unlock multiple recipes
      await waitFor(() => {
        expect(screen.getByText('Bourbon')).toBeInTheDocument();
      });

      // Select Bourbon, Gin, Rum, Vodka, Lime - should unlock multiple recipes
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });
      await act(async () => {
        await user.click(screen.getByText('Gin'));
      });
      await act(async () => {
        await user.click(screen.getByText('Rum'));
      });

      // Navigate to step 3
      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Should show cocktails you can make
      await waitFor(() => {
        expect(screen.getByText(/cocktails you can make/i)).toBeInTheDocument();
      });
    });

    it('should show Enter AlcheMix button on step 3', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select an element
      await waitFor(() => {
        expect(screen.getByText('Bourbon')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      // Navigate to step 3
      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Should show Enter AlcheMix button
      await waitFor(() => {
        expect(screen.getByText('Enter AlcheMix')).toBeInTheDocument();
      });
    });

    it('should show empty state when no recipes match selected elements', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select only Cream - no recipes require just cream
      await waitFor(() => {
        expect(screen.getByText('Cream')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Cream'));
      });

      // Navigate to step 3
      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText('Add more bottles to see what you can make')).toBeInTheDocument();
      });
    });

    it('should allow pagination navigation with prev/next buttons', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select elements that unlock many recipes (need 7+ to trigger pagination with 6 per page)
      // Based on mockClassicRecipes:
      // - Bb: Old Fashioned (1)
      // - Gn: Gin and Tonic (2)
      // - Gn + Li: Gimlet (3)
      // - Gn + Le: Gin Fizz (4)
      // - Rm + Li: Daiquiri (5)
      // - Rm + Gb: Dark and Stormy (6)
      // - Bb + Le: Whiskey Sour (7)
      // - Vd + Li + Gb: Moscow Mule (8)
      await waitFor(() => {
        expect(screen.getByText('Bourbon')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });
      await act(async () => {
        await user.click(screen.getByText('Gin'));
      });
      await act(async () => {
        await user.click(screen.getByText('Rum'));
      });
      await act(async () => {
        await user.click(screen.getByText('Vodka'));
      });
      await act(async () => {
        await user.click(screen.getByText('Lime'));
      });
      await act(async () => {
        await user.click(screen.getByText('Lemon'));
      });
      await act(async () => {
        await user.click(screen.getByText('Ginger Beer'));
      });

      // Navigate to step 3
      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Should show pagination with page 1 (8 recipes = 2 pages)
      await waitFor(() => {
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
      });

      // Click Next
      await act(async () => {
        await user.click(screen.getByText('Next →'));
      });

      // Should now show page 2
      await waitFor(() => {
        expect(screen.getByText('2 / 2')).toBeInTheDocument();
      });

      // Click Prev
      await act(async () => {
        await user.click(screen.getByText('← Prev'));
      });

      // Should now show page 1 again
      await waitFor(() => {
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
      });
    });
  });

  describe('Step 2: Live Counter', () => {
    it('should update live counter when selecting elements', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Initially should show 0 cocktails
      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
        expect(screen.getByText('cocktails')).toBeInTheDocument();
      });

      // Select Bourbon - should unlock Old Fashioned (1 recipe)
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      // Counter should update to 1
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Select Gin - should unlock Gin and Tonic (2 total)
      await act(async () => {
        await user.click(screen.getByText('Gin'));
      });

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('should have continue button disabled when no elements selected', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Continue button should be disabled
      const continueBtn = screen.getByText('See My Cocktails').closest('button');
      expect(continueBtn).toBeDisabled();

      // Select an element
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      // Button should now be enabled
      expect(continueBtn).not.toBeDisabled();
    });

    it('should allow deselecting elements', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select Bourbon
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      // Verify it's selected
      await waitFor(() => {
        const bourbonCard = screen.getByText('Bourbon').parentElement;
        expect(bourbonCard?.className).toContain('selected');
      });

      // Click again to deselect
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      // Verify it's deselected
      await waitFor(() => {
        const bourbonCard = screen.getByText('Bourbon').parentElement;
        expect(bourbonCard?.className).not.toContain('selected');
      });

      // Counter should be back to 0
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Back Navigation', () => {
    it('should navigate back from step 2 to step 1', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click Back button
      await act(async () => {
        await user.click(screen.getByText('← Back'));
      });

      // Should be back at step 1
      await waitFor(() => {
        expect(screen.getByText('STEP 1 OF 3')).toBeInTheDocument();
        expect(screen.getByText('Welcome to AlcheMix')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should navigate back from step 3 to step 2', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select an element and go to step 3
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click Add More Bottles (back button)
      await act(async () => {
        await user.click(screen.getByText('← Add More Bottles'));
      });

      // Should be back at step 2
      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
        expect(screen.getByText("What's in your bar?")).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Recipe Modal', () => {
    it('should open recipe modal when clicking a recipe card', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select Bourbon to unlock Old Fashioned
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      // Navigate to step 3
      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click on Old Fashioned recipe card
      await waitFor(() => {
        expect(screen.getByText('Old Fashioned')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText('Old Fashioned'));
      });

      // Modal should be open
      await waitFor(() => {
        expect(screen.getByTestId('recipe-modal')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Flow', () => {
    it('should save inventory items when completing onboarding', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select Bourbon and Gin (separate act calls to ensure both selections register)
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });
      await act(async () => {
        await user.click(screen.getByText('Gin'));
      });

      // Verify both elements are selected (should unlock 2 recipes: Old Fashioned + Gin and Tonic)
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Counter shows 2 cocktails
      });

      // Navigate to step 3
      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click Enter AlcheMix
      await act(async () => {
        await user.click(screen.getByText('Enter AlcheMix'));
      });

      // Should have called add for each selected element
      await waitFor(() => {
        expect(mockAdd).toHaveBeenCalledTimes(2);
      });

      // Should have called seedClassics
      expect(mockSeedClassics).toHaveBeenCalled();

      // Should redirect to dashboard
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });

    it('should prevent duplicate inventory items', async () => {
      // Mock existing inventory with Bourbon already added
      mockGetAll.mockResolvedValue({
        items: [{ id: 1, name: 'Bourbon', category: 'spirit' }],
        pagination: {},
      });

      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select Bourbon (already exists) and Gin (new)
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
        await user.click(screen.getByText('Gin'));
      });

      // Navigate to step 3
      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click Enter AlcheMix
      await act(async () => {
        await user.click(screen.getByText('Enter AlcheMix'));
      });

      // Should only add Gin (Bourbon already exists)
      await waitFor(() => {
        expect(mockAdd).toHaveBeenCalledTimes(1);
        expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'Gin' }));
      });
    });

    it('should show saving state and prevent double-clicks', async () => {
      // Make the add function take some time
      mockAdd.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ id: 1 }), 100)));

      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select Bourbon
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      // Navigate to step 3
      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click Enter AlcheMix
      const enterBtn = screen.getByText('Enter AlcheMix');
      await act(async () => {
        await user.click(enterBtn);
      });

      // Should show "Setting up..." and button should be disabled
      await waitFor(() => {
        expect(screen.getByText('Setting up...')).toBeInTheDocument();
      });

      // Wait for completion
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      }, { timeout: 2000 });
    });

    it('should redirect to dashboard even on API error', async () => {
      mockAdd.mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select Bourbon
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      // Navigate to step 3
      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click Enter AlcheMix
      await act(async () => {
        await user.click(screen.getByText('Enter AlcheMix'));
      });

      // Should still redirect to dashboard even though add failed
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('Replay Mode', () => {
    it('should not redirect if replay mode is enabled and user already onboarded', async () => {
      mockSearchParams = new URLSearchParams('replay=true');
      mockUser = { id: 1, email: 'test@example.com', has_seeded_classics: true };

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Should still show onboarding, not redirect
      await waitFor(() => {
        expect(screen.getByText('Welcome to AlcheMix')).toBeInTheDocument();
      });

      // Should NOT have redirected to dashboard
      expect(mockPush).not.toHaveBeenCalledWith('/dashboard');
    });

    it('should just redirect to dashboard when skipping in replay mode', async () => {
      mockSearchParams = new URLSearchParams('replay=true');
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

      // Should redirect without calling seedClassics
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });

      // Should NOT have called seedClassics in replay mode
      expect(mockSeedClassics).not.toHaveBeenCalled();
    });

    it('should just redirect to dashboard when completing in replay mode', async () => {
      mockSearchParams = new URLSearchParams('replay=true');
      const user = userEvent.setup();

      await act(async () => {
        render(<OnboardingPage />);
      });

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/Let's Build Your Bar/i)).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByText(/Let's Build Your Bar/i));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 2 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Select Bourbon
      await act(async () => {
        await user.click(screen.getByText('Bourbon'));
      });

      // Navigate to step 3
      await act(async () => {
        await user.click(screen.getByText('See My Cocktails'));
      });

      await waitFor(() => {
        expect(screen.getByText('STEP 3 OF 3')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Click Enter AlcheMix
      await act(async () => {
        await user.click(screen.getByText('Enter AlcheMix'));
      });

      // Should redirect without saving inventory
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });

      // Should NOT have called add or seedClassics in replay mode
      expect(mockAdd).not.toHaveBeenCalled();
      expect(mockSeedClassics).not.toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    it('should redirect to login if not authenticated', async () => {
      mockIsAuthenticated = false;
      mockUser = null;

      await act(async () => {
        render(<OnboardingPage />);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('should redirect to dashboard if already onboarded', async () => {
      mockUser = { id: 1, email: 'test@example.com', has_seeded_classics: true };

      await act(async () => {
        render(<OnboardingPage />);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });
  });
});
