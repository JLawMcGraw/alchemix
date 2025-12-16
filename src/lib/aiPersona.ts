/**
 * AI Response Parser
 *
 * Parses AI responses to extract recommendations and state tokens.
 * The actual prompt building happens server-side in api/src/services/AIService.ts
 */

/**
 * Parse AI response to extract recommendations and state
 */
export function parseAIResponse(responseText: string): {
  explanation: string;
  recommendations: string[];
  state: string | null;
} {
  let explanation = responseText;
  let recommendations: string[] = [];
  let state: string | null = null;

  // Extract state token if present (e.g., [STATE: SUGGESTING])
  const stateMatch = responseText.match(/\[STATE:\s*(\w+)\]/i);
  if (stateMatch) {
    state = stateMatch[1].toUpperCase(); // e.g., "SUGGESTING", "CLARIFYING", etc.
    // Remove state token from explanation for cleaner display
    explanation = explanation.replace(/\[STATE:\s*\w+\]/gi, '').trim();
  }

  // Try to parse RECOMMENDATIONS: line
  if (responseText.includes('RECOMMENDATIONS:')) {
    try {
      const parts = responseText.split('RECOMMENDATIONS:');
      explanation = parts[0].trim();

      // Extract cocktail names and clean up markdown formatting
      const recLine = parts[1].trim();
      recommendations = recLine
        .split(',')
        .map((r) => r.trim())
        // Remove markdown bold (**), asterisks, and extra whitespace
        .map((r) => r.replace(/\*\*/g, '').replace(/\*/g, '').trim())
        .filter((r) => r.length > 0);

      // Remove recommendations line from explanation
      explanation = responseText.replace(/RECOMMENDATIONS:.*$/s, '').trim();

      // Remove state token again in case it's still there
      explanation = explanation.replace(/\[STATE:\s*\w+\]/gi, '').trim();
    } catch (e) {
      console.error('Failed to parse recommendations:', e);
    }
  }

  return {
    explanation,
    recommendations,
    state,
  };
}
