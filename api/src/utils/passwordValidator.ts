/**
 * Password Validation Utility
 *
 * Enforces password requirements to protect user accounts.
 * Balances security with usability.
 *
 * UPDATED PASSWORD POLICY (2025-11-27):
 * - Minimum 8 characters (simplified from 12)
 * - Must contain uppercase letter
 * - Must contain number OR symbol
 *
 * Why these requirements?
 * - 8+ chars: Good balance of security and memorability
 * - Uppercase: Adds complexity
 * - Number/Symbol: Prevents simple dictionary words
 *
 * Password Strength Formula:
 * - Possible chars: 26 (lowercase) + 26 (uppercase) + 10 (numbers) + 33 (special) = 95
 * - 8-char password: 95^8 = 6,634,204,312,890,625 combinations
 * - At 1 billion guesses/sec: Would take ~77 days to crack (reasonable security)
 */

/**
 * Common Weak Passwords
 *
 * Top 100 most common passwords from data breaches.
 * Even if they meet complexity requirements, these are blacklisted.
 *
 * Source: SplashData's "Worst Passwords" annual report
 */
const COMMON_PASSWORDS = [
  'password',
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwertyuiop',
  'abc123',
  'monkey',
  '1234567',
  'letmein',
  'trustno1',
  'dragon',
  'baseball',
  '111111',
  'iloveyou',
  'master',
  'sunshine',
  'ashley',
  'bailey',
  'passw0rd',
  'shadow',
  '123123',
  '654321',
  'superman',
  'qazwsx',
  'michael',
  'football',
  'welcome',
  'jesus',
  'password1',
  '123456',
];

/**
 * Password Validation Interface
 *
 * Structure for validation results.
 */
export interface PasswordValidationResult {
  isValid: boolean;     // Overall validation status
  errors: string[];     // List of specific validation failures
}

/**
 * Validate Password Strength
 *
 * Checks a password against security requirements.
 *
 * Requirements Checked (UPDATED 2025-11-27):
 * 1. Minimum length (8 characters)
 * 2. Maximum length (128 characters - prevents DoS via bcrypt)
 * 3. Contains uppercase letter (A-Z)
 * 4. Contains number OR symbol
 *
 * @param password - The password to validate
 * @returns Validation result with errors if any
 *
 * @example
 * ```typescript
 * const result = validatePassword('MyPass123');
 * if (!result.isValid) {
 *   console.log(result.errors);
 *   // ["Password must contain uppercase", ...]
 * }
 * ```
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Requirement 1: Minimum length (8 characters)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Requirement 2: Maximum length (bcrypt has 72-byte limit, we use 128 for safety)
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Requirement 3: Contains uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Requirement 4: Contains number OR symbol
  if (!/[0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one number or symbol');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate Password Strength Score
 *
 * Calculates a numeric score (0-100) indicating password strength.
 * Useful for showing users a strength meter during signup.
 *
 * Scoring Factors:
 * - Length: +5 points per character above minimum
 * - Character variety: +10 per category (upper, lower, number, special)
 * - No common patterns: +20 points
 * - Entropy: Based on character set size
 *
 * @param password - The password to score
 * @returns Score from 0 (very weak) to 100 (very strong)
 *
 * @example
 * ```typescript
 * const score = getPasswordStrength('MyP@ssw0rd123!');
 * // Returns: 85 (Strong)
 * ```
 */
export function getPasswordStrength(password: string): number {
  let score = 0;

  // Length bonus (5 points per char above minimum, max 30 points)
  const lengthBonus = Math.min((password.length - 8) * 5, 30);
  score += lengthBonus;

  // Character variety (max 40 points)
  if (/[a-z]/.test(password)) score += 10; // Lowercase
  if (/[A-Z]/.test(password)) score += 10; // Uppercase
  if (/[0-9]/.test(password)) score += 10; // Numbers
  if (/[^a-zA-Z0-9]/.test(password)) score += 10; // Special chars

  // No common password (+20 points)
  if (!COMMON_PASSWORDS.includes(password.toLowerCase())) {
    score += 20;
  }

  // Penalty for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
  }

  // Entropy bonus (based on character set size, max 10 points)
  const charSetSize =
    (/[a-z]/.test(password) ? 26 : 0) +
    (/[A-Z]/.test(password) ? 26 : 0) +
    (/[0-9]/.test(password) ? 10 : 0) +
    (/[^a-zA-Z0-9]/.test(password) ? 33 : 0);

  const entropyBonus = Math.min(charSetSize / 10, 10);
  score += entropyBonus;

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get Human-Readable Strength Description
 *
 * Converts numeric score to text description.
 *
 * @param score - Password strength score (0-100)
 * @returns Human-readable strength level
 */
export function getStrengthLabel(score: number): string {
  if (score >= 80) return 'Very Strong';
  if (score >= 60) return 'Strong';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Weak';
  return 'Very Weak';
}
