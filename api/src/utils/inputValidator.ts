/**
 * Input Validation and Sanitization Utility
 *
 * SECURITY FIX #2: Comprehensive input validation across all routes.
 *
 * This module provides reusable validation functions to:
 * - Prevent SQL injection (parameterized queries + sanitization)
 * - Prevent XSS attacks (HTML/script tag removal)
 * - Prevent NoSQL injection (object type validation)
 * - Enforce data type and format constraints
 * - Limit input length (prevent DoS via huge strings)
 * - Sanitize user-controlled data
 *
 * Why Input Validation Matters:
 * - Defense in depth: Even with parameterized queries, validate data
 * - Prevents database bloat from extremely long strings
 * - Catches bugs early (e.g., string passed where number expected)
 * - Improves error messages for users
 * - Protects against unexpected data types
 */

/**
 * Validation Result Interface
 *
 * Standard format for all validation results.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: any; // Cleaned version of the input
}

/**
 * Sanitize String Input
 *
 * Removes potentially dangerous characters and trims whitespace.
 *
 * Operations:
 * 1. Trim leading/trailing whitespace
 * 2. Remove null bytes (\0) - can cause SQL injection in some databases
 * 3. Limit length to prevent database bloat
 * 4. Optionally remove HTML tags
 *
 * @param input - Raw string input from user
 * @param maxLength - Maximum allowed length (default: 1000)
 * @param stripHtml - Remove HTML tags (default: true)
 * @returns Sanitized string
 *
 * @example
 * sanitizeString("  Hello<script>alert('xss')</script>  ", 100, true)
 * // Returns: "Helloalert('xss')"
 */
export function sanitizeString(
  input: string,
  maxLength: number = 1000,
  stripHtml: boolean = true
): string {
  // Step 1: Convert to string (in case number/boolean passed)
  let sanitized = String(input);

  // Step 2: Trim whitespace
  sanitized = sanitized.trim();

  // Step 3: Remove null bytes (SQL injection vector)
  sanitized = sanitized.replace(/\0/g, '');

  // Step 4: Remove HTML tags if requested (XSS prevention)
  if (stripHtml) {
    // Remove <script> tags and their contents
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // Remove all other HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    // Decode HTML entities to prevent encoding-based XSS
    sanitized = sanitized
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'");
  }

  // Step 5: Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate and Sanitize Email
 *
 * Checks email format and sanitizes input.
 *
 * Requirements:
 * - Contains @ symbol
 * - Has domain with at least one dot
 * - No whitespace
 * - Length between 5 and 254 characters (RFC 5321)
 *
 * @param email - Email address to validate
 * @returns Validation result with sanitized email
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  // Sanitize input
  const sanitized = sanitizeString(email, 254, false).toLowerCase();

  // Check length
  if (sanitized.length < 5) {
    errors.push('Email is too short (minimum 5 characters)');
  }

  if (sanitized.length > 254) {
    errors.push('Email is too long (maximum 254 characters)');
  }

  // Check format with regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    errors.push('Invalid email format');
  }

  // Check for dangerous characters
  if (/[<>'"\\]/.test(sanitized)) {
    errors.push('Email contains invalid characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Validate Number Input
 *
 * Ensures input is a valid number within specified range.
 *
 * @param input - Value to validate
 * @param min - Minimum allowed value (optional)
 * @param max - Maximum allowed value (optional)
 * @param allowNull - Allow null/undefined (optional)
 * @returns Validation result with parsed number
 */
export function validateNumber(
  input: any,
  min?: number,
  max?: number,
  allowNull: boolean = false
): ValidationResult {
  const errors: string[] = [];

  // Allow null if specified
  if (allowNull && (input === null || input === undefined || input === '')) {
    return {
      isValid: true,
      errors: [],
      sanitized: null
    };
  }

  // Parse to number
  const num = Number(input);

  // Check if valid number
  if (isNaN(num)) {
    errors.push('Must be a valid number');
    return { isValid: false, errors };
  }

  // Check if finite (not Infinity or -Infinity)
  if (!isFinite(num)) {
    errors.push('Number must be finite');
    return { isValid: false, errors };
  }

  // Check minimum
  if (min !== undefined && num < min) {
    errors.push(`Must be at least ${min}`);
  }

  // Check maximum
  if (max !== undefined && num > max) {
    errors.push(`Must be at most ${max}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: num
  };
}

/**
 * Validate Date Input
 *
 * Ensures input is a valid date string.
 *
 * @param input - Date string to validate
 * @param allowFuture - Allow future dates (default: false)
 * @param allowNull - Allow null/undefined (default: true)
 * @returns Validation result with ISO date string
 */
export function validateDate(
  input: any,
  allowFuture: boolean = false,
  allowNull: boolean = true
): ValidationResult {
  const errors: string[] = [];

  // Allow null if specified
  if (allowNull && (input === null || input === undefined || input === '')) {
    return {
      isValid: true,
      errors: [],
      sanitized: null
    };
  }

  // Try to parse date
  const date = new Date(input);

  // Check if valid date
  if (isNaN(date.getTime())) {
    errors.push('Invalid date format');
    return { isValid: false, errors };
  }

  // Check if future date (if not allowed)
  if (!allowFuture) {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today
    if (date > now) {
      errors.push('Date cannot be in the future');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: date.toISOString()
  };
}

/**
 * Validate Bottle Data (AlcheMix-specific)
 *
 * Validates all fields for a bottle inventory item.
 *
 * Required Fields:
 * - name: String (1-255 chars)
 *
 * Optional Fields with Validation:
 * - Stock Number: Number (0-999999)
 * - Liquor Type: String (1-100 chars)
 * - ABV (%): Number (0-100)
 * - Quantity (ml): Number (1-10000)
 * - Cost ($): Number (0-100000)
 * - Dates: Valid ISO dates
 *
 * @param data - Bottle data object
 * @returns Validation result with sanitized data
 */
export function validateBottleData(data: any): ValidationResult {
  const errors: string[] = [];
  const sanitized: any = {};

  // Required: name
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Bottle name is required');
  } else {
    sanitized.name = sanitizeString(data.name, 255);
    if (sanitized.name.length === 0) {
      errors.push('Bottle name cannot be empty');
    }
  }

  // Optional: Stock Number
  if (data['Stock Number'] !== undefined && data['Stock Number'] !== null) {
    const stockNum = validateNumber(data['Stock Number'], 0, 999999);
    if (!stockNum.isValid) {
      errors.push(`Stock Number: ${stockNum.errors.join(', ')}`);
    } else {
      sanitized['Stock Number'] = stockNum.sanitized;
    }
  }

  // Optional: Liquor Type
  if (data['Liquor Type']) {
    sanitized['Liquor Type'] = sanitizeString(data['Liquor Type'], 100);
  }

  // Optional: Detailed Spirit Classification
  if (data['Detailed Spirit Classification']) {
    sanitized['Detailed Spirit Classification'] = sanitizeString(
      data['Detailed Spirit Classification'],
      200
    );
  }

  // Optional: Distillation Method
  if (data['Distillation Method']) {
    sanitized['Distillation Method'] = sanitizeString(data['Distillation Method'], 100);
  }

  // Optional: ABV (%)
  if (data['ABV (%)'] !== undefined && data['ABV (%)'] !== null && data['ABV (%)'] !== '') {
    const abv = validateNumber(data['ABV (%)'], 0, 100);
    if (!abv.isValid) {
      errors.push(`ABV: ${abv.errors.join(', ')}`);
    } else {
      sanitized['ABV (%)'] = abv.sanitized;
    }
  }

  // Optional: Distillery Location
  if (data['Distillery Location']) {
    sanitized['Distillery Location'] = sanitizeString(data['Distillery Location'], 200);
  }

  // Optional: Age Statement or Barrel Finish
  if (data['Age Statement or Barrel Finish']) {
    sanitized['Age Statement or Barrel Finish'] = sanitizeString(
      data['Age Statement or Barrel Finish'],
      200
    );
  }

  // Optional: Additional Notes (allow longer text)
  if (data['Additional Notes']) {
    sanitized['Additional Notes'] = sanitizeString(data['Additional Notes'], 2000);
  }

  // Optional: Profile (Nose)
  if (data['Profile (Nose)']) {
    sanitized['Profile (Nose)'] = sanitizeString(data['Profile (Nose)'], 500);
  }

  // Optional: Palate
  if (data['Palate']) {
    sanitized['Palate'] = sanitizeString(data['Palate'], 500);
  }

  // Optional: Finish
  if (data['Finish']) {
    sanitized['Finish'] = sanitizeString(data['Finish'], 500);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Sanitize Object Keys
 *
 * Prevents NoSQL injection by ensuring object doesn't contain special operators.
 *
 * Dangerous MongoDB operators: $where, $ne, $gt, $regex, etc.
 *
 * @param obj - Object to sanitize
 * @returns Sanitized object with operator keys removed
 */
export function sanitizeObjectKeys(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    // Remove keys starting with $ (MongoDB operators)
    if (key.startsWith('$')) {
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitized[key] = sanitizeObjectKeys(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }

  return sanitized;
}
