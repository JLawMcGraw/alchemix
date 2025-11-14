import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  getPasswordStrength,
  getStrengthLabel,
  type PasswordValidationResult
} from './passwordValidator';

describe('passwordValidator', () => {
  describe('validatePassword', () => {
    it('should accept strong passwords that meet all requirements', () => {
      const validPasswords = [
        'MySecure!Pass123',
        'C0mpl3x&Password!',
        'Test@1234567890!',
        'Aa1!bbbbbbbb',  // Minimum requirements met
      ];

      validPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject passwords shorter than 12 characters', () => {
      const result = validatePassword('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long');
    });

    it('should reject passwords longer than 128 characters', () => {
      const longPassword = 'A'.repeat(129) + 'a1!';
      const result = validatePassword(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be less than 128 characters');
    });

    it('should reject passwords without uppercase letters', () => {
      const result = validatePassword('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter (A-Z)');
    });

    it('should reject passwords without lowercase letters', () => {
      const result = validatePassword('UPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter (a-z)');
    });

    it('should reject passwords without numbers', () => {
      const result = validatePassword('NoNumbersHere!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number (0-9)');
    });

    it('should reject passwords without special characters', () => {
      const result = validatePassword('NoSpecialChars123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    });

    it('should reject common weak passwords regardless of complexity', () => {
      const commonPasswords = [
        'password',
        'Password123!', // Contains "password" in lowercase
        '12345678',
        'qwerty',
      ];

      commonPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
      });
    });

    it('should reject passwords with more than 5 repeated characters', () => {
      const result = validatePassword('Aaaaaaaaa1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password cannot contain more than 5 repeated characters in a row');
    });

    it('should accept passwords with up to 5 repeated characters', () => {
      const result = validatePassword('Aaaaa12345!');
      expect(result.isValid).toBe(true);
    });

    it('should return multiple errors for very weak passwords', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });

    it('should handle edge case of exactly 12 characters', () => {
      const result = validatePassword('Exactly12!ab');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle edge case of exactly 128 characters', () => {
      const password = 'A'.repeat(120) + 'a1234!#';
      expect(password.length).toBe(128);
      const result = validatePassword(password);
      expect(result.isValid).toBe(true);
    });

    it('should detect common password variations (case-insensitive)', () => {
      const result = validatePassword('PASSWORD123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('This password is too common. Please choose a more unique password.');
    });

    it('should accept all special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      for (const char of specialChars) {
        const password = `SecurePass123${char}`;
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe('getPasswordStrength', () => {
    it('should return 0-100 score range', () => {
      const passwords = [
        'weak',
        'WeakPassword1!',
        'StrongPassword123!',
        'VeryStrongP@ssw0rd123!WithExtra',
      ];

      passwords.forEach(password => {
        const score = getPasswordStrength(password);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    it('should give higher scores to longer passwords', () => {
      const short = getPasswordStrength('Short1!@Abc');
      const long = getPasswordStrength('VeryLongPassword123!@#');
      expect(long).toBeGreaterThan(short);
    });

    it('should give higher scores to passwords with more character variety', () => {
      const simple = getPasswordStrength('aaaaaaaaaaa1!A');
      const varied = getPasswordStrength('MyC0mpl3x!Pass');
      expect(varied).toBeGreaterThan(simple);
    });

    it('should penalize common passwords', () => {
      const unique = getPasswordStrength('UniquePass123!');
      const common = getPasswordStrength('Password123!'); // Contains "password"
      expect(unique).toBeGreaterThan(common);
    });

    it('should penalize repeated characters', () => {
      const normal = getPasswordStrength('MyPassword123!');
      const repeated = getPasswordStrength('Myyyyy12345!');
      expect(normal).toBeGreaterThan(repeated);
    });

    it('should award points for all character types', () => {
      const onlyLower = getPasswordStrength('abcdefghijklm');
      const withUpper = getPasswordStrength('Abcdefghijklm');
      const withNumber = getPasswordStrength('Abcdefghijk12');
      const withSpecial = getPasswordStrength('Abcdefghij1!@');

      expect(withUpper).toBeGreaterThan(onlyLower);
      expect(withNumber).toBeGreaterThan(withUpper);
      expect(withSpecial).toBeGreaterThan(withNumber);
    });

    it('should cap score at 100', () => {
      const superStrong = 'A'.repeat(100) + 'a1!@#$%^&*()';
      const score = getPasswordStrength(superStrong);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should give minimum score of 0', () => {
      const veryWeak = '';
      const score = getPasswordStrength(veryWeak);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStrengthLabel', () => {
    it('should return "Very Weak" for scores below 20', () => {
      expect(getStrengthLabel(0)).toBe('Very Weak');
      expect(getStrengthLabel(10)).toBe('Very Weak');
      expect(getStrengthLabel(19)).toBe('Very Weak');
    });

    it('should return "Weak" for scores 20-39', () => {
      expect(getStrengthLabel(20)).toBe('Weak');
      expect(getStrengthLabel(30)).toBe('Weak');
      expect(getStrengthLabel(39)).toBe('Weak');
    });

    it('should return "Moderate" for scores 40-59', () => {
      expect(getStrengthLabel(40)).toBe('Moderate');
      expect(getStrengthLabel(50)).toBe('Moderate');
      expect(getStrengthLabel(59)).toBe('Moderate');
    });

    it('should return "Strong" for scores 60-79', () => {
      expect(getStrengthLabel(60)).toBe('Strong');
      expect(getStrengthLabel(70)).toBe('Strong');
      expect(getStrengthLabel(79)).toBe('Strong');
    });

    it('should return "Very Strong" for scores 80-100', () => {
      expect(getStrengthLabel(80)).toBe('Very Strong');
      expect(getStrengthLabel(90)).toBe('Very Strong');
      expect(getStrengthLabel(100)).toBe('Very Strong');
    });
  });

  describe('integration tests', () => {
    it('should properly validate and score a real-world secure password', () => {
      const password = 'MySecureP@ssw0rd2024!';

      const validation = validatePassword(password);
      expect(validation.isValid).toBe(true);

      const strength = getPasswordStrength(password);
      expect(strength).toBeGreaterThan(60);

      const label = getStrengthLabel(strength);
      expect(['Strong', 'Very Strong']).toContain(label);
    });

    it('should properly validate and score a weak password', () => {
      const password = 'weak123';

      const validation = validatePassword(password);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      const strength = getPasswordStrength(password);
      expect(strength).toBeLessThan(40);

      const label = getStrengthLabel(strength);
      expect(['Very Weak', 'Weak']).toContain(label);
    });
  });
});
