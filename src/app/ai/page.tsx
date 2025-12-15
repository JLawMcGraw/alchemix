'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { RecipeDetailModal } from '@/components/modals';
import { parseAIResponse } from '@/lib/aiPersona';
import { RotateCcw } from 'lucide-react';
import { AlcheMixLogo } from '@/components/ui';
import type { ChatMessage, Recipe } from '@/types';
import styles from './ai.module.css';

export default function AIPage() {
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    chatHistory,
    sendMessage,
    clearChat,
    recipes,
    favorites,
    inventoryItems,
    shoppingListStats,
    addFavorite,
    removeFavorite,
    fetchRecipes,
    fetchFavorites,
    fetchItems,
    fetchShoppingList,
  } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ensure arrays (must be before any conditional returns for hooks)
  const chatArray = Array.isArray(chatHistory) ? chatHistory : [];
  const favoritesArray = Array.isArray(favorites) ? favorites : [];
  const recipesArray = Array.isArray(recipes) ? recipes : [];
  const inventoryArray = Array.isArray(inventoryItems) ? inventoryItems : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      fetchRecipes();
      fetchFavorites();
      fetchItems();
      fetchShoppingList();
    }
  }, [isAuthenticated, isValidating, fetchRecipes, fetchFavorites, fetchItems, fetchShoppingList]);

  if (isValidating || !isAuthenticated) {
    return null;
  }

  // Bar context stats
  const barContext = {
    bottles: inventoryArray.length,
    recipes: recipesArray.length,
    craftable: shoppingListStats?.craftable || 0,
  };

  // Quick prompts
  const quickPrompts = [
    "What can I make right now?",
    "Suggest something with gin",
    "I want something refreshing",
    "What should I buy next?",
  ];

  // Group chat history by date for sidebar
  const getHistorySessions = () => {
    const sessions: { id: number; preview: string; date: string }[] = [];
    const seenPreviews = new Set<string>();

    chatArray.forEach((msg, index) => {
      if (msg.role === 'user' && !seenPreviews.has(msg.content.substring(0, 50))) {
        seenPreviews.add(msg.content.substring(0, 50));
        const date = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (date.toDateString() === today.toDateString()) {
          dateStr = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
          dateStr = 'Yesterday';
        }

        sessions.push({
          id: index,
          preview: msg.content.length > 35 ? msg.content.substring(0, 35) + '...' : msg.content,
          date: dateStr,
        });
      }
    });

    return sessions.slice(-5).reverse(); // Last 5, most recent first
  };

  const historySessions = getHistorySessions();

  const isRecipeFavorited = (recipe: Recipe | null): boolean => {
    if (!recipe) return false;
    if (recipe.id) {
      return favoritesArray.some((fav) => fav.recipe_id === recipe.id);
    }
    return favoritesArray.some(
      (fav) => fav.recipe_name?.toLowerCase() === recipe.name.toLowerCase()
    );
  };

  const findFavoriteForRecipe = (recipe: Recipe | null) => {
    if (!recipe) return undefined;
    if (recipe.id) {
      const byId = favoritesArray.find((fav) => fav.recipe_id === recipe.id);
      if (byId) return byId;
    }
    return favoritesArray.find(
      (fav) => fav.recipe_name?.toLowerCase() === recipe.name.toLowerCase()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setErrorMessage(null);

    try {
      await sendMessage(userMessage);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send message.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      clearChat();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  // Normalize apostrophes (curly ' vs straight ')
  const normalizeApostrophes = (text: string): string =>
    text.replace(/[''`]/g, "'");

  // Helper to match recipe names with common prefix variations (SC, Classic, etc.)
  const fuzzyRecipeMatch = (aiName: string, dbName: string): boolean => {
    const cleanAI = normalizeApostrophes(aiName).replace(/\s*#\d+\s*$/i, '').trim().toLowerCase();
    const cleanDB = normalizeApostrophes(dbName).replace(/\s*#\d+\s*$/i, '').trim().toLowerCase();

    // Exact match
    if (cleanDB === cleanAI) return true;

    // One contains the other
    if (cleanDB.includes(cleanAI) || cleanAI.includes(cleanDB)) return true;

    // Strip common prefixes and check again
    const prefixes = /^(sc|classic|traditional|original|the|a)\s+/i;
    const strippedAI = cleanAI.replace(prefixes, '');
    const strippedDB = cleanDB.replace(prefixes, '');

    if (strippedDB === strippedAI) return true;
    if (strippedDB.includes(strippedAI) || strippedAI.includes(strippedDB)) return true;

    return false;
  };

  const handleRecipeClick = (recipeName: string) => {
    const recipe = recipesArray.find((r) => fuzzyRecipeMatch(recipeName, r.name));

    if (recipe) {
      setSelectedRecipe(recipe);
    }
  };

  const renderMessageContent = (message: ChatMessage) => {
    if (message.role !== 'assistant') {
      return <div className={styles.messageText}>{message.content}</div>;
    }

    const { explanation, recommendations } = parseAIResponse(message.content);

    // Build a set of all linkable recipe names (from RECOMMENDATIONS + scanning text)
    const linkableRecipes = new Set<string>();

    // Add recipes from RECOMMENDATIONS line
    recommendations.forEach((name) => {
      const recipe = recipesArray.find((r) => fuzzyRecipeMatch(name, r.name));
      if (recipe) linkableRecipes.add(recipe.name);
    });

    // Also scan explanation for recipe names from user's database
    const normalizedExplanation = normalizeApostrophes(explanation).toLowerCase();
    recipesArray.forEach((recipe) => {
      const normalizedName = normalizeApostrophes(recipe.name).toLowerCase();
      // Check if recipe name appears in the text (word boundary check)
      const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nameRegex = new RegExp(`(?:^|[^\\w])${escapedName}(?:[^\\w]|$)`, 'i');
      if (nameRegex.test(normalizedExplanation)) {
        linkableRecipes.add(recipe.name);
      }
    });

    if (linkableRecipes.size === 0) {
      return <div className={styles.messageText}>{message.content}</div>;
    }

    let displayText = explanation;

    // Wrap all linkable recipe names with markers
    // Helper to create regex pattern that matches any apostrophe variant
    const escapeForRegex = (name: string): string => {
      return name
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/['`']/g, "[''`]"); // Match any apostrophe variant
    };

    linkableRecipes.forEach((recipeName) => {
      const escapedFullName = escapeForRegex(recipeName);
      const fullNameRegex = new RegExp(`(?<!\\w)${escapedFullName}(?!\\w)`, 'gi');
      displayText = displayText.replace(fullNameRegex, `__RECIPE__${recipeName}__RECIPE__`);

      // Also try without common prefixes (SC, Classic, etc.)
      const prefixes = /^(sc|classic|traditional|original|the|a)\s+/i;
      const baseName = recipeName.replace(prefixes, '').trim();
      if (baseName !== recipeName && baseName.length > 3) {
        const escapedBaseName = escapeForRegex(baseName);
        const baseNameRegex = new RegExp(`(?<!\\w)${escapedBaseName}(?!\\w)`, 'gi');
        // Only replace if not already wrapped
        displayText = displayText.replace(baseNameRegex, (match) => {
          // Check if already wrapped
          const before = displayText.substring(0, displayText.indexOf(match));
          if (before.endsWith('__RECIPE__')) return match;
          return `__RECIPE__${recipeName}__RECIPE__`;
        });
      }
    });

    const parts = displayText.split(/__RECIPE__(.*?)__RECIPE__/);

    return (
      <div className={styles.messageText}>
        {parts.map((part, index) => {
          const normalizedPart = normalizeApostrophes(part).toLowerCase();
          const isRecipe = Array.from(linkableRecipes).some(
            (r) => normalizeApostrophes(r).toLowerCase() === normalizedPart
          );

          if (isRecipe) {
            return (
              <span
                key={index}
                onClick={() => handleRecipeClick(part)}
                className={styles.recipeLink}
              >
                {part}
              </span>
            );
          }

          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };

  const formatTimestamp = (timestamp: string | Date | undefined) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.mainGrid}>
          {/* Left Sidebar */}
          <div className={styles.sidebar}>
            {/* Bar Context */}
            <div className={styles.contextCard}>
              <div className={styles.contextLabel}>Your Bar Context</div>
              <div className={styles.contextStats}>
                <div className={styles.contextRow}>
                  <span className={styles.contextKey}>Bottles</span>
                  <span className={styles.contextValue}>{barContext.bottles}</span>
                </div>
                <div className={styles.contextRow}>
                  <span className={styles.contextKey}>Recipes</span>
                  <span className={styles.contextValue}>{barContext.recipes}</span>
                </div>
                <div className={styles.contextRow}>
                  <span className={styles.contextKey}>Craftable</span>
                  <span className={styles.contextValueGreen}>{barContext.craftable}</span>
                </div>
              </div>
              <div className={styles.contextStatus}>
                <div className={styles.statusDot} />
                AI has access to your data
              </div>
            </div>

            {/* Quick Prompts */}
            <div className={styles.promptsCard}>
              <div className={styles.promptsLabel}>Quick Prompts</div>
              <div className={styles.promptsList}>
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickPrompt(prompt)}
                    className={styles.promptBtn}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* History */}
            <div className={styles.historyCard}>
              <div className={styles.historyHeader}>
                <span className={styles.historyLabel}>History</span>
                {chatArray.length > 0 && (
                  <button className={styles.clearBtn} onClick={handleClearChat}>
                    Clear
                  </button>
                )}
              </div>
              {historySessions.length === 0 ? (
                <div className={styles.historyEmpty}>No history yet</div>
              ) : (
                <div className={styles.historyList}>
                  {historySessions.map((session) => (
                    <div key={session.id} className={styles.historyItem}>
                      <div className={styles.historyPreview}>{session.preview}</div>
                      <div className={styles.historyDate}>{session.date}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className={styles.chatArea}>
            {/* Chat Header */}
            <div className={styles.chatHeader}>
              <div className={styles.chatHeaderLeft}>
                <div className={styles.statusDotLarge} />
                <span className={styles.chatTitle}>Lab Assistant</span>
              </div>
              <button className={styles.newChatBtn} onClick={handleClearChat}>
                <RotateCcw size={14} />
                New Chat
              </button>
            </div>

            {/* Messages */}
            <div className={styles.messages}>
              {chatArray.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyLogo}>
                    <AlcheMixLogo size="lg" showText={false} />
                  </div>
                  <h3 className={styles.emptyTitle}>Ask the Lab Assistant</h3>
                  <p className={styles.emptyText}>
                    I know your bar inventory and recipe collection. Ask me what you can make, get recommendations, or explore new cocktails.
                  </p>
                </div>
              ) : (
                <>
                  {chatArray.map((message, index) => (
                    <div
                      key={index}
                      className={message.role === 'user' ? styles.messageUser : styles.messageAi}
                    >
                      {renderMessageContent(message)}
                      <div className={styles.messageTime}>
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className={styles.messageAi}>
                      <div className={styles.typing}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className={styles.errorMessage}>
                {errorMessage}
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} className={styles.inputForm}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about cocktails, ingredients, or recipes..."
                className={styles.input}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className={styles.sendBtn}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          isOpen={!!selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          isFavorited={isRecipeFavorited(selectedRecipe)}
          onToggleFavorite={async () => {
            const favorite = findFavoriteForRecipe(selectedRecipe);
            if (favorite && favorite.id) {
              await removeFavorite(favorite.id);
            } else if (selectedRecipe) {
              await addFavorite(selectedRecipe.name, selectedRecipe.id);
            }
            await fetchFavorites();
          }}
        />
      )}
    </div>
  );
}
