'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RecipeDetailModal } from '@/components/modals';
import { Star, Sparkles, X, User } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { Recipe } from '@/types';
import styles from './favorites.module.css';

type TabType = 'favorites' | 'history';

export default function FavoritesPage() {
  const router = useRouter();
  const { isAuthenticated, favorites, recipes, chatHistory, fetchFavorites, fetchRecipes, removeFavorite, addFavorite } = useStore();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('favorites');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchFavorites().catch(console.error);
    fetchRecipes().catch(console.error);
  }, [isAuthenticated, router, fetchFavorites, fetchRecipes]);

  if (!isAuthenticated) {
    return null;
  }

  // Ensure arrays
  const favoritesArray = Array.isArray(favorites) ? favorites : [];
  const recipesArray = Array.isArray(recipes) ? recipes : [];
  const chatArray = Array.isArray(chatHistory) ? chatHistory : [];

  const handleViewRecipe = (favorite: typeof favoritesArray[0]) => {
    // Try to find the recipe by recipe_id
    if (favorite.recipe_id) {
      const recipe = recipesArray.find(r => r.id === favorite.recipe_id);
      if (recipe) {
        setSelectedRecipe(recipe);
        return;
      }
    }

    // Fallback: search by recipe name
    const recipe = recipesArray.find(r => r.name === favorite.recipe_name);
    if (recipe) {
      setSelectedRecipe(recipe);
    } else {
      showToast('error', 'Recipe not found. It may have been deleted.');
    }
  };

  const handleRemoveFavorite = async (id: number) => {
    if (confirm('Remove this from favorites?')) {
      try {
        await removeFavorite(id);
        showToast('success', 'Removed from favorites');
      } catch (error) {
        console.error('Failed to remove favorite:', error);
        showToast('error', 'Failed to remove favorite');
      }
    }
  };

  const isFavorited = (recipeId: number) => {
    return favoritesArray.some((fav) => fav.recipe_id === recipeId);
  };

  const handleToggleFavorite = async (recipe: Recipe) => {
    if (!recipe.id) return;

    const favorite = favoritesArray.find((fav) => fav.recipe_id === recipe.id);
    try {
      if (favorite && favorite.id) {
        await removeFavorite(favorite.id);
        setSelectedRecipe(null); // Close modal after removing
        showToast('success', 'Removed from favorites');
      } else {
        await addFavorite(recipe.name, recipe.id);
        showToast('success', 'Added to favorites');
      }
    } catch (error) {
      showToast('error', 'Failed to update favorites');
      console.error('Failed to toggle favorite:', error);
    }
  };

  // Group chat history by date
  const groupedHistory = chatArray.reduce((acc, message) => {
    const date = new Date(message.timestamp).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(message);
    return acc;
  }, {} as Record<string, typeof chatHistory>);

  return (
    <div className={styles.favoritesPage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            <Star size={32} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
            Favorites
          </h1>
          <p className={styles.subtitle}>
            Your saved recipes and conversation history
          </p>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`${styles.tab} ${activeTab === 'favorites' ? styles.activeTab : ''}`}
          >
            Favorites ({favoritesArray.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`${styles.tab} ${activeTab === 'history' ? styles.activeTab : ''}`}
          >
            History ({chatArray.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'favorites' ? (
          // Favorites Tab
          favoritesArray.length === 0 ? (
            <Card padding="lg">
              <div className={styles.emptyState}>
                <Star size={64} className={styles.emptyIcon} strokeWidth={1.5} />
                <h3 className={styles.emptyTitle}>No favorites yet</h3>
                <p className={styles.emptyText}>
                  Your lab's waiting for its next experiment. Save recipes to see them here!
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => router.push('/recipes')}
                >
                  Browse Recipes
                </Button>
              </div>
            </Card>
          ) : (
            <div className={styles.favoritesGrid}>
              {favoritesArray.map((favorite) => (
                <Card
                  key={favorite.id}
                  padding="md"
                  hover
                  className={styles.favoriteCard}
                >
                  <div className={styles.favoriteHeader}>
                    <Star size={28} className={styles.favoriteIcon} fill="currentColor" />
                    <button
                      onClick={() => favorite.id && handleRemoveFavorite(favorite.id)}
                      className={styles.removeBtn}
                      title="Remove from favorites"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <h3 className={styles.favoriteName}>
                    {favorite.recipe_name || 'Unnamed Recipe'}
                  </h3>
                  <p className={styles.favoriteDate}>
                    Saved {new Date(favorite.created_at || '').toLocaleDateString()}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    fullWidth
                    onClick={() => handleViewRecipe(favorite)}
                  >
                    View Recipe
                  </Button>
                </Card>
              ))}
            </div>
          )
        ) : (
          // History Tab
          chatArray.length === 0 ? (
            <Card padding="lg">
              <div className={styles.emptyState}>
                <Sparkles size={64} className={styles.emptyIcon} strokeWidth={1.5} />
                <h3 className={styles.emptyTitle}>No conversation history</h3>
                <p className={styles.emptyText}>
                  Start chatting with the AI Bartender to see your history here
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => router.push('/ai')}
                >
                  Ask the AI Bartender
                </Button>
              </div>
            </Card>
          ) : (
            <div className={styles.historyList}>
              {Object.entries(groupedHistory).map(([date, messages]) => (
                <div key={date} className={styles.historyGroup}>
                  <h3 className={styles.historyDate}>{date}</h3>
                  <Card padding="md">
                    <ul className={styles.messagesList}>
                      {messages.map((message, index) => (
                        <li key={index} className={styles.historyItem}>
                          <span className={styles.messageRole}>
                            {message.role === 'user' ? (
                              <>
                                <User size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                You
                              </>
                            ) : (
                              <>
                                <Sparkles size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                Lab Assistant
                              </>
                            )}
                          </span>
                          <p className={styles.messageContent}>
                            {message.content.length > 100
                              ? `${message.content.slice(0, 100)}...`
                              : message.content}
                          </p>
                          <span className={styles.messageTime}>
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              ))}
            </div>
          )
        )}

        {/* Recipe Detail Modal */}
        <RecipeDetailModal
          isOpen={!!selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          recipe={selectedRecipe}
          isFavorited={selectedRecipe ? isFavorited(selectedRecipe.id!) : false}
          onToggleFavorite={() => {
            if (selectedRecipe) {
              handleToggleFavorite(selectedRecipe);
            }
          }}
        />
      </div>
    </div>
  );
}
