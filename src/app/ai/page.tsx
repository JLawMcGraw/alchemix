'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { ChatMessage } from '@/types';
import styles from './ai.module.css';

export default function AIPage() {
  const router = useRouter();
  const { isAuthenticated, chatHistory, sendMessage, clearChat } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  if (!isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    try {
      await sendMessage(userMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      clearChat();
    }
  };

  return (
    <div className={styles.aiPage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>🧪 AI Bartender</h1>
            <p className={styles.subtitle}>
              Your cocktail lab assistant powered by AI
            </p>
          </div>
          {chatHistory.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearChat}>
              Clear Chat
            </Button>
          )}
        </div>

        {/* Chat Container */}
        <div className={styles.chatContainer}>
          {/* Messages */}
          <div className={styles.messages}>
            {chatHistory.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🧪</div>
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
                {chatHistory.map((message, index) => (
                  <div
                    key={index}
                    className={`${styles.message} ${
                      message.role === 'user' ? styles.userMessage : styles.aiMessage
                    }`}
                  >
                    <div className={styles.messageIcon}>
                      {message.role === 'user' ? '👤' : '🧪'}
                    </div>
                    <Card
                      padding="md"
                      className={
                        message.role === 'user'
                          ? styles.userBubble
                          : styles.aiBubble
                      }
                    >
                      <p className={styles.messageText}>{message.content}</p>
                      <span className={styles.messageTime}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </Card>
                  </div>
                ))}
                {loading && (
                  <div className={`${styles.message} ${styles.aiMessage}`}>
                    <div className={styles.messageIcon}>🧪</div>
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
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
