'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { inventoryApi, recipeApi, type ClassicRecipe } from '@/lib/api';
import { PERIODIC_SECTIONS, GROUP_COLORS, findMatchingElements, type PeriodicElement, type ElementGroup } from '@/lib/periodicTable';
import { RecipeDetailModal, AddBottleModal } from '@/components/modals';
import { AlcheMixLogo } from '@/components/ui';
import { generateFormula } from '@alchemix/recipe-molecule';
import type { InventoryItemInput, InventoryCategory, PeriodicGroup, PeriodicPeriod, Recipe } from '@/types';
import { fallbackRecipes } from './fallbackRecipes';
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
    garnish: 'Catalyst',  // Herbs like mint are flavor catalysts, not reagents
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

  // Determine category based on element type
  const baseSpirits = ['Rm', 'Ra', 'Cc', 'Vd', 'Gn', 'Wh', 'Bb', 'Ry', 'Sc', 'Tq', 'Mz', 'Br', 'Cg', 'Ps'];
  const citrus = ['Li', 'Le', 'Or', 'Gf', 'Pi', 'Pf']; // Lime, Lemon, Orange, Grapefruit, Pineapple, Passion Fruit
  const mixers = ['Sp', 'Gb', 'Tn', 'Nc', 'Cr']; // Sparkling, Ginger Beer, Tonic, Coconut Cream, Cream
  const garnishes = ['Mt', 'An']; // Mint, Angostura (often used as garnish)
  const sweeteners = ['Og', 'Hn', 'Gr', 'Fa']; // Orgeat, Honey, Grenadine, Falernum

  let category: InventoryCategory = 'liqueur';
  if (baseSpirits.includes(element.symbol)) {
    category = 'spirit';
  } else if (citrus.includes(element.symbol)) {
    category = 'mixer';
  } else if (mixers.includes(element.symbol)) {
    category = 'mixer';
  } else if (garnishes.includes(element.symbol)) {
    category = 'garnish';
  } else if (sweeteners.includes(element.symbol)) {
    category = 'syrup';
  }

  return {
    name: element.name,
    category,
    type: undefined,  // Don't set type to element name - user can specify when editing
    stock_number: 1,
    periodic_group: groupMap[element.group] || 'Modifier',
    periodic_period: periodMap[element.group] || 'Botanic',
  };
}

/**
 * Get curated elements for quick-add (optimized for unlocking the most cocktails)
 * 
 * Based on frequency analysis of 100+ classic cocktails:
 * - Gn (27), Vd (21), Rm (14), Ol (12), Sv (10), Sp (8), Bb/Tq/Cp/Ms (6 each)
 * - Ry/Ct/Sc/Cr/Fa (5 each), Cf/Cg (4 each), Mt/Dv/Ap/Ab/Gb/Pf (3 each)
 * 
 * Total: 32 elements for comprehensive coverage (nice even grid)
 */
function getQuickAddElements(): PeriodicElement[] {
  const elements: PeriodicElement[] = [];

  // Get base spirits (first section) - skip hidden ones and less common spirits
  // Result: Rm, Vd, Gn, Bb, Ry, Sc, Tq, Mz, Br, Cg = 10 elements
  const baseSpirits = PERIODIC_SECTIONS.find(s => s.title === 'BASE SPIRITS');
  if (baseSpirits) {
    // Include most impactful base spirits (by recipe frequency)
    // Exclude: Wh (covered by Bb/Ry), Ps/Cc/Ra (less common)
    const excludeSpirits = ['Wh', 'Ps', 'Cc', 'Ra'];
    elements.push(...baseSpirits.elements.filter(e => !e.hidden && !excludeSpirits.includes(e.symbol)));
  }

  // Get key liqueurs (commonly used, non-hidden)
  // Result: Ol, Cf, Ms, Ct, Am, Co = 6 elements
  const liqueurs = PERIODIC_SECTIONS.find(s => s.title === 'LIQUEURS');
  if (liqueurs) {
    // Top liqueurs: Ol (12), Ms (6), Ct (5), Cf (4), Am (2), Co (3)
    const essentialLiqueurs = ['Ol', 'Cf', 'Ms', 'Ct', 'Am', 'Co'];
    elements.push(...liqueurs.elements.filter(e => !e.hidden && essentialLiqueurs.includes(e.symbol)));
  }

  // Get key bitters/botanicals
  // Result: Cp, Ap, Sv, Dv, An = 5 elements
  const botanicals = PERIODIC_SECTIONS.find(s => s.title === 'BITTERS & BOTANICALS');
  if (botanicals) {
    // Top botanicals: Sv (10), Cp (6), Dv (3), Ap (3), An (Angostura - used in many classics)
    const essentialBotanicals = ['Cp', 'Ap', 'Sv', 'Dv', 'An'];
    elements.push(...botanicals.elements.filter(e => !e.hidden && essentialBotanicals.includes(e.symbol)));
  }

  // Get essential mixers (high impact for easy cocktails)
  // Result: Sp, Gb, Cr, Nc = 4 elements
  const mixers = PERIODIC_SECTIONS.find(s => s.title === 'MIXERS & OTHER');
  if (mixers) {
    // Sp (8), Cr (5), Nc (2), Gb (3) - unlock many tiki and cream drinks
    const essentialMixers = ['Sp', 'Gb', 'Cr', 'Nc'];
    elements.push(...mixers.elements.filter(e => !e.hidden && essentialMixers.includes(e.symbol)));
  }

  // Get essential garnishes
  // Result: Mt = 1 element
  const garnishes = PERIODIC_SECTIONS.find(s => s.title === 'GARNISHES');
  if (garnishes) {
    const essentialGarnishes = ['Mt']; // Fresh Mint (3 recipes)
    elements.push(...garnishes.elements.filter(e => !e.hidden && essentialGarnishes.includes(e.symbol)));
  }

  // Get key sweeteners and citrus
  // Result: Og, Hn, Gr = 3 elements
  const sweeteners = PERIODIC_SECTIONS.find(s => s.title === 'SWEETENERS');
  if (sweeteners) {
    // Og (2) for Mai Tai, Hn (2) for Bee's Knees, Gr for Tequila Sunrise/Jack Rose
    const essentialSweeteners = ['Og', 'Hn', 'Gr'];
    elements.push(...sweeteners.elements.filter(e => !e.hidden && essentialSweeteners.includes(e.symbol)));
  }

  // Get essential citrus (lime, lemon, grapefruit are not assumed to be always available)
  // Result: Li, Le, Gf = 3 elements
  const citrus = PERIODIC_SECTIONS.find(s => s.title === 'CITRUS & ACIDS');
  if (citrus) {
    const essentialCitrus = ['Li', 'Le', 'Gf']; // Lime, Lemon, Grapefruit - essential for most cocktails
    elements.push(...citrus.elements.filter(e => !e.hidden && essentialCitrus.includes(e.symbol)));
  }

  // Total: 10 + 6 + 5 + 4 + 1 + 3 + 3 = 32 elements

  return elements;
}

// Custom bottle with element display info (must be outside component to avoid React issues)
interface CustomBottleDisplay extends InventoryItemInput {
  symbol: string;
  group: ElementGroup;
  atomicNumber: number;
}

// Map inventory category to element group for color coding
function categoryToGroup(category: InventoryCategory): ElementGroup {
  const groupMap: Record<InventoryCategory, ElementGroup> = {
    spirit: 'grain',
    liqueur: 'sugar',
    mixer: 'carbonation',
    syrup: 'sugar',
    garnish: 'garnish',
    wine: 'grape',
    beer: 'grain',
    other: 'botanical',
  };
  return groupMap[category] || 'botanical';
}

// Generate a 2-letter symbol for custom bottles (fallback if no matching element)
function generateCustomSymbol(name: string, existingSymbols: Set<string>): string {
  // Try first two letters capitalized
  const base = name.replace(/[^a-zA-Z]/g, '');
  if (base.length >= 2) {
    const symbol = base.charAt(0).toUpperCase() + base.charAt(1).toLowerCase();
    if (!existingSymbols.has(symbol)) return symbol;
  }
  // Try first letter + number
  for (let i = 1; i <= 9; i++) {
    const symbol = base.charAt(0).toUpperCase() + i;
    if (!existingSymbols.has(symbol)) return symbol;
  }
  // Fallback: X + number
  for (let i = 1; i <= 99; i++) {
    const symbol = 'X' + i;
    if (!existingSymbols.has(symbol)) return symbol;
  }
  return 'XX';
}

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
  const [classicRecipes, setClassicRecipes] = useState<ClassicRecipe[]>(fallbackRecipes);
  const [resultsPage, setResultsPage] = useState(1);
  const RESULTS_PER_PAGE = 6;

  // AddBottleModal state
  const [showAddBottleModal, setShowAddBottleModal] = useState(false);
  const [addBottlePreFill, setAddBottlePreFill] = useState<{
    name: string;
    category: InventoryCategory;
    type: string;
    periodic_group: PeriodicGroup;
    periodic_period: PeriodicPeriod;
  } | null>(null);
  const [customBottles, setCustomBottles] = useState<CustomBottleDisplay[]>([]);
  // Track which element is being edited (for updating vs adding)
  const [editingElement, setEditingElement] = useState<string | null>(null);

  // Get curated elements for bottle selection
  const quickAddElements = useMemo(() => getQuickAddElements(), []);

  // Fetch classic recipes from API (with fallback)
  useEffect(() => {
    recipeApi.getClassics()
      .then((recipes) => setClassicRecipes(recipes))
      .catch((err) => {
        console.warn('Failed to fetch classic recipes, using fallback:', err);
        // Keep using fallbackRecipes (already set as default)
      });
  }, []);

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

  // Calculate makeable recipes based on selection (including custom bottles)
  const makeableRecipes = useMemo(() => {
    // Combine selected periodic elements with custom bottle symbols
    const allSelectedSymbols = new Set([
      ...selectedElements,
      ...customBottles.map(b => b.symbol),
    ]);
    return classicRecipes.filter((recipe) =>
      recipe.requires.every((req) => allSelectedSymbols.has(req))
    );
  }, [selectedElements, customBottles, classicRecipes]);

  // Calculate pagination for results
  const totalResultsPages = Math.ceil(makeableRecipes.length / RESULTS_PER_PAGE);
  const paginatedRecipes = makeableRecipes.slice(
    (resultsPage - 1) * RESULTS_PER_PAGE,
    resultsPage * RESULTS_PER_PAGE
  );

  // Reset results page when makeable recipes change
  useEffect(() => {
    setResultsPage(1);
  }, [makeableRecipes.length]);

  // Get all existing symbols (from elements + custom bottles)
  const allSymbols = useMemo(() => {
    const symbols = new Set(quickAddElements.map(e => e.symbol));
    customBottles.forEach(b => {
      if (b.symbol) {
        symbols.add(b.symbol);
      }
    });
    return symbols;
  }, [quickAddElements, customBottles]);

  // Next available atomic number for custom bottles
  const nextAtomicNumber = useMemo(() => {
    const maxExisting = Math.max(
      ...quickAddElements.map(e => e.atomicNumber || 0),
      ...customBottles.map(b => b.atomicNumber || 0),
      123 // Start after the last defined element
    );
    return maxExisting + 1;
  }, [quickAddElements, customBottles]);

  // Handle clicking on an element - opens modal with prefill
  const handleElementClick = (element: PeriodicElement) => {
    const item = elementToInventoryItem(element);
    setEditingElement(element.symbol);
    setAddBottlePreFill({
      name: item.name,
      category: item.category,
      type: item.type || '',
      periodic_group: item.periodic_group || 'Base',
      periodic_period: item.periodic_period || 'Grain',
    });
    setShowAddBottleModal(true);
  };

  // Handle clicking on a custom bottle - opens modal to edit
  const handleCustomBottleClick = (bottle: CustomBottleDisplay, index: number) => {
    setEditingElement(`custom-${index}`);
    setAddBottlePreFill({
      name: bottle.name,
      category: bottle.category,
      type: bottle.type || '',
      periodic_group: bottle.periodic_group || 'Base',
      periodic_period: bottle.periodic_period || 'Grain',
    });
    setShowAddBottleModal(true);
  };

  // Open AddBottleModal for custom bottle (not in top 32)
  const openCustomBottleModal = () => {
    setEditingElement(null);
    setAddBottlePreFill(null);
    setShowAddBottleModal(true);
  };

  // Handle adding/updating bottle from modal
  const handleAddBottle = async (item: InventoryItemInput) => {
    if (editingElement?.startsWith('custom-')) {
      // Editing an existing custom bottle - update but keep display info
      const index = parseInt(editingElement.replace('custom-', ''));
      setCustomBottles(prev => {
        const updated = [...prev];
        // Try to find a matching element for the new name
        const matchingElements = findMatchingElements(item.name);
        const matchedElement = matchingElements[0];

        if (matchedElement) {
          updated[index] = {
            ...item,
            symbol: matchedElement.symbol,
            group: matchedElement.group,
            atomicNumber: matchedElement.atomicNumber,
          };
        } else {
          // Keep existing display info if no match
          updated[index] = {
            ...item,
            symbol: prev[index].symbol,
            group: categoryToGroup(item.category),
            atomicNumber: prev[index].atomicNumber,
          };
        }
        return updated;
      });
    } else if (editingElement) {
      // Adding from a periodic element - mark as selected
      setSelectedElements(prev => new Set([...prev, editingElement]));
    } else {
      // Adding a completely custom bottle
      // Try to find a matching element in the periodic table
      const matchingElements = findMatchingElements(item.name);
      const matchedElement = matchingElements[0];

      if (matchedElement) {
        // Use the matched element's display info
        setCustomBottles(prev => [...prev, {
          ...item,
          symbol: matchedElement.symbol,
          group: matchedElement.group,
          atomicNumber: matchedElement.atomicNumber,
        }]);
      } else {
        // Generate custom symbol and use category-based coloring
        const symbol = generateCustomSymbol(item.name, allSymbols);
        setCustomBottles(prev => [...prev, {
          ...item,
          symbol,
          group: categoryToGroup(item.category),
          atomicNumber: nextAtomicNumber,
        }]);
      }
    }
    setShowAddBottleModal(false);
    setAddBottlePreFill(null);
    setEditingElement(null);
  };

  // Remove a custom bottle
  const removeCustomBottle = (index: number) => {
    setCustomBottles(prev => prev.filter((_, i) => i !== index));
  };

  // Deselect a periodic element
  const deselectElement = (symbol: string) => {
    setSelectedElements(prev => {
      const newSet = new Set(prev);
      newSet.delete(symbol);
      return newSet;
    });
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

    if (isSaving) return; // Prevent double-clicks
    setIsSaving(true);

    try {
      // 1. Get existing inventory to avoid duplicates
      const { items: existingItems } = await inventoryApi.getAll({ limit: 100 });
      const existingNames = new Set(existingItems.map(item => item.name.toLowerCase()));

      // 2. Save only NEW selected elements to inventory
      const elementsToAdd = quickAddElements
        .filter((e) => selectedElements.has(e.symbol))
        .filter((e) => !existingNames.has(e.name.toLowerCase())) // Skip if already exists
        .map((e) => elementToInventoryItem(e));

      for (const item of elementsToAdd) {
        await inventoryApi.add(item);
      }

      // 3. Save custom bottles (added via modal)
      for (const item of customBottles) {
        if (!existingNames.has(item.name.toLowerCase())) {
          await inventoryApi.add(item);
        }
      }

      // 4. Seed classic recipes (this also sets has_seeded_classics = true in DB)
      await recipeApi.seedClassics();

      // 5. Refresh user data to get updated has_seeded_classics flag
      await validateToken();

      // 6. Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      // Still redirect to dashboard even on error - items may have been partially saved
      router.push('/dashboard');
    }
  };

  // Get element color using the group color mapping
  const getElementColor = (element: PeriodicElement): string => {
    return GROUP_COLORS[element.group] || 'var(--fg-tertiary)';
  };

  // Convert classic recipe to Recipe type for the modal
  const classicToRecipe = (classic: ClassicRecipe): Recipe => ({
    id: 0, // Temporary ID for preview
    name: classic.name,
    ingredients: classic.ingredients,
    instructions: classic.instructions || '',
    glass: classic.glass,
    category: classic.spirit_type,
  });

  const handleRecipeClick = (classic: ClassicRecipe) => {
    setSelectedRecipe(classicToRecipe(classic));
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
              <p className={styles.stockHint}>
                You can add specific brands and more bottles from your bar later.
                <br />
                <span style={{ opacity: 0.7, fontSize: '0.85em' }}>
                  Common items (simple syrup, bitters, soda) are assumed available.
                </span>
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
                  onClick={() => handleElementClick(element)}
                >
                  <span className={styles.bottleSymbol} style={{ color: getElementColor(element) }}>
                    {element.symbol}
                  </span>
                  <span className={styles.bottleName}>{element.name}</span>
                  {selectedElements.has(element.symbol) && (
                    <button
                      className={styles.removeButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        deselectElement(element.symbol);
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {/* Custom bottles in the grid */}
              {customBottles.map((bottle, index) => {
                const bottleColor = GROUP_COLORS[bottle.group];
                return (
                  <div
                    key={`custom-${index}`}
                    className={`${styles.bottleCard} ${styles.selected} ${styles.customBottle}`}
                    style={{
                      borderTop: `3px solid ${bottleColor}`,
                      '--custom-color': bottleColor,
                    } as React.CSSProperties}
                    onClick={() => handleCustomBottleClick(bottle, index)}
                  >
                    <span className={styles.bottleSymbol} style={{ color: bottleColor }}>
                      {bottle.symbol}
                    </span>
                    <span className={styles.bottleName}>{bottle.name}</span>
                    <button
                      className={styles.removeButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCustomBottle(index);
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {/* Add Custom Bottle button */}
              <div
                className={`${styles.bottleCard} ${styles.addCustomCard}`}
                onClick={openCustomBottleModal}
              >
                <span className={styles.bottleSymbol} style={{ color: 'var(--fg-tertiary)' }}>
                  +
                </span>
                <span className={styles.bottleName}>Add Other</span>
              </div>
            </div>

            <div className={styles.stepFooter}>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={prevStep}>
                ← Back
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={nextStep}
                disabled={selectedElements.size === 0 && customBottles.length === 0}
                style={{ opacity: (selectedElements.size === 0 && customBottles.length === 0) ? 0.5 : 1 }}
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
                Based on the {selectedElements.size + customBottles.length} bottles in your bar. Click a cocktail to see the recipe.
              </p>
            </div>

            {makeableRecipes.length > 0 ? (
              <>
                <div className={styles.recipeGrid}>
                  {paginatedRecipes.map((recipe, i) => (
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
                {totalResultsPages > 1 && (
                  <div className={styles.pagination}>
                    <button
                      className={styles.paginationBtn}
                      onClick={() => setResultsPage((p) => Math.max(1, p - 1))}
                      disabled={resultsPage === 1}
                    >
                      ← Prev
                    </button>
                    <span className={styles.paginationInfo}>
                      {resultsPage} / {totalResultsPages}
                    </span>
                    <button
                      className={styles.paginationBtn}
                      onClick={() => setResultsPage((p) => Math.min(totalResultsPages, p + 1))}
                      disabled={resultsPage === totalResultsPages}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
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

      {/* Add Bottle Modal */}
      <AddBottleModal
        isOpen={showAddBottleModal}
        onClose={() => {
          setShowAddBottleModal(false);
          setAddBottlePreFill(null);
        }}
        onAdd={handleAddBottle}
        preFill={addBottlePreFill}
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
