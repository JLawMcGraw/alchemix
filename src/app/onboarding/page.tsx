'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { inventoryApi, recipeApi } from '@/lib/api';
import { PERIODIC_SECTIONS, GROUP_COLORS, type PeriodicElement } from '@/lib/periodicTable';
import { RecipeDetailModal } from '@/components/modals';
import { AlcheMixLogo } from '@/components/ui';
import { generateFormula } from '@alchemix/recipe-molecule';
import type { InventoryItemInput, InventoryCategory, PeriodicGroup, PeriodicPeriod, Recipe } from '@/types';
import styles from './page.module.css';

/**
 * AlcheMix Welcome Flow
 *
 * First-time user onboarding that:
 * 1. Welcomes and sets expectations
 * 2. Gets them to add bottles (critical action)
 * 3. Shows immediate value (what they can make) + navigate to dashboard
 *
 * Design: Matches Swiss/laboratory aesthetic
 * Goal: Time-to-value under 2 minutes
 */

// Map element to inventory data for saving
function elementToInventoryItem(element: PeriodicElement): InventoryItemInput {
  // Map element group to periodic group/period for inventory
  const groupMap: Record<string, PeriodicGroup> = {
    agave: 'Base',
    grain: 'Base',
    cane: 'Base',
    juniper: 'Base',
    grape: 'Base',
    neutral: 'Base',
    botanical: 'Modifier',
    acid: 'Reagent',
    sugar: 'Sweetener',
    dairy: 'Bridge',
    carbonation: 'Catalyst',
    garnish: 'Reagent',
  };

  const periodMap: Record<string, PeriodicPeriod> = {
    agave: 'Agave',
    grain: 'Grain',
    cane: 'Cane',
    juniper: 'Botanic',
    grape: 'Grape',
    neutral: 'Grain',
    botanical: 'Botanic',
    acid: 'Fruit',
    sugar: 'Fruit',
    dairy: 'Grape',
    carbonation: 'Fruit',
    garnish: 'Botanic',
  };

  // Determine category based on element section
  const baseSpirits = ['Rm', 'Ra', 'Cc', 'Vd', 'Gn', 'Wh', 'Bb', 'Ry', 'Sc', 'Tq', 'Mz', 'Br', 'Cg', 'Ps'];
  const isSpirit = baseSpirits.includes(element.symbol);

  return {
    name: element.name,
    category: isSpirit ? ('spirit' as InventoryCategory) : ('liqueur' as InventoryCategory),
    type: element.name,
    stock_number: 1,
    periodic_group: groupMap[element.group] || ('Base' as PeriodicGroup),
    periodic_period: periodMap[element.group] || ('Grain' as PeriodicPeriod),
  };
}

// Get curated elements for quick-add (non-hidden, useful for cocktails)
function getQuickAddElements(): PeriodicElement[] {
  const elements: PeriodicElement[] = [];

  // Get base spirits (first section) - skip hidden ones and less common spirits
  const baseSpirits = PERIODIC_SECTIONS.find(s => s.title === 'BASE SPIRITS');
  if (baseSpirits) {
    const excludeSpirits = ['Wh', 'Ps', 'Cc']; // Whiskey covered by Bourbon/Rye, Pisco/Cachaça less common
    elements.push(...baseSpirits.elements.filter(e => !e.hidden && !excludeSpirits.includes(e.symbol)));
  }

  // Get key liqueurs (commonly used, non-hidden)
  const liqueurs = PERIODIC_SECTIONS.find(s => s.title === 'LIQUEURS');
  if (liqueurs) {
    // Only include the most essential liqueurs for quick-add
    const essentialLiqueurs = ['Ol', 'Cf', 'Ms', 'Ct'];
    elements.push(...liqueurs.elements.filter(e => !e.hidden && essentialLiqueurs.includes(e.symbol)));
  }

  // Get key bitters/botanicals
  const botanicals = PERIODIC_SECTIONS.find(s => s.title === 'BITTERS & BOTANICALS');
  if (botanicals) {
    // Most essential for classic cocktails
    const essentialBotanicals = ['An', 'Cp', 'Sv', 'Dv'];
    elements.push(...botanicals.elements.filter(e => !e.hidden && essentialBotanicals.includes(e.symbol)));
  }

  // Get essential citrus
  const citrus = PERIODIC_SECTIONS.find(s => s.title === 'CITRUS & ACIDS');
  if (citrus) {
    const essentialCitrus = ['Li', 'Le', 'Or'];
    elements.push(...citrus.elements.filter(e => !e.hidden && essentialCitrus.includes(e.symbol)));
  }

  // Get essential sweeteners
  const sweeteners = PERIODIC_SECTIONS.find(s => s.title === 'SWEETENERS');
  if (sweeteners) {
    const essentialSweeteners = ['Ss', 'Gr']; // Simple Syrup, Grenadine
    elements.push(...sweeteners.elements.filter(e => !e.hidden && essentialSweeteners.includes(e.symbol)));
  }

  return elements;
}

// Preview recipes with requirements (mapped to periodic table symbols)
interface PreviewRecipe {
  name: string;
  requires: string[]; // Element symbols
  ingredients: string[];
  formula: string;
  glass: string;
  instructions?: string;
}

const previewRecipes: PreviewRecipe[] = [
  {
    name: 'Old Fashioned',
    requires: ['Bb'],
    ingredients: ['2 oz Bourbon', '1 tsp Simple Syrup', '2 dashes Angostura Bitters', 'Orange peel'],
    formula: 'Bb₂ · Si · An₂',
    glass: 'Rocks',
    instructions: 'Stir with ice, strain into rocks glass over large ice cube. Express orange peel over drink.'
  },
  {
    name: 'Negroni',
    requires: ['Gn', 'Sv', 'Cp'],
    ingredients: ['1 oz Gin', '1 oz Sweet Vermouth', '1 oz Campari', 'Orange peel'],
    formula: 'Gn₁ · Sv₁ · Cp₁',
    glass: 'Rocks',
    instructions: 'Stir all ingredients with ice, strain into rocks glass over large ice cube. Garnish with orange peel.'
  },
  {
    name: 'Margarita',
    requires: ['Tq', 'Ol'],
    ingredients: ['2 oz Tequila', '1 oz Orange Liqueur', '1 oz Lime juice', 'Salt rim'],
    formula: 'Tq₂ · Ol₁ · Li₁',
    glass: 'Coupe',
    instructions: 'Shake all ingredients with ice, strain into salt-rimmed coupe.'
  },
  {
    name: 'Daiquiri',
    requires: ['Rm'],
    ingredients: ['2 oz White Rum', '1 oz Lime juice', '¾ oz Simple Syrup'],
    formula: 'Rm₂ · Li₁ · Si₀.₇₅',
    glass: 'Coupe',
    instructions: 'Shake all ingredients with ice, strain into chilled coupe.'
  },
  {
    name: 'Manhattan',
    requires: ['Ry', 'Sv', 'An'],
    ingredients: ['2 oz Rye Whiskey', '1 oz Sweet Vermouth', '2 dashes Angostura Bitters', 'Brandied cherry'],
    formula: 'Ry₂ · Sv₁ · An₂',
    glass: 'Coupe',
    instructions: 'Stir all ingredients with ice, strain into chilled coupe. Garnish with brandied cherry.'
  },
  {
    name: 'Martini',
    requires: ['Gn', 'Dv'],
    ingredients: ['2.5 oz Gin', '0.5 oz Dry Vermouth', 'Lemon twist or olive'],
    formula: 'Gn₂.₅ · Dv₀.₅',
    glass: 'Martini',
    instructions: 'Stir with ice until well-chilled, strain into chilled martini glass.'
  },
  {
    name: 'Whiskey Sour',
    requires: ['Bb'],
    ingredients: ['2 oz Bourbon', '1 oz Lemon juice', '¾ oz Simple Syrup', 'Optional: egg white'],
    formula: 'Bb₂ · Le₁ · Si₀.₇₅',
    glass: 'Rocks',
    instructions: 'Shake all ingredients with ice, strain into rocks glass over ice.'
  },
  {
    name: 'Moscow Mule',
    requires: ['Vd'],
    ingredients: ['2 oz Vodka', '0.5 oz Lime juice', '4 oz Ginger Beer'],
    formula: 'Vd₂ · Li₀.₅ · Gb₄',
    glass: 'Mug',
    instructions: 'Build in copper mug over ice, stir gently.'
  },
  {
    name: 'Paloma',
    requires: ['Tq'],
    ingredients: ['2 oz Tequila', '0.5 oz Lime juice', '4 oz Grapefruit soda', 'Salt rim'],
    formula: 'Tq₂ · Li₀.₅ · Gf₄',
    glass: 'Highball',
    instructions: 'Build in highball glass over ice with salt rim.'
  },
  {
    name: 'Espresso Martini',
    requires: ['Vd', 'Cf'],
    ingredients: ['2 oz Vodka', '1 oz Coffee Liqueur', '1 oz Fresh espresso', '0.5 oz Simple Syrup'],
    formula: 'Vd₂ · Cf₁ · Es₁',
    glass: 'Martini',
    instructions: 'Shake all ingredients vigorously with ice, strain into chilled martini glass.'
  },
  {
    name: 'Amaretto Sour',
    requires: ['Am', 'Bb'],
    ingredients: ['1.5 oz Amaretto', '0.75 oz Bourbon', '1 oz Lemon juice', '0.5 oz Simple Syrup'],
    formula: 'Am₁.₅ · Bb₀.₇₅ · Le₁',
    glass: 'Rocks',
    instructions: 'Shake all ingredients with ice, strain into rocks glass over ice.'
  },
  {
    name: 'Boulevardier',
    requires: ['Bb', 'Sv', 'Cp'],
    ingredients: ['1.5 oz Bourbon', '1 oz Sweet Vermouth', '1 oz Campari', 'Orange peel'],
    formula: 'Bb₁.₅ · Sv₁ · Cp₁',
    glass: 'Rocks',
    instructions: 'Stir all ingredients with ice, strain into rocks glass over large ice cube.'
  },
  {
    name: 'Mezcal Negroni',
    requires: ['Mz', 'Sv', 'Cp'],
    ingredients: ['1 oz Mezcal', '1 oz Sweet Vermouth', '1 oz Campari', 'Orange peel'],
    formula: 'Mz₁ · Sv₁ · Cp₁',
    glass: 'Rocks',
    instructions: 'Stir all ingredients with ice, strain into rocks glass over large ice cube.'
  },
  {
    name: 'Aviation',
    requires: ['Gn', 'Ms'],
    ingredients: ['2 oz Gin', '0.5 oz Maraschino', '0.5 oz Lemon juice', '0.25 oz Crème de Violette'],
    formula: 'Gn₂ · Ms₀.₅ · Le₀.₅',
    glass: 'Coupe',
    instructions: 'Shake all ingredients with ice, strain into chilled coupe.'
  },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, validateToken } = useStore();

  // Check if this is replay mode (from settings)
  const isReplayMode = searchParams.get('replay') === 'true';

  const [step, setStep] = useState(1);
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());
  const [animatingOut, setAnimatingOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Get curated elements for bottle selection
  const quickAddElements = useMemo(() => getQuickAddElements(), []);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await validateToken();
      } finally {
        setIsValidating(false);
      }
    };
    checkAuth();
  }, [validateToken]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isValidating && !isAuthenticated) {
      router.push('/login');
    }
  }, [isValidating, isAuthenticated, router]);

  // Redirect if already onboarded (has_seeded_classics = true) - skip in replay mode
  useEffect(() => {
    if (!isValidating && user?.has_seeded_classics && !isReplayMode) {
      router.push('/dashboard');
    }
  }, [isValidating, user, router, isReplayMode]);

  // Calculate makeable recipes based on selection
  const makeableRecipes = useMemo(() => {
    return previewRecipes.filter((recipe) =>
      recipe.requires.every((req) => selectedElements.has(req))
    );
  }, [selectedElements]);

  const toggleElement = (symbol: string) => {
    const newSet = new Set(selectedElements);
    if (newSet.has(symbol)) {
      newSet.delete(symbol);
    } else {
      newSet.add(symbol);
    }
    setSelectedElements(newSet);
  };

  const nextStep = () => {
    setAnimatingOut(true);
    setTimeout(() => {
      setStep(step + 1);
      setAnimatingOut(false);
    }, 300);
  };

  const prevStep = () => {
    setAnimatingOut(true);
    setTimeout(() => {
      setStep(step - 1);
      setAnimatingOut(false);
    }, 300);
  };

  const handleSkip = async () => {
    // In replay mode, just go to dashboard
    if (isReplayMode) {
      router.push('/dashboard');
      return;
    }

    // Seed classic recipes (this also sets has_seeded_classics = true in DB)
    try {
      await recipeApi.seedClassics();
      // Refresh user data to get updated has_seeded_classics flag
      await validateToken();
    } catch (err) {
      console.error('Failed to seed classic recipes:', err);
    }
    router.push('/dashboard');
  };

  const handleComplete = async () => {
    // In replay mode, just go to dashboard (don't add bottles again)
    if (isReplayMode) {
      router.push('/dashboard');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Save all selected elements to inventory
      const elementsToAdd = quickAddElements
        .filter((e) => selectedElements.has(e.symbol))
        .map((e) => elementToInventoryItem(e));

      for (const item of elementsToAdd) {
        await inventoryApi.add(item);
      }

      // 2. Seed classic recipes (this also sets has_seeded_classics = true in DB)
      await recipeApi.seedClassics();

      // 3. Refresh user data to get updated has_seeded_classics flag
      await validateToken();

      // 4. Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setIsSaving(false);
    }
  };

  // Get element color using the group color mapping
  const getElementColor = (element: PeriodicElement): string => {
    return GROUP_COLORS[element.group] || 'var(--fg-tertiary)';
  };

  // Convert preview recipe to Recipe type for the modal
  const previewToRecipe = (preview: PreviewRecipe): Recipe => ({
    id: 0, // Temporary ID for preview
    name: preview.name,
    ingredients: preview.ingredients,
    instructions: preview.instructions || '',
    glass: preview.glass,
    category: undefined,
  });

  const handleRecipeClick = (preview: PreviewRecipe) => {
    setSelectedRecipe(previewToRecipe(preview));
  };

  // Show loading state while validating
  if (isValidating) {
    return (
      <div className={styles.welcome}>
        <div className={styles.gridBg} />
        <div className={styles.loadingContainer}>
          <AlcheMixLogo size="md" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.welcome}>
      <div className={styles.gridBg} />

      {/* Progress bar - now 3 steps instead of 4 */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      {/* Header */}
      <header className={styles.header}>
        <AlcheMixLogo size="sm" />
        <span className={styles.stepIndicator}>STEP {step} OF 3</span>
        <button className={styles.skipBtn} onClick={handleSkip}>
          Skip Setup
        </button>
      </header>

      {/* Step 1: Welcome */}
      {step === 1 && (
        <div className={`${styles.stepContainer} ${animatingOut ? styles.animatingOut : ''}`}>
          <div className={styles.welcomeContent}>
            <AlcheMixLogo size="lg" />
            <h1 className={styles.welcomeTitle}>Welcome to AlcheMix</h1>
            <p className={styles.welcomeSubtitle}>
              Let&apos;s set up your molecular bar. In the next 60 seconds, you&apos;ll see exactly what
              cocktails you can make with what you have.
            </p>

            <div className={styles.welcomeFeatures}>
              <div className={styles.welcomeFeature}>
                <span className={styles.featureIcon}>1</span>
                <span>Add your bottles</span>
              </div>
              <div className={styles.welcomeFeature}>
                <span className={styles.featureIcon}>2</span>
                <span>See what you can make</span>
              </div>
              <div className={styles.welcomeFeature}>
                <span className={styles.featureIcon}>3</span>
                <span>Start mixing</span>
              </div>
            </div>

            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={nextStep}>
              Let&apos;s Build Your Bar
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Quick Stock (using periodic table elements) */}
      {step === 2 && (
        <div className={`${styles.stepContainer} ${animatingOut ? styles.animatingOut : ''}`}>
          <div className={styles.stockContent}>
            <div className={styles.stockHeader}>
              <h2 className={styles.stockTitle}>What&apos;s in your bar?</h2>
              <p className={styles.stockSubtitle}>
                Tap to select the bottles you have. We&apos;ll show you what you can make.
              </p>
            </div>

            {/* Live counter */}
            <div className={styles.liveCounter}>
              <div>
                <div className={styles.counterText}>You can make</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={styles.counterValue}>{makeableRecipes.length}</div>
                <div className={styles.counterLabel}>cocktails</div>
              </div>
            </div>

            {/* Element grid */}
            <div className={styles.bottleGrid}>
              {quickAddElements.map((element) => (
                <div
                  key={element.symbol}
                  className={`${styles.bottleCard} ${selectedElements.has(element.symbol) ? styles.selected : ''}`}
                  style={{ borderTop: `3px solid ${getElementColor(element)}` }}
                  onClick={() => toggleElement(element.symbol)}
                >
                  <span className={styles.bottleSymbol} style={{ color: getElementColor(element) }}>
                    {element.symbol}
                  </span>
                  <span className={styles.bottleName}>{element.name}</span>
                </div>
              ))}
            </div>

            <div className={styles.stepFooter}>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={prevStep}>
                ← Back
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={nextStep}
                disabled={selectedElements.size === 0}
                style={{ opacity: selectedElements.size === 0 ? 0.5 : 1 }}
              >
                See My Cocktails
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Results + Go to Dashboard */}
      {step === 3 && (
        <div className={`${styles.stepContainer} ${animatingOut ? styles.animatingOut : ''}`}>
          <div className={styles.resultsContent}>
            <div className={styles.resultsHeader}>
              <div className={styles.resultsCount}>{makeableRecipes.length}</div>
              <h2 className={styles.resultsTitle}>cocktails you can make right now</h2>
              <p className={styles.resultsSubtitle}>
                Based on the {selectedElements.size} bottles in your bar. Click a cocktail to see the recipe.
              </p>
            </div>

            {makeableRecipes.length > 0 ? (
              <div className={styles.recipeGrid}>
                {makeableRecipes.slice(0, 6).map((recipe, i) => (
                  <div
                    key={i}
                    className={styles.recipeCard}
                    onClick={() => handleRecipeClick(recipe)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.recipeName}>{recipe.name}</div>
                    <div className={styles.recipeFormula}>{generateFormula(recipe.ingredients)}</div>
                    <div className={styles.recipeMeta}>
                      <span className={styles.recipeGlass}>{recipe.glass}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>Add more bottles to see what you can make</div>
            )}

            <div className={styles.resultsCta}>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={prevStep}>
                ← Add More Bottles
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}
                onClick={handleComplete}
                disabled={isSaving}
              >
                {isSaving ? 'Setting up...' : 'Enter AlcheMix'}
                {!isSaving && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        isOpen={selectedRecipe !== null}
        onClose={() => setSelectedRecipe(null)}
        recipe={selectedRecipe}
        isFavorited={false}
        onToggleFavorite={() => {}} // No-op during onboarding
      />
    </div>
  );
}

// Loading fallback for Suspense
function OnboardingLoading() {
  return (
    <div className={styles.welcome}>
      <div className={styles.gridBg} />
      <div className={styles.loadingContainer}>
        <div className={styles.loadingLogo}>
          {/* Simple loading indicator - AlcheMixLogo can't be used here as it needs client context */}
        </div>
        <p>Loading...</p>
      </div>
    </div>
  );
}

// Main export with Suspense boundary for useSearchParams
export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingLoading />}>
      <OnboardingContent />
    </Suspense>
  );
}
