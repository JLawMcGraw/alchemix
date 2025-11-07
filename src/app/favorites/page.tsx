'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import styles from './favorites.module.css';

type TabType = 'favorites' | 'history';

export default function FavoritesPage() {
  const router = useRouter();
  const { isAuthenticated, favorites, chatHistory, fetchFavorites, removeFavorite } = useStore();
  const [activeTab, setActiveTab] = useState<TabType>('favorites');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchFavorites().catch(console.error);
  }, [isAuthenticated, router, fetchFavorites]);

  if (!isAuthenticated) {
    return null;
  }

  const handleRemoveFavorite = async (id: number) => {
    if (confirm('Remove this from favorites?')) {
      try {
        await removeFavorite(id);
      } catch (error) {
        console.error('Failed to remove favorite:', error);
      }
    }
  };

  // Group chat history by date
  const groupedHistory = chatHistory.reduce((acc, message) => {
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
          <h1 className={styles.title}>⭐ Favorites</h1>
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
            Favorites ({favorites.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`${styles.tab} ${activeTab === 'history' ? styles.activeTab : ''}`}
          >
            History ({chatHistory.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'favorites' ? (
          // Favorites Tab
          favorites.length === 0 ? (
            <Card padding="lg">
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>⭐</div>
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
              {favorites.map((favorite) => (
                <Card
                  key={favorite.id}
                  padding="md"
                  hover
                  className={styles.favoriteCard}
                >
                  <div className={styles.favoriteHeader}>
                    <div className={styles.favoriteIcon}>⭐</div>
                    <button
                      onClick={() => favorite.id && handleRemoveFavorite(favorite.id)}
                      className={styles.removeBtn}
                      title="Remove from favorites"
                    >
                      ✕
                    </button>
                  </div>
                  <h3 className={styles.favoriteName}>
                    {favorite.recipe_name || 'Unnamed Recipe'}
                  </h3>
                  <p className={styles.favoriteDate}>
                    Saved {new Date(favorite.created_at || '').toLocaleDateString()}
                  </p>
                  <Button variant="outline" size="sm" fullWidth>
                    View Recipe
                  </Button>
                </Card>
              ))}
            </div>
          )
        ) : (
          // History Tab
          chatHistory.length === 0 ? (
            <Card padding="lg">
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🧪</div>
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
                            {message.role === 'user' ? '👤 You' : '🧪 Lab Assistant'}
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
      </div>
    </div>
  );
}
