'use client';

import React, { useEffect } from 'react';

const STORAGE_KEY = 'alchemix-settings';

/**
 * ThemeProvider - Applies saved theme preference globally
 *
 * This component runs at the root level to ensure the user's theme preference
 * is applied on all pages, including the login page. It reads from localStorage
 * and applies the data-theme attribute to the HTML element.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply theme from localStorage
    const applyStoredTheme = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const settings = JSON.parse(stored);
          const theme = settings.theme;

          if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
          } else if (theme === 'dark' || theme === 'light') {
            document.documentElement.setAttribute('data-theme', theme);
          }
        }
        // If no stored settings, leave as default (light mode via CSS)
      } catch (error) {
        console.error('Failed to apply theme:', error);
      }
    };

    applyStoredTheme();

    // Listen for system theme changes if using system theme
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const settings = JSON.parse(stored);
          if (settings.theme === 'system') {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
          }
        }
      } catch (error) {
        console.error('Failed to handle theme change:', error);
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  return <>{children}</>;
}
