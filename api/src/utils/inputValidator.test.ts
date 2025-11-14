import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  validateEmail,
  validateNumber,
  validateDate,
  validateBottleData,
  sanitizeObjectKeys,
  type ValidationResult
} from './inputValidator';

describe('inputValidator', () => {
  describe('sanitizeString', () => {
    it('should trim whitespace from strings', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
      expect(sanitizeString('\t\ntest\t\n')).toBe('test');
    });

    it('should remove null bytes', () => {
      expect(sanitizeString('hello\0world')).toBe('helloworld');
    });

    it('should remove HTML script tags and content', () => {
      expect(sanitizeString('<script>alert("xss")</script>hello')).toBe('hello');
      expect(sanitizeString('before<script>bad</script>after')).toBe('beforeafter');
    });

    it('should remove all HTML tags when stripHtml is true', () => {
      expect(sanitizeString('<div>hello</div>')).toBe('hello');
      expect(sanitizeString('<p><strong>text</strong></p>')).toBe('text');
      expect(sanitizeString('<a href="evil">link</a>')).toBe('link');
    });

    it('should preserve HTML when stripHtml is false', () => {
      const html = '<div>hello</div>';
      expect(sanitizeString(html, 1000, false)).toBe(html);
    });

    it('should decode HTML entities', () => {
      expect(sanitizeString('&lt;script&gt;')).toBe('<script>');
      expect(sanitizeString('&amp;')).toBe('&');
      expect(sanitizeString('&quot;test&quot;')).toBe('"test"');
      expect(sanitizeString('&#x27;test&#x27;')).toBe("'test'");
    });

    it('should truncate strings longer than maxLength', () => {
      const longString = 'a'.repeat(2000);
      expect(sanitizeString(longString, 100)).toHaveLength(100);
      expect(sanitizeString(longString, 50)).toHaveLength(50);
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString('   ')).toBe('');
    });

    it('should convert non-string inputs to strings', () => {
      expect(sanitizeString(123 as any)).toBe('123');
      expect(sanitizeString(true as any)).toBe('true');
    });

    it('should handle complex XSS attempts', () => {
      const xssAttempts = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="evil"></iframe>',
      ];

      xssAttempts.forEach(attempt => {
        const sanitized = sanitizeString(attempt);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('<img');
        expect(sanitized).not.toContain('<svg');
        expect(sanitized).not.toContain('<iframe');
      });
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.com',
        'test123@test.org',
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.sanitized).toBe(email.toLowerCase());
      });
    });

    it('should reject emails that are too short', () => {
      const result = validateEmail('a@b');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is too short (minimum 5 characters)');
    });

    it('should reject emails that are too long', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      const result = validateEmail(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is too long (maximum 254 characters)');
    });

    it('should reject emails without @ symbol', () => {
      const result = validateEmail('notanemail.com');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should reject emails without domain', () => {
      const result = validateEmail('user@');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should reject emails without TLD', () => {
      const result = validateEmail('user@domain');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should reject emails with dangerous characters', () => {
      const dangerousEmails = [
        "test<script>@example.com",
        'test"@example.com',
        "test'@example.com",
        'test\\@example.com',
      ];

      dangerousEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Email contains invalid characters');
      });
    });

    it('should convert emails to lowercase', () => {
      const result = validateEmail('Test@Example.COM');
      expect(result.sanitized).toBe('test@example.com');
    });

    it('should trim whitespace from emails', () => {
      const result = validateEmail('  test@example.com  ');
      expect(result.sanitized).toBe('test@example.com');
    });
  });

  describe('validateNumber', () => {
    it('should accept valid numbers', () => {
      const validNumbers = [0, 1, -1, 100, 0.5, -0.5];

      validNumbers.forEach(num => {
        const result = validateNumber(num);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe(num);
      });
    });

    it('should parse string numbers', () => {
      const result = validateNumber('42');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(42);
    });

    it('should reject NaN values', () => {
      const result = validateNumber('not a number');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Must be a valid number');
    });

    it('should reject Infinity', () => {
      const result = validateNumber(Infinity);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Number must be finite');
    });

    it('should reject -Infinity', () => {
      const result = validateNumber(-Infinity);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Number must be finite');
    });

    it('should enforce minimum value', () => {
      const result = validateNumber(5, 10);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Must be at least 10');
    });

    it('should enforce maximum value', () => {
      const result = validateNumber(100, undefined, 50);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Must be at most 50');
    });

    it('should accept numbers within range', () => {
      const result = validateNumber(50, 0, 100);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(50);
    });

    it('should allow null when allowNull is true', () => {
      const result = validateNumber(null, undefined, undefined, true);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeNull();
    });

    it('should allow undefined when allowNull is true', () => {
      const result = validateNumber(undefined, undefined, undefined, true);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeNull();
    });

    it('should allow empty string when allowNull is true', () => {
      const result = validateNumber('', undefined, undefined, true);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeNull();
    });

    it('should reject null when allowNull is false', () => {
      const result = validateNumber(null);
      expect(result.isValid).toBe(false);
    });

    it('should handle decimal numbers', () => {
      const result = validateNumber(3.14159, 0, 10);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(3.14159);
    });

    it('should handle negative numbers', () => {
      const result = validateNumber(-50, -100, 0);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(-50);
    });
  });

  describe('validateDate', () => {
    it('should accept valid date strings', () => {
      const validDates = [
        '2024-01-01',
        '2023-12-31T23:59:59Z',
        new Date().toISOString(),
      ];

      validDates.forEach(date => {
        const result = validateDate(date);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    });

    it('should reject invalid date strings', () => {
      const result = validateDate('not a date');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid date format');
    });

    it('should reject future dates when allowFuture is false', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const result = validateDate(futureDate.toISOString(), false);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Date cannot be in the future');
    });

    it('should accept future dates when allowFuture is true', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const result = validateDate(futureDate.toISOString(), true);
      expect(result.isValid).toBe(true);
    });

    it('should accept today as not a future date', () => {
      const today = new Date().toISOString();
      const result = validateDate(today, false);
      expect(result.isValid).toBe(true);
    });

    it('should allow null when allowNull is true', () => {
      const result = validateDate(null, false, true);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeNull();
    });

    it('should allow empty string when allowNull is true', () => {
      const result = validateDate('', false, true);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBeNull();
    });

    it('should return ISO date string', () => {
      const result = validateDate('2024-01-15');
      expect(result.sanitized).toMatch(/^2024-01-15T/);
    });
  });

  describe('validateBottleData', () => {
    it('should accept valid bottle data with required fields', () => {
      const validBottle = {
        name: 'Test Bottle',
      };

      const result = validateBottleData(validBottle);
      expect(result.isValid).toBe(true);
      expect(result.sanitized.name).toBe('Test Bottle');
    });

    it('should reject bottle without name', () => {
      const result = validateBottleData({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bottle name is required');
    });

    it('should reject bottle with non-string name', () => {
      const result = validateBottleData({ name: 123 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bottle name is required');
    });

    it('should reject bottle with empty name after sanitization', () => {
      const result = validateBottleData({ name: '   ' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bottle name cannot be empty');
    });

    it('should sanitize bottle name', () => {
      const result = validateBottleData({
        name: '  <script>alert("xss")</script>Test Bottle  ',
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized.name).toBe('alert("xss")Test Bottle');
    });

    it('should validate Stock Number within range', () => {
      const result = validateBottleData({
        name: 'Test',
        'Stock Number': 1000000,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Stock Number'))).toBe(true);
    });

    it('should accept valid Stock Number', () => {
      const result = validateBottleData({
        name: 'Test',
        'Stock Number': 12345,
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized['Stock Number']).toBe(12345);
    });

    it('should validate ABV within 0-100 range', () => {
      const result = validateBottleData({
        name: 'Test',
        'ABV (%)': 150,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('ABV'))).toBe(true);
    });

    it('should accept valid ABV', () => {
      const result = validateBottleData({
        name: 'Test',
        'ABV (%)': 40,
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized['ABV (%)']).toBe(40);
    });

    it('should sanitize optional string fields', () => {
      const result = validateBottleData({
        name: 'Test',
        'Liquor Type': '  Whiskey  ',
        'Distillery Location': '<b>Scotland</b>',
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitized['Liquor Type']).toBe('Whiskey');
      expect(result.sanitized['Distillery Location']).toBe('Scotland');
    });

    it('should handle all optional fields', () => {
      const result = validateBottleData({
        name: 'Test Bottle',
        'Stock Number': 123,
        'Liquor Type': 'Whiskey',
        'Detailed Spirit Classification': 'Single Malt',
        'Distillation Method': 'Pot Still',
        'ABV (%)': 43,
        'Distillery Location': 'Scotland',
        'Age Statement or Barrel Finish': '12 Years',
        'Additional Notes': 'Excellent whiskey',
        'Profile (Nose)': 'Fruity, vanilla',
        'Palate': 'Smooth, oaky',
        'Finish': 'Long, warm',
      });

      expect(result.isValid).toBe(true);
      expect(Object.keys(result.sanitized)).toHaveLength(12);
    });

    it('should truncate long text fields to max length', () => {
      const longText = 'a'.repeat(3000);
      const result = validateBottleData({
        name: longText,
        'Additional Notes': longText,
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitized.name.length).toBeLessThanOrEqual(255);
      expect(result.sanitized['Additional Notes'].length).toBeLessThanOrEqual(2000);
    });
  });

  describe('sanitizeObjectKeys', () => {
    it('should remove keys starting with $', () => {
      const malicious = {
        $where: 'malicious code',
        $ne: 'not equal',
        normalKey: 'safe value',
      };

      const sanitized = sanitizeObjectKeys(malicious);
      expect(sanitized).not.toHaveProperty('$where');
      expect(sanitized).not.toHaveProperty('$ne');
      expect(sanitized).toHaveProperty('normalKey');
      expect(sanitized.normalKey).toBe('safe value');
    });

    it('should recursively sanitize nested objects', () => {
      const malicious = {
        user: {
          $where: 'malicious',
          name: 'John',
        },
        safe: 'value',
      };

      const sanitized = sanitizeObjectKeys(malicious);
      expect(sanitized.user).not.toHaveProperty('$where');
      expect(sanitized.user).toHaveProperty('name');
      expect(sanitized.user.name).toBe('John');
    });

    it('should handle arrays', () => {
      const malicious = {
        items: [
          { $where: 'bad', id: 1 },
          { $ne: 'bad', id: 2 },
        ],
      };

      const sanitized = sanitizeObjectKeys(malicious);
      expect(sanitized.items[0]).not.toHaveProperty('$where');
      expect(sanitized.items[0]).toHaveProperty('id');
      expect(sanitized.items[1]).not.toHaveProperty('$ne');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObjectKeys(null)).toBeNull();
      expect(sanitizeObjectKeys(undefined)).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(sanitizeObjectKeys('string')).toBe('string');
      expect(sanitizeObjectKeys(123)).toBe(123);
      expect(sanitizeObjectKeys(true)).toBe(true);
    });

    it('should preserve empty objects', () => {
      const result = sanitizeObjectKeys({});
      expect(result).toEqual({});
    });

    it('should handle deeply nested structures', () => {
      const malicious = {
        level1: {
          level2: {
            level3: {
              $dangerous: 'bad',
              safe: 'good',
            },
          },
        },
      };

      const sanitized = sanitizeObjectKeys(malicious);
      expect(sanitized.level1.level2.level3).not.toHaveProperty('$dangerous');
      expect(sanitized.level1.level2.level3.safe).toBe('good');
    });

    it('should block common NoSQL injection operators', () => {
      const operators = ['$where', '$ne', '$gt', '$lt', '$regex', '$in', '$nin'];
      const malicious: any = {};
      operators.forEach(op => {
        malicious[op] = 'malicious';
      });

      const sanitized = sanitizeObjectKeys(malicious);
      operators.forEach(op => {
        expect(sanitized).not.toHaveProperty(op);
      });
    });
  });
});
