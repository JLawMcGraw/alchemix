/**
 * AI Page Constants
 * Centralized strings for the AI bartender chat interface
 */

/** Lab-themed thinking phrases for the AI typing animation */
export const THINKING_PHRASES = [
  "Analyzing your bar inventory",
  "Consulting the recipe archives",
  "Running flavor experiments",
  "Mixing up some ideas",
  "Calculating molecular ratios",
  "Searching the cocktail database",
  "Distilling your options",
  "Fermenting a response",
  "Shaking up suggestions",
  "Measuring ingredient synergies",
  "Reviewing tasting notes",
  "Cross-referencing flavor profiles",
  "Checking spirit compatibility",
  "Balancing the formula",
  "Preparing lab results",
  "Consulting the lab notes",
] as const;

/** Quick prompt suggestions shown to users */
export const QUICK_PROMPTS = [
  "What can I make right now?",
  "Suggest something with gin",
  "I want something refreshing",
  "What should I buy next?",
] as const;

/** Date labels for chat history grouping */
export const DATE_LABELS = {
  TODAY: 'Today',
  YESTERDAY: 'Yesterday',
} as const;
