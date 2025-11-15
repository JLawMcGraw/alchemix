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

export default function DashboardPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const { user, bottles, recipes, favorites, fetchBottles, fetchRecipes, fetchFavorites } = useStore();
  const { showToast } = useToast();
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvModalType, setCsvModalType] = useState<'bottles' | 'recipes'>('bottles');

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchBottles().catch(console.error);
      fetchRecipes().catch(console.error);
      fetchFavorites().catch(console.error);
    }
  }, [isAuthenticated, isValidating, fetchBottles, fetchRecipes, fetchFavorites]);

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
  const bottlesArray = Array.isArray(bottles) ? bottles : [];
  const recipesArray = Array.isArray(recipes) ? recipes : [];
  const favoritesArray = Array.isArray(favorites) ? favorites : [];
  // Low stock feature disabled until Quantity field is added to Bottle type
  const lowStockCount = 0;

  // CSV Import handlers
  const handleOpenCSVModal = (type: 'bottles' | 'recipes') => {
    setCsvModalType(type);
    setCsvModalOpen(true);
  };

  const handleCSVUpload = async (file: File) => {
    try {
      if (csvModalType === 'bottles') {
        const result = await inventoryApi.importCSV(file);
        showToast('success', `Successfully imported ${result.count} bottles!`);
        await fetchBottles();
      } else {
        const result = await recipeApi.importCSV(file);
        showToast('success', `Successfully imported ${result.count} recipes!`);
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
        {/* Header Section */}
        <section className={styles.header}>
          <h1 className={styles.greeting}>
            Ready for your next experiment?
          </h1>
          <p className={styles.stats}>
            You've got <strong>{bottlesArray.length} bottles</strong>
            {lowStockCount > 0 && (
              <span className={styles.lowStock}>
                {' '}and <strong>{lowStockCount} low-stock spirits</strong>
              </span>
            )}
          </p>
        </section>

        {/* Action Buttons */}
        <section className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/ai')}
            className={styles.primaryAction}
          >
            <Sparkles size={20} style={{ marginRight: '8px' }} />
            Ask the AI Bartender
          </Button>
          <div className={styles.secondaryActions}>
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push('/bar')}
            >
              <Wine size={18} style={{ marginRight: '6px' }} />
              Add New Bottle
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => handleOpenCSVModal('bottles')}
            >
              <Upload size={18} style={{ marginRight: '6px' }} />
              Import Bar Stock CSV
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => handleOpenCSVModal('recipes')}
            >
              <Upload size={18} style={{ marginRight: '6px' }} />
              Import Recipes CSV
            </Button>
          </div>
        </section>

        {/* Overview Cards */}
        <section className={styles.overview}>
          {/* My Bar Overview */}
          <Card padding="md" className={styles.overviewCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <Wine size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                My Bar Overview
              </h3>
              <button
                onClick={() => router.push('/bar')}
                className={styles.viewAllBtn}
              >
                View All →
              </button>
            </div>
            <div className={styles.cardContent}>
              {bottlesArray.length === 0 ? (
                <p className={styles.emptyState}>
                  No bottles yet. Start building your bar!
                </p>
              ) : (
                <ul className={styles.bottleList}>
                  {bottlesArray.slice(0, 3).map((bottle) => (
                    <li key={bottle.id} className={styles.bottleItem}>
                      <span className={styles.bottleName}>{bottle.name}</span>
                      <span className={styles.bottleType}>
                        {bottle['Liquor Type']}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Recent Recipes */}
          <Card padding="md" className={styles.overviewCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <BookOpen size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Recent Recipes
              </h3>
              <button
                onClick={() => router.push('/recipes')}
                className={styles.viewAllBtn}
              >
                View All →
              </button>
            </div>
            <div className={styles.cardContent}>
              {recipesArray.length === 0 ? (
                <p className={styles.emptyState}>
                  No recipes yet. Import your collection!
                </p>
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

          {/* Favorites / History */}
          <Card padding="md" className={styles.overviewCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <Star size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Favorites
              </h3>
              <button
                onClick={() => router.push('/favorites')}
                className={styles.viewAllBtn}
              >
                View All →
              </button>
            </div>
            <div className={styles.cardContent}>
              {favoritesArray.length === 0 ? (
                <p className={styles.emptyState}>
                  No favorites yet. Save your favorite drinks!
                </p>
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
