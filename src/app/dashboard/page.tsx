'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CSVUploadModal } from '@/components/modals/CSVUploadModal';
import { useToast } from '@/components/ui/Toast';
import { Sparkles, Wine, Upload, BookOpen, Star } from 'lucide-react';
import { inventoryApi, recipeApi } from '@/lib/api';
import styles from './dashboard.module.css';

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
    dashboardGreeting,
    dashboardInsight,
    isDashboardInsightLoading,
    fetchItems,
    fetchRecipes,
    fetchFavorites,
    fetchDashboardInsight,
  } = useStore();
  const { showToast } = useToast();
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvModalType, setCsvModalType] = useState<'items' | 'recipes'>('items');

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchItems().catch(console.error);
      fetchRecipes().catch(console.error);
      fetchFavorites().catch(console.error);
      fetchDashboardInsight().catch(console.error);
    }
  }, [isAuthenticated, isValidating, fetchItems, fetchRecipes, fetchFavorites, fetchDashboardInsight]);

  // Show loading state during validation
  if (isValidating || !isAuthenticated) {
    return null;
  }

  // Helper function to parse ingredients
  const parseIngredients = (ingredients: string | string[] | undefined): string[] => {
    if (!ingredients) return [];
    if (Array.isArray(ingredients)) return ingredients;
    try {
      const parsed = JSON.parse(ingredients);
      return Array.isArray(parsed) ? parsed : [ingredients];
    } catch {
      return ingredients.split(',').map(i => i.trim());
    }
  };

  // Calculate stats
  const itemsArray = Array.isArray(inventoryItems) ? inventoryItems : [];
  const recipesArray = Array.isArray(recipes) ? recipes : [];
  const favoritesArray = Array.isArray(favorites) ? favorites : [];
  // Low stock feature disabled until Quantity field is added to InventoryItem type
  const lowStockCount = 0;

  // CSV Import handlers
  const handleOpenCSVModal = (type: 'items' | 'recipes') => {
    setCsvModalType(type);
    setCsvModalOpen(true);
  };

  const handleCSVUpload = async (file: File, collectionId?: number) => {
    try {
      if (csvModalType === 'items') {
        const result = await inventoryApi.importCSV(file);
        showToast('success', `Successfully imported ${result.imported} items!`);
        await fetchItems();
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
  };

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
                Lab Assistant's Notebook
              </h3>
            </div>
            <div className={styles.cardContent}>
              {isDashboardInsightLoading ? (
                <p className={styles.loadingText}>Analyzing your lab notes...</p>
              ) : dashboardInsight ? (
                <p className={styles.insightText}>{dashboardInsight}</p>
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
                {itemsArray.length === 0 ? (
                  <p className={styles.emptyState}>No items yet.</p>
                ) : (
                  <ul className={styles.bottleList}>
                    {itemsArray.slice(0, 3).map((item) => (
                      <li key={item.id} className={styles.bottleItem}>
                        <span className={styles.bottleName}>{item.name}</span>
                        <span className={styles.bottleType}>{item.type || item.category}</span>
                      </li>
                    ))}
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

            {/* Recent Recipes */}
            <Card padding="md" className={styles.overviewCard}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <BookOpen size={20} style={{ marginRight: '8px' }} />
                  Recent Recipes
                </h3>
                <button onClick={() => router.push('/recipes')} className={styles.viewAllBtn}>
                  View All →
                </button>
              </div>
              <div className={styles.cardContent}>
                {recipesArray.length === 0 ? (
                  <p className={styles.emptyState}>No recipes yet.</p>
                ) : (
                  <ul className={styles.recipeList}>
                    {recipesArray.slice(0, 3).map((recipe) => (
                      <li key={recipe.id} className={styles.recipeItem}>
                        <span className={styles.recipeName}>{recipe.name}</span>
                        <span className={styles.recipeIngredients}>
                          {parseIngredients(recipe.ingredients).length} ingredients
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            {/* Favorites */}
            <Card padding="md" className={styles.overviewCard}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Star size={20} style={{ marginRight: '8px' }} />
                  Favorites
                </h3>
                <button onClick={() => router.push('/favorites')} className={styles.viewAllBtn}>
                  View All →
                </button>
              </div>
              <div className={styles.cardContent}>
                {favoritesArray.length === 0 ? (
                  <p className={styles.emptyState}>No favorites yet.</p>
                ) : (
                  <ul className={styles.favoriteList}>
                    {favoritesArray.slice(0, 2).map((favorite) => (
                      <li key={favorite.id} className={styles.favoriteItem}>
                        <Star size={18} className={styles.favoriteIcon} />
                        <span className={styles.favoriteName}>
                          {favorite.recipe_name || 'Saved Recipe'}
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
