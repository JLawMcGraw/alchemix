'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { InsightSkeleton } from '@/components/ui/Skeleton';
import { CSVUploadModal } from '@/components/modals/CSVUploadModal';
import { useToast } from '@/components/ui/Toast';
import { inventoryApi, recipeApi } from '@/lib/api';
import styles from './dashboard.module.css';

/**
 * Safely render HTML content as React elements
 * Only allows: strong, em, b, i, br tags - all other HTML is stripped
 */
const renderHTMLContent = (html: string, keyPrefix: string, fallback?: string): React.ReactNode => {
  if (!html) return fallback || null;

  // Split on allowed tags, capturing them
  const tagPattern = /(<\/?(?:strong|em|b|i)>|<br\s*\/?>)/gi;
  const tokens = html.split(tagPattern);

  const nodes: React.ReactNode[] = [];
  const tagStack: string[] = [];
  let key = 0;

  tokens.forEach((token) => {
    if (!token) return;

    const lowerToken = token.toLowerCase();

    // Handle opening tags
    if (lowerToken === '<strong>' || lowerToken === '<b>') {
      tagStack.push('strong');
      return;
    }
    if (lowerToken === '<em>' || lowerToken === '<i>') {
      tagStack.push('em');
      return;
    }

    // Handle closing tags
    if (lowerToken === '</strong>' || lowerToken === '</b>') {
      const idx = tagStack.lastIndexOf('strong');
      if (idx !== -1) tagStack.splice(idx, 1);
      return;
    }
    if (lowerToken === '</em>' || lowerToken === '</i>') {
      const idx = tagStack.lastIndexOf('em');
      if (idx !== -1) tagStack.splice(idx, 1);
      return;
    }

    // Handle <br> tags
    if (lowerToken === '<br>' || lowerToken === '<br/>' || lowerToken === '<br />') {
      key += 1;
      nodes.push(<br key={`${keyPrefix}-br-${key}`} />);
      return;
    }

    // Strip any remaining HTML tags from text content
    const text = token.replace(/<\/?[^>]+>/g, '');
    if (!text) return;

    key += 1;

    // Wrap in active tags (innermost first)
    let element: React.ReactNode = text;
    const activeTags = [...tagStack].reverse();

    activeTags.forEach((tag, i) => {
      if (tag === 'strong') {
        element = <strong key={`${keyPrefix}-strong-${key}-${i}`}>{element}</strong>;
      } else if (tag === 'em') {
        element = <em key={`${keyPrefix}-em-${key}-${i}`}>{element}</em>;
      }
    });

    if (activeTags.length === 0) {
      nodes.push(<span key={`${keyPrefix}-text-${key}`}>{text}</span>);
    } else {
      nodes.push(element);
    }
  });

  return nodes.length > 0 ? nodes : (fallback || null);
};

/**
 * Get a seasonal greeting based on current date
 */
const getSeasonalGreeting = (): string => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const hour = now.getHours();

  // Time of day prefix
  let timeGreeting = 'Good evening';
  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 17) timeGreeting = 'Good afternoon';

  // Seasonal suffix
  if (month === 11 || month === 0 || month === 1) {
    // Winter (Dec, Jan, Feb)
    const winterGreetings = [
      `${timeGreeting}, mixologist. Perfect weather for a warming cocktail.`,
      `${timeGreeting}! Time for something to take the chill off.`,
      `${timeGreeting}. The lab awaits your winter experiments.`,
    ];
    return winterGreetings[Math.floor(Math.random() * winterGreetings.length)];
  } else if (month >= 2 && month <= 4) {
    // Spring (Mar, Apr, May)
    const springGreetings = [
      `${timeGreeting}, mixologist. Spring calls for fresh flavors.`,
      `${timeGreeting}! Perfect day for citrus-forward creations.`,
      `${timeGreeting}. The lab is ready for botanical experiments.`,
    ];
    return springGreetings[Math.floor(Math.random() * springGreetings.length)];
  } else if (month >= 5 && month <= 7) {
    // Summer (Jun, Jul, Aug)
    const summerGreetings = [
      `${timeGreeting}, mixologist. Time for something refreshing.`,
      `${timeGreeting}! Perfect weather for tropical experiments.`,
      `${timeGreeting}. The lab is prepped for summer sippers.`,
    ];
    return summerGreetings[Math.floor(Math.random() * summerGreetings.length)];
  } else {
    // Fall (Sep, Oct, Nov)
    const fallGreetings = [
      `${timeGreeting}, mixologist. Perfect season for warming spirits.`,
      `${timeGreeting}! Time for autumn-inspired creations.`,
      `${timeGreeting}. The lab awaits your cozy experiments.`,
    ];
    return fallGreetings[Math.floor(Math.random() * fallGreetings.length)];
  }
};

// Category configuration with colors
const CATEGORIES = [
  { key: 'spirit', label: 'Spirits', color: '#D97706' },
  { key: 'liqueur', label: 'Liqueurs', color: '#EC4899' },
  { key: 'mixer', label: 'Mixers', color: '#0EA5E9' },
  { key: 'syrup', label: 'Syrups', color: '#6366F1' },
  { key: 'garnish', label: 'Garnishes', color: '#65A30D' },
  { key: 'other', label: 'Other', color: '#94A3B8' },
];

// Mastery tiers configuration
const MASTERY_TIERS = [
  { key: 'craftable', label: 'Craftable', color: '#10B981' },
  { key: 'nearMiss', label: 'Near Miss', color: '#0EA5E9' },
  { key: 'need2to3', label: '2-3 Away', color: '#F59E0B' },
  { key: 'majorGaps', label: 'Major Gaps', color: '#94A3B8' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    recipes,
    collections,
    dashboardInsight,
    isDashboardInsightLoading,
    shoppingListStats,
    fetchRecipes,
    fetchFavorites,
    fetchCollections,
    fetchDashboardInsight,
    fetchShoppingList,
  } = useStore();
  const { showToast } = useToast();
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvModalType, setCsvModalType] = useState<'items' | 'recipes'>('items');
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number> | null>(null);

  // Memoized arrays
  const { recipesArray, collectionsArray } = useMemo(() => ({
    recipesArray: Array.isArray(recipes) ? recipes : [],
    collectionsArray: Array.isArray(collections) ? collections : [],
  }), [recipes, collections]);

  // Memoized seasonal greeting (computed once on mount)
  const seasonalGreeting = useMemo(() => getSeasonalGreeting(), []);

  // CSV Import handlers
  const handleCSVUpload = useCallback(async (file: File, collectionId?: number) => {
    try {
      if (csvModalType === 'items') {
        const result = await inventoryApi.importCSV(file);
        showToast('success', `Successfully imported ${result.imported} items!`);
        const counts = await inventoryApi.getCategoryCounts();
        setCategoryCounts(counts);
      } else {
        const result = await recipeApi.importCSV(file, collectionId);
        if (result.imported > 0) {
          if (result.failed > 0) {
            showToast('success', `Imported ${result.imported} recipes. ${result.failed} failed.`);
          } else {
            showToast('success', `Successfully imported ${result.imported} recipes!`);
          }
        } else {
          showToast('error', 'No recipes were imported. Check your CSV format.');
        }
        await fetchRecipes();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import CSV';
      showToast('error', errorMessage);
      throw error;
    }
  }, [csvModalType, showToast, fetchRecipes]);

  // Fetch data when authenticated
  useEffect(() => {
    if (!isAuthenticated || isValidating) return;

    inventoryApi.getCategoryCounts()
      .then(setCategoryCounts)
      .catch(console.error);
    fetchRecipes().catch(console.error);
    fetchFavorites().catch(console.error);
    fetchCollections().catch(console.error);
    fetchDashboardInsight().catch(console.error);
    fetchShoppingList().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isValidating]);

  // Calculate total items
  const totalItems = useMemo(() => {
    if (!categoryCounts) return 0;
    return Object.entries(categoryCounts)
      .filter(([key]) => key !== 'all')
      .reduce((sum, [, count]) => sum + count, 0);
  }, [categoryCounts]);

  // Calculate craftable count
  const craftableCount = shoppingListStats?.craftable || 0;

  if (isValidating) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.container}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.container}>
        {/* ===== HEADER / GREETING ===== */}
        <header className={styles.header}>
          <h1 className={styles.greeting}>
            {seasonalGreeting}
          </h1>
          <p className={styles.statsLine}>
            <span className={styles.statValue}>{totalItems}</span> bottles ·
            <span className={styles.statValue}> {recipesArray.length}</span> recipes ·
            <span className={styles.statValue}> {craftableCount}</span> makeable tonight
          </p>
        </header>

        {/* ===== LAB ASSISTANT'S NOTES ===== */}
        <div className={styles.labNotesCard}>
          <div className={styles.labNotesHeader}>
            <h2 className={styles.labNotesTitle}>
              <div className={styles.pulsingDot} />
              Lab Assistant&apos;s Notes
            </h2>
            <span className={styles.labNotesLabel}>AI Analysis</span>
          </div>
          <div className={styles.labNotesContent}>
            {isDashboardInsightLoading ? (
              <InsightSkeleton />
            ) : dashboardInsight ? (
              <p className={styles.insightText}>
                {renderHTMLContent(dashboardInsight, 'insight')}
              </p>
            ) : (
              <p className={styles.emptyState}>
                Add items and recipes to get personalized insights!
              </p>
            )}
            <div className={styles.labNotesAction}>
              <button
                className={styles.askAiButton}
                onClick={() => router.push('/ai')}
              >
                Ask the AI Bartender
              </button>
            </div>
          </div>
        </div>

        {/* ===== MAIN GRID ===== */}
        <div className={styles.mainGrid}>
          {/* --- MY BAR OVERVIEW (Left, wider) --- */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>My Bar Overview</h2>
              <button
                className={styles.viewAllBtn}
                onClick={() => router.push('/bar')}
              >
                View All →
              </button>
            </div>

            {/* Composition Bar */}
            {totalItems > 0 && (
              <div className={styles.compositionBar}>
                <div className={styles.barTrack}>
                  {CATEGORIES.map((cat) => {
                    const count = categoryCounts?.[cat.key] || 0;
                    if (count === 0) return null;
                    const widthPercent = (count / totalItems) * 100;
                    return (
                      <div
                        key={cat.key}
                        className={styles.barSegment}
                        style={{
                          width: `${widthPercent}%`,
                          backgroundColor: cat.color,
                        }}
                        title={`${cat.label}: ${count}`}
                      />
                    );
                  })}
                </div>
                <div className={styles.barTotal}>{totalItems} total</div>
              </div>
            )}

            {/* Category Grid */}
            {!categoryCounts || Object.keys(categoryCounts).length === 0 ? (
              <p className={styles.emptyState}>No items yet. Add bottles to your bar!</p>
            ) : (
              <div className={styles.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const count = categoryCounts[cat.key] || 0;
                  return (
                    <div
                      key={cat.key}
                      className={styles.categoryCell}
                      onClick={() => router.push(`/bar?category=${cat.key}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/bar?category=${cat.key}`);
                        }
                      }}
                    >
                      <div
                        className={styles.categoryDot}
                        style={{ backgroundColor: cat.color }}
                      />
                      <div className={styles.categoryCount}>
                        {String(count).padStart(2, '0')}
                      </div>
                      <div className={styles.categoryLabel}>{cat.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* --- RIGHT SIDEBAR --- */}
          <div className={styles.sidebarStack}>
            {/* Recipe Mastery */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Recipe Mastery</h2>
              </div>
              <div>
                {recipesArray.length === 0 ? (
                  <p className={styles.emptyState}>No recipes yet.</p>
                ) : (
                  <>
                    {[
                      { key: 'craftable', label: 'Craftable', color: '#10B981', count: shoppingListStats?.craftable || 0, filter: 'craftable' },
                      { key: 'nearMiss', label: 'Near Miss', color: '#0EA5E9', count: shoppingListStats?.nearMisses || 0, filter: 'almost' },
                      { key: 'need2to3', label: '2-3 Away', color: '#F59E0B', count: shoppingListStats?.missing2to3 || 0, filter: 'need-few' },
                      { key: 'majorGaps', label: 'Major Gaps', color: '#94A3B8', count: shoppingListStats?.missing4plus || 0, filter: 'major-gaps' },
                    ].map((tier) => (
                      <div
                        key={tier.key}
                        className={styles.listItem}
                        onClick={() => router.push(`/recipes?filter=${tier.filter}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/recipes?filter=${tier.filter}`);
                          }
                        }}
                      >
                        <div className={styles.masteryItem}>
                          <div
                            className={styles.masteryDot}
                            style={{ backgroundColor: tier.color }}
                          />
                          <span className={styles.masteryLabel}>{tier.label}</span>
                        </div>
                        <span
                          className={styles.masteryCount}
                          style={{
                            backgroundColor: `${tier.color}15`,
                            color: tier.color,
                          }}
                        >
                          {String(tier.count).padStart(2, '0')}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Collections */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Collections</h2>
                <button
                  className={styles.viewAllBtn}
                  onClick={() => router.push('/recipes')}
                >
                  + New
                </button>
              </div>
              <div>
                {collectionsArray.length === 0 ? (
                  <p className={styles.emptyState}>No collections yet.</p>
                ) : (
                  collectionsArray
                    .sort((a, b) => (b.recipe_count || 0) - (a.recipe_count || 0))
                    .slice(0, 4)
                    .map((collection) => (
                      <div
                        key={collection.id}
                        className={styles.listItem}
                        onClick={() => router.push(`/recipes?collection=${collection.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/recipes?collection=${collection.id}`);
                          }
                        }}
                      >
                        <div className={styles.collectionItem}>
                          <span className={styles.collectionIcon}>◆</span>
                          <span className={styles.collectionName}>{collection.name}</span>
                        </div>
                        <span className={styles.collectionCount}>
                          {String(collection.recipe_count || 0).padStart(2, '0')} recipes
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== FOOTER ===== */}
        <footer className={styles.footer}>
          <span className={styles.footerText}>Molecular OS v1.0</span>
        </footer>

        {/* CSV Upload Modal */}
        <CSVUploadModal
          isOpen={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
          type={csvModalType}
          onUpload={handleCSVUpload}
        />
      </div>
    </div>
  );
}
