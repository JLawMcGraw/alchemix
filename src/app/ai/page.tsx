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

  // Normalize apostrophes (all variants to straight ')
  // Using Unicode escapes to prevent editor corruption
  // Covers: U+0027 ' | U+2018 ' | U+2019 ' | U+0060 ` | U+02BC ʼ | U+02BB ʻ | etc.
  const normalizeApostrophes = (text: string): string =>
    text.replace(/[\u0027\u2018\u2019\u0060\u02BC\u02BB\u055A\u05F3\uA78C\uFF07]/g, "'");

  // Helper to match recipe names - prioritizes exact match, then careful fuzzy matching
  const fuzzyRecipeMatch = (aiName: string, dbName: string): boolean => {
    const cleanAI = normalizeApostrophes(aiName).replace(/\s*#\d+\s*$/i, '').trim().toLowerCase();
    const cleanDB = normalizeApostrophes(dbName).replace(/\s*#\d+\s*$/i, '').trim().toLowerCase();

    // Exact match (highest priority)
    if (cleanDB === cleanAI) return true;

    // Strip common prefixes and check exact match
    const prefixes = /^(sc|classic|traditional|original|the|a)\s+/i;
    const strippedAI = cleanAI.replace(prefixes, '');
    const strippedDB = cleanDB.replace(prefixes, '');

    if (strippedDB === strippedAI) return true;

    // Only allow DB to contain AI name (AI might use shorter form)
    // But NOT the reverse - "navy grog".includes("grog") should NOT match "Grog" recipe
    // This prevents "Navy Grog" from matching "Grog" when we want exact "Navy Grog"
    if (cleanDB.includes(cleanAI) && cleanAI.length > 3) return true;
    if (strippedDB.includes(strippedAI) && strippedAI.length > 3) return true;

    return false;
  };

  const handleRecipeClick = (recipeName: string) => {
    const normalizedClick = normalizeApostrophes(recipeName).toLowerCase();

    // First try exact match (case-insensitive, apostrophe-normalized)
    let recipe = recipesArray.find((r) =>
      normalizeApostrophes(r.name).toLowerCase() === normalizedClick
    );

    // Fall back to fuzzy match only if no exact match
    if (!recipe) {
      recipe = recipesArray.find((r) => fuzzyRecipeMatch(recipeName, r.name));
    }

    if (recipe) {
      console.log('[RecipeClick] Clicked:', recipeName, '-> Found:', recipe.name);
      setSelectedRecipe(recipe);
    } else {
      console.log('[RecipeClick] Clicked:', recipeName, '-> NOT FOUND');
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
      const normalizedRec = normalizeApostrophes(name).toLowerCase();
      let recipe = recipesArray.find((r) =>
        normalizeApostrophes(r.name).toLowerCase() === normalizedRec
      );
      if (!recipe) {
        recipe = recipesArray.find((r) => fuzzyRecipeMatch(name, r.name));
      }
      if (recipe) {
        linkableRecipes.add(recipe.name);
      }
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

    // CRITICAL FIX: Filter out substring collisions
    // If we have both "Navy Grog" and "Grog", remove "Grog" to prevent partial linking
    const filteredRecipes = Array.from(linkableRecipes).filter((name) => {
      const lowerName = normalizeApostrophes(name).toLowerCase();
      // Keep this recipe ONLY if no other recipe in the set contains it as a substring
      const shouldFilter = Array.from(linkableRecipes).some((other) => {
        if (other === name) return false;
        const lowerOther = normalizeApostrophes(other).toLowerCase();
        return lowerOther.includes(lowerName);
      });
      return !shouldFilter;
    });

    if (filteredRecipes.length === 0) {
      return <div className={styles.messageText}>{message.content}</div>;
    }

    let displayText = explanation;

    // Wrap all linkable recipe names with markers
    // Helper to create regex pattern that matches any apostrophe variant
    const escapeForRegex = (name: string): string => {
      return name
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/[\u0027\u2018\u2019\u0060\u02BC\u02BB\u055A\u05F3\uA78C\uFF07]/g, "[\u0027\u2018\u2019\u0060\u02BC\u02BB\u055A\u05F3\uA78C\uFF07]");
    };

    // Sort by length (longest first) to prevent partial matches
    // e.g., "Navy Grog" should be matched before "Grog"
    const sortedRecipes = filteredRecipes.sort((a, b) => b.length - a.length);

    // Track which positions have been replaced to avoid double-linking
    sortedRecipes.forEach((recipeName) => {
      const escapedFullName = escapeForRegex(recipeName);
      // Use flexible boundary matching that handles recipe names ending with non-word chars
      // like parentheses: "Mai Tai (Royal Hawaiian)"
      // Capture boundary chars so we can preserve them in replacement
      const fullNameRegex = new RegExp(`(^|[^\\w])(${escapedFullName})([^\\w]|$)`, 'gi');

      // Replace only if not already inside markers
      displayText = displayText.replace(fullNameRegex, (match, before, name, after, offset) => {
        // Check if this match is already inside __RECIPE__...__RECIPE__
        // Count markers before this position - odd count means we're inside
        const beforeMatch = displayText.substring(0, offset);
        const markerCount = (beforeMatch.match(/__RECIPE__/g) || []).length;
        if (markerCount % 2 === 1) {
          return match; // Don't replace, already inside markers (odd = between open/close)
        }

        // Preserve boundary characters, wrap recipe name with markers
        return `${before}__RECIPE__${recipeName}__RECIPE__${after}`;
      });
    });

    const parts = displayText.split(/__RECIPE__(.*?)__RECIPE__/);

    return (
      <div className={styles.messageText}>
        {parts.map((part, index) => {
          const normalizedPart = normalizeApostrophes(part).toLowerCase();
          const isRecipe = sortedRecipes.some(
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
