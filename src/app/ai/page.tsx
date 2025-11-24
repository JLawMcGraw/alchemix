'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RecipeDetailModal } from '@/components/modals';
import { parseAIResponse } from '@/lib/aiPersona';
import { Sparkles, Send, User } from 'lucide-react';
import type { ChatMessage, Recipe } from '@/types';
import styles from './ai.module.css';

export default function AIPage() {
  const router = useRouter();
  const { isValidating, isAuthenticated } = useAuthGuard();
  const {
    chatHistory,
    sendMessage,
    clearChat,
    recipes,
    favorites,
    addFavorite,
    removeFavorite,
    fetchRecipes,
    fetchFavorites,
    error: storeError
  } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Fetch recipes and favorites on mount (CRITICAL FIX)
  useEffect(() => {
    if (isAuthenticated && !isValidating) {
      console.log('🔄 Fetching recipes and favorites for AI page...');
      fetchRecipes();
      fetchFavorites();
    }
  }, [isAuthenticated, isValidating, fetchRecipes, fetchFavorites]);

  if (isValidating || !isAuthenticated) {
    return null;
  }

  // Ensure chatHistory/favorites are arrays
  const chatArray = Array.isArray(chatHistory) ? chatHistory : [];
  const favoritesArray = Array.isArray(favorites) ? favorites : [];

  const isRecipeFavorited = (recipe: Recipe | null): boolean => {
    if (!recipe) {
      return false;
    }
    if (recipe.id) {
      return favoritesArray.some((fav) => fav.recipe_id === recipe.id);
    }
    return favoritesArray.some(
      (fav) =>
        fav.recipe_name?.toLowerCase() === recipe.name.toLowerCase()
    );
  };

  const findFavoriteForRecipe = (recipe: Recipe | null) => {
    if (!recipe) {
      return undefined;
    }
    if (recipe.id) {
      const byId = favoritesArray.find((fav) => fav.recipe_id === recipe.id);
      if (byId) {
        return byId;
      }
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
      console.log('🚀 Sending message to AI:', userMessage);
      await sendMessage(userMessage);
      console.log('✅ AI response received');
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setErrorMessage(error.message || 'Failed to send message. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      clearChat();
    }
  };

  // Handle clicking on a recipe name
  const handleRecipeClick = (recipeName: string) => {
    // Find the recipe in the user's collection
    const recipesArray = Array.isArray(recipes) ? recipes : [];

    // Try exact match first
    let recipe = recipesArray.find((r) =>
      r.name.toLowerCase() === recipeName.toLowerCase()
    );

    // If no exact match, try partial match (handles "DAIQUIRI #1" vs "DAIQUIRI")
    if (!recipe) {
      recipe = recipesArray.find((r) => {
        const cleanRecipeName = recipeName.replace(/\s*#\d+\s*$/i, '').trim().toLowerCase();
        const cleanDbName = r.name.replace(/\s*#\d+\s*$/i, '').trim().toLowerCase();
        return cleanDbName === cleanRecipeName ||
               r.name.toLowerCase().includes(cleanRecipeName) ||
               cleanRecipeName.includes(r.name.toLowerCase());
      });
    }

    if (recipe) {
      console.log('✅ Found recipe:', recipe.name);
      setSelectedRecipe(recipe);
    } else {
      console.log('❌ Recipe not found:', recipeName, 'Available:', recipesArray.map(r => r.name));
    }
  };

  // Render AI message with clickable recipe names
  const renderMessageContent = (message: ChatMessage) => {
    if (message.role !== 'assistant') {
      return <p className={styles.messageText}>{message.content}</p>;
    }

    // Parse the AI response to extract recommendations
    const { explanation, recommendations } = parseAIResponse(message.content);

    const recipesArray = Array.isArray(recipes) ? recipes : [];

    console.log('🔍 Parsing AI response:', {
      hasRecommendations: recommendations.length > 0,
      recommendations,
      availableRecipes: recipesArray.map(r => r.name),
      messagePreview: message.content.substring(0, 100)
    });

    // If no recommendations, just show the content as-is
    if (recommendations.length === 0) {
      console.log('⚠️ No RECOMMENDATIONS: line found in AI response');
      return <p className={styles.messageText}>{message.content}</p>;
    }

    // Split the explanation into parts and make recipe names clickable
    let displayText = explanation;

    // Create clickable links for each recommended recipe
    recommendations.forEach((recipeName) => {
      // Check if this recipe exists in user's collection (with flexible matching)
      const recipe = recipesArray.find((r) => {
        const cleanRecipeName = recipeName.replace(/\s*#\d+\s*$/i, '').trim().toLowerCase();
        const cleanDbName = r.name.replace(/\s*#\d+\s*$/i, '').trim().toLowerCase();
        return cleanDbName === cleanRecipeName ||
               r.name.toLowerCase().includes(cleanRecipeName) ||
               cleanRecipeName.includes(r.name.toLowerCase());
      });

      if (recipe) {
        console.log(`✅ Recipe match: "${recipeName}" → "${recipe.name}"`);

        // Replace both the full name AND the base name (without #1, #2, etc.)
        // This handles cases where AI says "DAIQUIRI" in text but "DAIQUIRI #1" in recommendations

        // Try exact match first
        // Escape special regex characters (including parentheses)
        const escapedFullName = recipeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Don't use \b with parentheses - use negative lookbehind/lookahead for word boundaries
        const fullNameRegex = new RegExp(`(?<!\\w)${escapedFullName}(?!\\w)`, 'gi');
        displayText = displayText.replace(fullNameRegex, `__RECIPE__${recipeName}__RECIPE__`);

        // Also try base name without suffix (e.g., "DAIQUIRI" from "DAIQUIRI #1")
        const baseName = recipeName.replace(/\s*#\d+\s*$/i, '').trim();
        if (baseName !== recipeName) {
          const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Use negative lookbehind/lookahead instead of \b for better parentheses handling
          const baseNameRegex = new RegExp(`(?<!\\w)${escapedBaseName}(?!\\w|\\s*#)`, 'gi');
          displayText = displayText.replace(baseNameRegex, `__RECIPE__${recipeName}__RECIPE__`);
        }
      } else {
        console.log(`❌ No recipe match for: "${recipeName}"`);
      }
    });

    // Split by recipe markers and render
    const parts = displayText.split(/__RECIPE__(.*?)__RECIPE__/);

    console.log('📝 Rendered parts:', {
      totalParts: parts.length,
      parts: parts.map((p, i) => ({ index: i, text: p.substring(0, 30), isRecipe: recommendations.some(r => r.toLowerCase() === p.toLowerCase()) }))
    });

    return (
      <div className={styles.messageText}>
        {parts.map((part, index) => {
          // Check if this part is a recipe name
          const isRecipe = recommendations.some(
            (r) => r.toLowerCase() === part.toLowerCase()
          );

          if (isRecipe) {
            return (
              <span
                key={index}
                onClick={() => handleRecipeClick(part)}
                style={{
                  color: 'var(--color-primary)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
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

  return (
    <div className={styles.aiPage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <Sparkles size={32} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
              AI Bartender
            </h1>
            <p className={styles.subtitle}>
              Your cocktail lab assistant powered by AI
            </p>
          </div>
          {chatArray.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearChat}>
              Clear Chat
            </Button>
          )}
        </div>

        {/* Chat Container */}
        <div className={styles.chatContainer}>
          {/* Messages */}
          <div className={styles.messages}>
            {chatArray.length === 0 ? (
              <div className={styles.emptyState}>
                <Sparkles size={64} className={styles.emptyIcon} strokeWidth={1.5} />
                <h3 className={styles.emptyTitle}>Start Your Experiment</h3>
                <p className={styles.emptyText}>
                  Ask the Lab Assistant for cocktail recommendations based on your
                  bar inventory
                </p>
                <div className={styles.suggestions}>
                  <p className={styles.suggestionsLabel}>Try asking:</p>
                  <button
                    onClick={() => setInput("What can I make with whiskey?")}
                    className={styles.suggestionBtn}
                  >
                    "What can I make with whiskey?"
                  </button>
                  <button
                    onClick={() => setInput("Suggest a refreshing summer cocktail")}
                    className={styles.suggestionBtn}
                  >
                    "Suggest a refreshing summer cocktail"
                  </button>
                  <button
                    onClick={() => setInput("What cocktails use gin?")}
                    className={styles.suggestionBtn}
                  >
                    "What cocktails use gin?"
                  </button>
                </div>
              </div>
            ) : (
              <>
                {chatArray.map((message, index) => (
                  <div
                    key={index}
                    className={`${styles.message} ${
                      message.role === 'user' ? styles.userMessage : styles.aiMessage
                    }`}
                  >
                    <div className={styles.messageIcon}>
                      {message.role === 'user' ? <User size={24} /> : <Sparkles size={24} />}
                    </div>
                    <Card
                      padding="md"
                      className={
                        message.role === 'user'
                          ? styles.userBubble
                          : styles.aiBubble
                      }
                    >
                      {renderMessageContent(message)}
                      {message.timestamp && (
                        <span className={styles.messageTime}>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </Card>
                  </div>
                ))}
                {loading && (
                  <div className={`${styles.message} ${styles.aiMessage}`}>
                    <div className={styles.messageIcon}>
                      <Sparkles size={24} />
                    </div>
                    <Card padding="md" className={styles.aiBubble}>
                      <div className={styles.typing}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div style={{
              padding: '12px',
              margin: '8px 0',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '8px',
              color: '#c33',
              fontSize: '14px'
            }}>
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the AI Bartender..."
              className={styles.input}
              disabled={loading}
            />
            <Button type="submit" variant="primary" disabled={loading || !input.trim()}>
              <Send size={18} />
            </Button>
          </form>
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
    </div>
  );
}
