'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { InsightSkeleton } from '@/components/ui/Skeleton';
import { CSVUploadModal } from '@/components/modals/CSVUploadModal';
import { useToast } from '@/components/ui/Toast';
import { inventoryApi, recipeApi } from '@/lib/api';
import { Folder } from 'lucide-react';
import styles from './dashboard.module.css';

/**
 * Safely render HTML content as React elements
 * Only allows: strong, em, b, i, br tags - all other HTML is stripped
 * Also converts markdown bold (**text**) and italic (*text*) to HTML
 */
const renderHTMLContent = (html: string, keyPrefix: string, fallback?: string): React.ReactNode => {
  if (!html) return fallback || null;

  // Convert markdown to HTML before processing
  // **text** -> <strong>text</strong>
  // *text* -> <em>text</em> (but not inside **)
  let processed = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Split on allowed tags, capturing them
  const tagPattern = /(<\/?(?:strong|em|b|i)>|<br\s*\/?>)/gi;
  const tokens = processed.split(tagPattern);

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
 * Get time and season-aware greeting with bartender personality
 */
const getTimeGreeting = (): string => {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth();

  // Time of day base
  const timeBase = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Evening gets special treatment - it's cocktail hour
  if (hour >= 17) {
    const eveningGreetings = [
      'Good evening',
      'Evening',
      "It's cocktail hour",
    ];
    return eveningGreetings[Math.floor(Math.random() * eveningGreetings.length)];
  }

  // Seasonal variations for morning/afternoon
  if (month === 11 || month === 0 || month === 1) {
    // Winter (Dec, Jan, Feb)
    const winterGreetings = [
      timeBase,
      `${timeBase}, mixologist`,
    ];
    return winterGreetings[Math.floor(Math.random() * winterGreetings.length)];
  } else if (month >= 5 && month <= 7) {
    // Summer (Jun, Jul, Aug)
    const summerGreetings = [
      timeBase,
      `${timeBase}, mixologist`,
    ];
    return summerGreetings[Math.floor(Math.random() * summerGreetings.length)];
  }

  return timeBase;
};

// Category configuration with colors (labels are sentence case - CSS handles uppercase)
const CATEGORIES = [
  { key: 'spirit', label: 'Spirits', color: '#D97706' },    // Amber
  { key: 'liqueur', label: 'Liqueurs', color: '#EC4899' },  // Pink
  { key: 'mixer', label: 'Mixers', color: '#0EA5E9' },      // Sky blue
  { key: 'syrup', label: 'Syrups', color: '#6366F1' },      // Indigo
  { key: 'garnish', label: 'Garnishes', color: '#65A30D' }, // Green
  { key: 'other', label: 'Other', color: '#94A3B8' },       // Gray
];



export default function DashboardPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    user,
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

  // Memoized time greeting (computed once on mount)
  const timeGreeting = useMemo(() => getTimeGreeting(), []);

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

  // Redirect to onboarding for first-time users
  useEffect(() => {
    if (!isAuthenticated || isValidating || !user) return;

    if (!user.has_seeded_classics) {
      router.push('/onboarding');
    }
  }, [isAuthenticated, isValidating, user, router]);

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
          <div className={styles.headerLeft}>
            <p className={styles.greeting}>{timeGreeting} {user?.email?.split('@')[0] || 'there'},</p>
            <h1 className={styles.headline}>What will you make?</h1>
          </div>
          <div className={styles.headerRight}>
            <button
              className={styles.craftableLink}
              onClick={() => router.push('/recipes?filter=craftable')}
            >
              {craftableCount} recipes craftable →
            </button>
            <p className={styles.statsLine}>
              {totalItems} ingredients in-stock | {recipesArray.length} saved recipes
            </p>
          </div>
        </header>

        {/* ===== MAIN GRID: TWO COLUMNS ===== */}
        <div className={styles.mainGrid}>
          {/* LEFT COLUMN: Bartender's Notes + My Bar */}
          <div className={styles.leftColumn}>
            {/* Bartender's Notes */}
            <div className={styles.notesCard}>
              <div className={styles.notesHeader}>
                <h2 className={styles.notesTitle}>Bartender&apos;s Notes</h2>
                <button
                  className={styles.notesArrow}
                  onClick={() => router.push('/ai')}
                  aria-label="Go to AI Bartender"
                >
                  →
                </button>
              </div>
              <div className={styles.notesContent}>
                {isDashboardInsightLoading ? (
                  <InsightSkeleton />
                ) : dashboardInsight ? (
                  <p className={styles.insightText}>
                    {renderHTMLContent(dashboardInsight, 'insight')}
                  </p>
                ) : (
                  <p className={styles.emptyState}>
                    Welcome! Add some bottles to your bar and I&apos;ll help you discover what you can make.
                  </p>
                )}
              </div>
            </div>

            {/* My Bar */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>My Bar ({totalItems})</h2>
                <button
                  className={styles.addBtn}
                  onClick={() => router.push('/bar')}
                  aria-label="Go to My Bar"
                >
                  +
                </button>
              </div>

              {/* Composition Bar */}
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
              </div>

              {/* Category Grid */}
              <div className={styles.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const count = categoryCounts?.[cat.key] || 0;
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
            </div>
          </div>

          {/* RIGHT COLUMN: Recipes + Collections */}
          <div className={styles.rightColumn}>
            {/* Recipes */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Recipes ({recipesArray.length})</h2>
                <button
                  className={styles.addBtn}
                  onClick={() => router.push('/recipes')}
                  aria-label="Go to Recipes"
                >
                  +
                </button>
              </div>
              <div className={styles.listContent}>
                {[
                  { key: 'craftable', label: 'Craftable', color: '#0EBB84', count: shoppingListStats?.craftable || 0, filter: 'craftable' },
                  { key: 'nearMiss', label: 'Near Miss', color: '#CEC400', count: shoppingListStats?.nearMisses || 0, filter: 'almost' },
                  { key: 'need2to3', label: '2-3 Away', color: '#EDA600', count: shoppingListStats?.missing2to3 || 0, filter: 'need-few' },
                  { key: 'majorGaps', label: 'Major Gaps', color: '#7F99BC', count: shoppingListStats?.missing4plus || 0, filter: 'major-gaps' },
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
                    <div className={styles.listItemLeft}>
                      <div
                        className={styles.statusDot}
                        style={{ backgroundColor: tier.color }}
                      />
                      <span className={styles.listItemLabel}>{tier.label}</span>
                    </div>
                    <span
                      className={styles.listItemCount}
                      style={{ color: tier.color }}
                    >
                      {tier.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Collections */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Collections ({collectionsArray.length})</h2>
                <button
                  className={styles.addBtn}
                  onClick={() => router.push('/recipes')}
                  aria-label="Add Collection"
                >
                  +
                </button>
              </div>
              <div className={styles.listContent}>
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
                        <div className={styles.listItemLeft}>
                          <Folder size={16} className={styles.folderIcon} />
                          <span className={styles.listItemLabel}>{collection.name}</span>
                        </div>
                        <span className={styles.listItemCount}>
                          {collection.recipe_count || 0}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>

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
