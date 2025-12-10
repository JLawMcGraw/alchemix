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
 * Safely render HTML content with only allowed tags
 * Prevents XSS attacks from AI-generated content
 */
const sanitizeAndRenderHTML = (html: string): string => {
  if (!html) return '';

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

  const allowedTags = ['strong', 'em', 'b', 'i', 'br'];
  const placeholders: { placeholder: string; tag: string }[] = [];
  let placeholderIndex = 0;

  for (const tag of allowedTags) {
    decoded = decoded.replace(new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi'), () => {
      const placeholder = `__ALLOWED_TAG_${placeholderIndex++}__`;
      placeholders.push({ placeholder, tag: `<${tag}>` });
      return placeholder;
    });

    decoded = decoded.replace(new RegExp(`</${tag}>`, 'gi'), () => {
      const placeholder = `__ALLOWED_TAG_${placeholderIndex++}__`;
      placeholders.push({ placeholder, tag: `</${tag}>` });
      return placeholder;
    });

    decoded = decoded.replace(new RegExp(`<${tag}\\s*/>`, 'gi'), () => {
      const placeholder = `__ALLOWED_TAG_${placeholderIndex++}__`;
      placeholders.push({ placeholder, tag: `<${tag}/>` });
      return placeholder;
    });
  }

  decoded = decoded.replace(/<[^>]*>/g, '');
  decoded = decoded.replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    if (!token) return;
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
      if (sanitizedText.length > 0) nodes.push(' ');
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
    dashboardGreeting,
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
    } catch (error: any) {
      showToast('error', error.message || 'Failed to import CSV');
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
            {isDashboardInsightLoading
              ? 'Brewing up a greeting...'
              : renderGreetingContent(dashboardGreeting)}
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
              <p
                className={styles.insightText}
                dangerouslySetInnerHTML={{ __html: sanitizeAndRenderHTML(dashboardInsight) }}
              />
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
                      <div
                        className={styles.categoryCount}
                        style={{ color: cat.color }}
                      >
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
