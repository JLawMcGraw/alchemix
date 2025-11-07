'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, bottles, recipes, favorites, fetchBottles, fetchRecipes, fetchFavorites } = useStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Fetch data on mount
    fetchBottles().catch(console.error);
    fetchRecipes().catch(console.error);
    fetchFavorites().catch(console.error);
  }, [isAuthenticated, router, fetchBottles, fetchRecipes, fetchFavorites]);

  if (!isAuthenticated) {
    return null;
  }

  // Calculate stats
  const lowStockCount = bottles.filter((b) => {
    const qty = b['Quantity (ml)'] || 0;
    return qty < 200; // Less than 200ml is "low stock"
  }).length;

  return (
    <div className={styles.dashboard}>
      <div className={styles.container}>
        {/* Header Section */}
        <section className={styles.header}>
          <h1 className={styles.greeting}>
            Ready for your next experiment?
          </h1>
          <p className={styles.stats}>
            You've got <strong>{bottles.length} bottles</strong>
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
            🧪 Ask the AI Bartender
          </Button>
          <div className={styles.secondaryActions}>
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push('/bar')}
            >
              🍾 Add New Bottle
            </Button>
            <Button variant="outline" size="md">
              📤 Import Bar Stock CSV
            </Button>
            <Button variant="outline" size="md">
              📤 Import Recipes CSV
            </Button>
          </div>
        </section>

        {/* Overview Cards */}
        <section className={styles.overview}>
          {/* My Bar Overview */}
          <Card padding="md" className={styles.overviewCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>🍾 My Bar Overview</h3>
              <button
                onClick={() => router.push('/bar')}
                className={styles.viewAllBtn}
              >
                View All →
              </button>
            </div>
            <div className={styles.cardContent}>
              {bottles.length === 0 ? (
                <p className={styles.emptyState}>
                  No bottles yet. Start building your bar!
                </p>
              ) : (
                <ul className={styles.bottleList}>
                  {bottles.slice(0, 3).map((bottle) => (
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
              <h3 className={styles.cardTitle}>📖 Recent Recipes</h3>
              <button
                onClick={() => router.push('/recipes')}
                className={styles.viewAllBtn}
              >
                View All →
              </button>
            </div>
            <div className={styles.cardContent}>
              {recipes.length === 0 ? (
                <p className={styles.emptyState}>
                  No recipes yet. Import your collection!
                </p>
              ) : (
                <ul className={styles.recipeList}>
                  {recipes.slice(0, 3).map((recipe) => (
                    <li key={recipe.id} className={styles.recipeItem}>
                      <span className={styles.recipeName}>{recipe.name}</span>
                      <span className={styles.recipeIngredients}>
                        {recipe.ingredients?.split(',').length || 0} ingredients
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
              <h3 className={styles.cardTitle}>⭐ Favorites</h3>
              <button
                onClick={() => router.push('/favorites')}
                className={styles.viewAllBtn}
              >
                View All →
              </button>
            </div>
            <div className={styles.cardContent}>
              {favorites.length === 0 ? (
                <p className={styles.emptyState}>
                  No favorites yet. Save your favorite drinks!
                </p>
              ) : (
                <ul className={styles.favoriteList}>
                  {favorites.slice(0, 2).map((favorite) => (
                    <li key={favorite.id} className={styles.favoriteItem}>
                      <span className={styles.favoriteIcon}>⭐</span>
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
      </div>
    </div>
  );
}
