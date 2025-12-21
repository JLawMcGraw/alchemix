'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to track the current theme (dark/light mode)
 * @returns isDarkMode - true if dark mode is active
 */
export function useTheme(): { isDarkMode: boolean } {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme === 'dark');
    };

    // Check initial theme
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  return { isDarkMode };
}
