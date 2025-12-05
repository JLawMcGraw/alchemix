'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type Units = 'oz' | 'ml' | 'cl';
export type RecipeView = 'cards' | 'list' | 'compact';

export interface Settings {
  theme: Theme;
  units: Units;
  recipeView: RecipeView;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  units: 'oz',
  recipeView: 'cards',
};

const STORAGE_KEY = 'alchemix-settings';

/**
 * Hook for managing user settings with localStorage persistence
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    setIsLoaded(true);
  }, []);

  // Apply theme when settings change
  useEffect(() => {
    if (!isLoaded) return;

    const applyTheme = (theme: Theme) => {
      const root = document.documentElement;

      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', theme);
      }
    };

    applyTheme(settings.theme);

    // Listen for system theme changes if using system theme
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [settings.theme, isLoaded]);

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
      return updated;
    });
  }, []);

  // Individual setters for convenience
  const setTheme = useCallback((theme: Theme) => {
    saveSettings({ theme });
  }, [saveSettings]);

  const setUnits = useCallback((units: Units) => {
    saveSettings({ units });
  }, [saveSettings]);

  const setRecipeView = useCallback((recipeView: RecipeView) => {
    saveSettings({ recipeView });
  }, [saveSettings]);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  }, []);

  return {
    settings,
    isLoaded,
    setTheme,
    setUnits,
    setRecipeView,
    saveSettings,
    resetSettings,
  };
}

/**
 * Unit conversion utilities
 */
export const unitConversions = {
  ozToMl: (oz: number) => oz * 29.5735,
  mlToOz: (ml: number) => ml / 29.5735,
  ozToCl: (oz: number) => oz * 2.95735,
  clToOz: (cl: number) => cl / 2.95735,
  mlToCl: (ml: number) => ml / 10,
  clToMl: (cl: number) => cl * 10,
};

/**
 * Format amount with unit
 */
export function formatAmount(amount: number, fromUnit: Units, toUnit: Units): string {
  let converted = amount;

  if (fromUnit !== toUnit) {
    // Convert to oz first (base unit)
    if (fromUnit === 'ml') converted = unitConversions.mlToOz(amount);
    else if (fromUnit === 'cl') converted = unitConversions.clToOz(amount);

    // Convert from oz to target unit
    if (toUnit === 'ml') converted = unitConversions.ozToMl(converted);
    else if (toUnit === 'cl') converted = unitConversions.ozToCl(converted);
  }

  // Format with appropriate precision
  const formatted = converted < 1
    ? converted.toFixed(2)
    : converted < 10
      ? converted.toFixed(1)
      : Math.round(converted).toString();

  return `${formatted} ${toUnit}`;
}
