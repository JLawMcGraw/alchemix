// Client-side password policy aligned with backend validator

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

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PasswordRequirementCheck {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumberOrSymbol: boolean;
}

/**
 * Check individual password requirements for real-time feedback
 */
export function checkPasswordRequirements(password: string): PasswordRequirementCheck {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumberOrSymbol: /[0-9!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password),
  };
}

/**
 * Validate password against all requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Minimum 8 characters
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Maximum 128 characters
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Must contain uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Must contain number OR symbol
  if (!/[0-9!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one number or symbol');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
