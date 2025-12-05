'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton, StatCardSkeleton, InsightSkeleton } from '@/components/ui/Skeleton';
import { CSVUploadModal } from '@/components/modals/CSVUploadModal';
import { useToast } from '@/components/ui/Toast';
import { Sparkles, Wine, Upload, BookOpen, Star, Zap, FolderOpen } from 'lucide-react';
import { inventoryApi, recipeApi } from '@/lib/api';
import styles from './dashboard.module.css';

/**
 * Safely render HTML content with only allowed tags
 * Prevents XSS attacks from AI-generated content
 *
 * SSR-safe implementation that doesn't rely on DOM APIs or jsdom
 * Allows only: strong, em, b, i, br tags (no attributes)
 */
const sanitizeAndRenderHTML = (html: string): string => {
  if (!html) return '';

  // Step 1: Escape HTML entities to prevent double-encoding issues
  const entityMap: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#x27;': "'",
    '&#39;': "'",
  };

  let decoded = html;
  for (const [entity, char] of Object.entries(entityMap)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // Step 2: Use placeholder tokens for allowed tags
  const allowedTags = ['strong', 'em', 'b', 'i', 'br'];
  const placeholders: { placeholder: string; tag: string }[] = [];
  let placeholderIndex = 0;

  // Replace allowed tags with placeholders
  for (const tag of allowedTags) {
    // Opening tags (with optional whitespace)
    decoded = decoded.replace(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi'), () => {
      const placeholder = `__ALLOWED_TAG_${placeholderIndex++}__`;
      placeholders.push({ placeholder, tag: `<${tag}>` });
      return placeholder;
    });

    // Closing tags
    decoded = decoded.replace(new RegExp(`</${tag}>`, 'gi'), () => {
      const placeholder = `__ALLOWED_TAG_${placeholderIndex++}__`;
      placeholders.push({ placeholder, tag: `</${tag}>` });
      return placeholder;
    });

    // Self-closing tags (for <br/>)
    decoded = decoded.replace(new RegExp(`<${tag}\\s*/>`, 'gi'), () => {
      const placeholder = `__ALLOWED_TAG_${placeholderIndex++}__`;
      placeholders.push({ placeholder, tag: `<${tag}/>` });
      return placeholder;
    });
  }

  // Step 3: Remove all remaining HTML tags (potentially malicious)
  decoded = decoded.replace(/<[^>]*>/g, '');

  // Step 4: Escape any remaining < > characters to prevent injection
  decoded = decoded.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Step 5: Restore allowed tags from placeholders
  for (const { placeholder, tag } of placeholders) {
    decoded = decoded.replace(placeholder, tag);
  }

  return decoded;
};

const renderGreetingContent = (greeting: string): React.ReactNode => {
  if (!greeting) {
    return 'Ready for your next experiment?';
  }

  const tokens = greeting.split(/(<\/?strong>)/gi);
  let isStrong = false;
  let key = 0;
  const nodes: React.ReactNode[] = [];

  tokens.forEach((token) => {
    if (!token) {
      return;
    }

    const normalized = token.toLowerCase();

    if (normalized === '<strong>') {
      isStrong = true;
      return;
    }

    if (normalized === '</strong>') {
      isStrong = false;
      return;
    }

    const sanitizedText = token.replace(/<\/?[^>]+>/g, '');
    const isWhitespaceOnly = sanitizedText.trim().length === 0;

    if (isWhitespaceOnly) {
      if (sanitizedText.length > 0) {
        nodes.push(' ');
      }
      return;
    }

    key += 1;
    if (isStrong) {
      nodes.push(<strong key={`greeting-strong-${key}`}>{sanitizedText}</strong>);
    } else {
      nodes.push(<span key={`greeting-text-${key}`}>{sanitizedText}</span>);
    }
  });

  if (nodes.length === 0) {
    return 'Ready for your next experiment?';
  }

  return nodes;
};

export default function DashboardPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    user,
    inventoryItems,
    recipes,
    favorites,
    collections,
    dashboardGreeting,
    dashboardInsight,
    isDashboardInsightLoading,
    shoppingListStats,
    craftableRecipes,
    nearMissRecipes,
    fetchItems,
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

  // Memoized helper function to parse ingredients (prevents recreation on every render)
  // NOTE: All hooks must be called before any conditional returns (React rules of hooks)
  const parseIngredients = useCallback((ingredients: string | string[] | undefined): string[] => {
    if (!ingredients) return [];
    if (Array.isArray(ingredients)) return ingredients;
    try {
      const parsed = JSON.parse(ingredients);
      return Array.isArray(parsed) ? parsed : [ingredients];
    } catch {
      return ingredients.split(',').map(i => i.trim());
    }
  }, []);

  // Memoized stats calculations (only recalculate when data changes)
  const { itemsArray, recipesArray, favoritesArray, collectionsArray, lowStockCount } = useMemo(() => ({
    itemsArray: Array.isArray(inventoryItems) ? inventoryItems : [],
    recipesArray: Array.isArray(recipes) ? recipes : [],
    favoritesArray: Array.isArray(favorites) ? favorites : [],
    collectionsArray: Array.isArray(collections) ? collections : [],
    // Low stock feature disabled until Quantity field is added to InventoryItem type
    lowStockCount: 0,
  }), [inventoryItems, recipes, favorites, collections]);

  // CSV Import handlers (memoized to prevent child re-renders)
  const handleOpenCSVModal = useCallback((type: 'items' | 'recipes') => {
    setCsvModalType(type);
    setCsvModalOpen(true);
  }, []);

  const handleCSVUpload = useCallback(async (file: File, collectionId?: number) => {
    try {
      if (csvModalType === 'items') {
        const result = await inventoryApi.importCSV(file);
        showToast('success', `Successfully imported ${result.imported} items!`);
        // Refresh category counts after import
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
    } catch (error: any) {
      showToast('error', error.message || 'Failed to import CSV');
      throw error;
    }
  }, [csvModalType, showToast, fetchRecipes]);

  // Fetch data when authenticated
  // Note: We check isAuthenticated && !isValidating to ensure we only fetch after auth is confirmed
  useEffect(() => {
    if (!isAuthenticated || isValidating) {
      return;
    }

    // Fetch category counts directly (more efficient than fetching all items)
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

  // Show loading state during validation
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
    return null; // useAuthGuard will handle redirect
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.container}>
        {/* Header & Control Panel Section */}
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <h1 className={styles.greeting}>
              {isDashboardInsightLoading
                ? 'Brewing up a greeting...'
                : renderGreetingContent(dashboardGreeting)}
            </h1>
          </div>

        </header>

        {/* Overview Section */}
        <section className={styles.overview}>
          {/* Lab Assistant's Notebook */}
          <Card padding="lg" className={styles.overviewCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <Sparkles size={20} style={{ marginRight: '8px' }} />
                Lab Assistant&apos;s Notebook
              </h3>
            </div>
            <div className={styles.cardContent}>
              {isDashboardInsightLoading ? (
                <InsightSkeleton />
              ) : dashboardInsight ? (
                <p
                  className={styles.insightText}
                  dangerouslySetInnerHTML={{ __html: sanitizeAndRenderHTML(dashboardInsight) }}
                />
              ) : (
                <p className={styles.emptyState}>
                  Add items and recipes to get personalized insights!
                </p>
              )}
              {/* Ask the AI Bartender Button */}
              <div className={styles.aiActionButton}>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => router.push('/ai')}
                >
                  <Sparkles size={20} style={{ marginRight: '8px' }} />
                  Ask the AI Bartender
                </Button>
              </div>
            </div>
          </Card>

          {/* Other Cards */}
          <div className={styles.overviewGrid}>
            {/* My Bar Overview */}
            <Card padding="md" className={styles.overviewCard}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Wine size={20} style={{ marginRight: '8px' }} />
                  My Bar Overview
                </h3>
                <button onClick={() => router.push('/bar')} className={styles.viewAllBtn}>
                  View All →
                </button>
              </div>
              <div className={styles.cardContent}>
                {!categoryCounts || Object.keys(categoryCounts).length === 0 ? (
                  <p className={styles.emptyState}>No items yet.</p>
                ) : (
                  <ul className={styles.categoryList}>
                    {(() => {
                      const categoryLabels: Record<string, string> = {
                        spirit: 'Spirits',
                        liqueur: 'Liqueurs',
                        mixer: 'Mixers',
                        syrup: 'Syrups',
                        garnish: 'Garnishes',
                        wine: 'Wines',
                        beer: 'Beers',
                        other: 'Other'
                      };

                      return Object.entries(categoryCounts)
                        .filter(([category, count]) => category !== 'all' && count > 0)
                        .sort(([, a], [, b]) => b - a)
                        .map(([category, count]) => (
                          <li
                            key={category}
                            className={styles.categoryItem}
                            onClick={() => router.push(`/bar?category=${category}`)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/bar?category=${category}`); } }}
                            tabIndex={0}
                            role="button"
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={styles.categoryLabel}>
                              {categoryLabels[category] || category}
                            </span>
                            <span className={styles.categoryCount}>{count}</span>
                          </li>
                        ));
                    })()}
                  </ul>
                )}
                {/* Add New Item Button */}
                <div className={styles.cardActionButton}>
                  <Button variant="outline" size="md" onClick={() => router.push('/bar')}>
                    <Wine size={18} style={{ marginRight: '6px' }} />
                    Add New Item
                  </Button>
                </div>
              </div>
            </Card>

            {/* Recipe Mastery */}
            <Card padding="md" className={styles.overviewCard}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Zap size={20} style={{ marginRight: '8px' }} />
                  Recipe Mastery
                </h3>
                <button onClick={() => router.push('/recipes')} className={styles.viewAllBtn}>
                  View All →
                </button>
              </div>
              <div className={styles.cardContent}>
                {recipesArray.length === 0 ? (
                  <p className={styles.emptyState}>No recipes yet.</p>
                ) : (
                  <ul className={styles.masteryList}>
                    {(() => {
                      // Use backend-calculated stats for 100% accuracy
                      const craftable = shoppingListStats?.craftable || 0;
                      const almostThere = shoppingListStats?.nearMisses || 0;
                      const needFew = shoppingListStats?.missing2to3 || 0;
                      const majorGaps = shoppingListStats?.missing4plus || 0;

                      return (
                        <>
                          <li
                            className={styles.masteryItem}
                            onClick={() => router.push('/recipes?filter=craftable')}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/recipes?filter=craftable'); } }}
                            tabIndex={0}
                            role="button"
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={styles.masteryLabel}>
                              <span className={styles.masteryIcon} style={{ backgroundColor: 'var(--color-semantic-success)' }}></span>
                              Craftable Now
                            </span>
                            <span className={styles.masteryCount}>{craftable}</span>
                          </li>
                          <li
                            className={styles.masteryItem}
                            onClick={() => router.push('/recipes?filter=almost')}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/recipes?filter=almost'); } }}
                            tabIndex={0}
                            role="button"
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={styles.masteryLabel}>
                              <span className={styles.masteryIcon} style={{ backgroundColor: 'var(--color-semantic-warning)' }}></span>
                              Almost There (1 away)
                            </span>
                            <span className={styles.masteryCount}>{almostThere}</span>
                          </li>
                          <li
                            className={styles.masteryItem}
                            onClick={() => router.push('/recipes?filter=need-few')}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/recipes?filter=need-few'); } }}
                            tabIndex={0}
                            role="button"
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={styles.masteryLabel}>
                              <span className={styles.masteryIcon} style={{ backgroundColor: 'var(--color-semantic-info)' }}></span>
                              Need 2-3 Items
                            </span>
                            <span className={styles.masteryCount}>{needFew}</span>
                          </li>
                          <li
                            className={styles.masteryItem}
                            onClick={() => router.push('/recipes?filter=major-gaps')}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/recipes?filter=major-gaps'); } }}
                            tabIndex={0}
                            role="button"
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={styles.masteryLabel}>
                              <span className={styles.masteryIcon} style={{ backgroundColor: 'var(--color-text-muted)' }}></span>
                              Major Gaps (4+)
                            </span>
                            <span className={styles.masteryCount}>{majorGaps}</span>
                          </li>
                        </>
                      );
                    })()}
                  </ul>
                )}
              </div>
            </Card>

            {/* Collections Overview */}
            <Card padding="md" className={styles.overviewCard}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <FolderOpen size={20} style={{ marginRight: '8px' }} />
                  My Collections
                </h3>
                <button onClick={() => router.push('/recipes')} className={styles.viewAllBtn}>
                  View All →
                </button>
              </div>
              <div className={styles.cardContent}>
                {collectionsArray.length === 0 ? (
                  <p className={styles.emptyState}>No collections yet.</p>
                ) : (
                  <ul className={styles.collectionList}>
                    {collectionsArray
                      .sort((a, b) => (b.recipe_count || 0) - (a.recipe_count || 0))
                      .slice(0, 3)
                      .map((collection) => (
                        <li
                          key={collection.id}
                          className={styles.collectionItem}
                          onClick={() => router.push(`/recipes?collection=${collection.id}`)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/recipes?collection=${collection.id}`); } }}
                          tabIndex={0}
                          role="button"
                          style={{ cursor: 'pointer' }}
                        >
                          <span className={styles.collectionName}>{collection.name}</span>
                          <span className={styles.collectionCount}>
                            {collection.recipe_count || 0} {collection.recipe_count === 1 ? 'recipe' : 'recipes'}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </section>

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
