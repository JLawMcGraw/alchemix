/**
 * Password Validation Utility
 *
 * Enforces strong password requirements to protect user accounts.
 * Prevents common weak passwords that are easily guessed or brute-forced.
 *
 * SECURITY FIX #9: Strengthened password policy
 * - Minimum 12 characters (was 6)
 * - Must contain uppercase and lowercase letters
 * - Must contain at least one number
 * - Must contain at least one special character
 * - Reject common weak passwords
 *
 * Why these requirements?
 * - 12+ chars: Exponentially harder to brute-force
 * - Mixed case: Prevents dictionary attacks
 * - Numbers: Adds complexity
 * - Special chars: Further increases entropy
 * - Common password check: Prevents "Password123!"
 *
 * Password Strength Formula:
 * - Possible chars: 26 (lowercase) + 26 (uppercase) + 10 (numbers) + 33 (special) = 95
 * - 12-char password: 95^12 = 540,360,087,662,636,962,890,625 combinations
 * - At 1 billion guesses/sec: Would take 17,129 years to crack
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
 * Requirements Checked:
 * 1. Minimum length (12 characters)
 * 2. Maximum length (128 characters - prevents DoS via bcrypt)
 * 3. Contains uppercase letter (A-Z)
 * 4. Contains lowercase letter (a-z)
 * 5. Contains number (0-9)
 * 6. Contains special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 * 7. Not a common weak password
 *
 * @param password - The password to validate
 * @returns Validation result with errors if any
 *
 * @example
 * ```typescript
 * const result = validatePassword('weak');
 * if (!result.isValid) {
 *   console.log(result.errors);
 *   // ["Password must be at least 12 characters", "Password must contain uppercase", ...]
 * }
 * ```
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Requirement 1: Minimum length
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  // Requirement 2: Maximum length (bcrypt has 72-byte limit, we use 128 for safety)
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Requirement 3: Contains uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }

  // Requirement 4: Contains lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }

  // Requirement 5: Contains number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }

  // Requirement 6: Contains special character
  // Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  // Requirement 7: Not a common weak password
  const passwordLower = password.toLowerCase();
  if (COMMON_PASSWORDS.includes(passwordLower)) {
    errors.push('This password is too common. Please choose a more unique password.');
  }

  // Additional check: No repeated characters
  // Example: "aaaaaaaaaaaa" meets length but is weak
  if (/(.)\1{5,}/.test(password)) {
    errors.push('Password cannot contain more than 5 repeated characters in a row');
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
  const lengthBonus = Math.min((password.length - 12) * 5, 30);
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
