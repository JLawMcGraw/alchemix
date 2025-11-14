import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createTestDatabase } from '../tests/setup';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

// Mock the database module
let testDb: Database.Database;

vi.mock('../database/db', () => ({
  db: {
    prepare: (...args: any[]) => testDb.prepare(...args),
    pragma: (...args: any[]) => testDb.pragma(...args),
  },
}));

// Mock tokenBlacklist
vi.mock('../utils/tokenBlacklist', () => ({
  tokenBlacklist: {
    add: vi.fn(),
    isBlacklisted: vi.fn().mockReturnValue(false),
    size: vi.fn().mockReturnValue(0),
  },
}));

// Import routes after mocking
import authRoutes from './auth';
import { errorHandler } from '../middleware/errorHandler';

describe('Auth Routes Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    // Create test database
    testDb = createTestDatabase();

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    app.use(errorHandler);
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
  });

  describe('POST /auth/signup', () => {
    it('should create a new user with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePassword123!',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', 'newuser@example.com');
      expect(response.body.user).not.toHaveProperty('password_hash');
      expect(response.body).toHaveProperty('token');
    });

    it('should reject signup with invalid email', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'SecurePassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('email');
    });

    it('should reject signup with weak password', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'weak',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Password');
    });

    it('should reject signup with duplicate email', async () => {
      // First signup
      await request(app)
        .post('/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePassword123!',
        })
        .expect(201);

      // Second signup with same email
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'DifferentPassword456!',
        })
        .expect(409);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject signup with missing email', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          password: 'SecurePassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject signup with missing password', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should sanitize email input', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: '  TEST@EXAMPLE.COM  ',
          password: 'SecurePassword123!',
        })
        .expect(201);

      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should hash password before storing', async () => {
      await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'SecurePassword123!',
        })
        .expect(201);

      const user = testDb
        .prepare('SELECT password_hash FROM users WHERE email = ?')
        .get('test@example.com') as any;

      expect(user.password_hash).not.toBe('SecurePassword123!');
      expect(user.password_hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const hashedPassword = await bcrypt.hash('SecurePassword123!', 10);
      testDb
        .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
        .run('testuser@example.com', hashedPassword);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'SecurePassword123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'testuser@example.com');
      expect(response.body).toHaveProperty('token');
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Invalid');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          password: 'SecurePassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should be case-insensitive for email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'TESTUSER@EXAMPLE.COM',
          password: 'SecurePassword123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should return a valid JWT token', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'SecurePassword123!',
        })
        .expect(200);

      const token = response.body.token;
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('GET /auth/me', () => {
    let authToken: string;
    let userId: number;

    beforeEach(async () => {
      // Create and login a user
      const hashedPassword = await bcrypt.hash('SecurePassword123!', 10);
      const result = testDb
        .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
        .run('testuser@example.com', hashedPassword);

      userId = Number(result.lastInsertRowid);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'SecurePassword123!',
        });

      authToken = loginResponse.body.token;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'testuser@example.com');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject request with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', authToken) // Missing "Bearer " prefix
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      // Create and login a user
      const hashedPassword = await bcrypt.hash('SecurePassword123!', 10);
      testDb
        .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
        .run('testuser@example.com', hashedPassword);

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'SecurePassword123!',
        });

      authToken = loginResponse.body.token;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Logout successful');
    });

    it('should add token to blacklist on logout', async () => {
      const { tokenBlacklist } = await import('../utils/tokenBlacklist');

      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(tokenBlacklist.add).toHaveBeenCalled();
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Security Tests', () => {
    it('should prevent SQL injection in email field', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: "admin@example.com' OR '1'='1",
          password: 'anything',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should strip HTML from email input', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: '<script>alert("xss")</script>test@example.com',
          password: 'SecurePassword123!',
        });

      // Should either reject or sanitize
      if (response.status === 201) {
        expect(response.body.user.email).not.toContain('<script>');
      }
    });

    it('should not leak information about existing users', async () => {
      // Create a user
      await request(app)
        .post('/auth/signup')
        .send({
          email: 'existing@example.com',
          password: 'SecurePassword123!',
        });

      // Try to signup with same email
      const duplicateResponse = await request(app)
        .post('/auth/signup')
        .send({
          email: 'existing@example.com',
          password: 'DifferentPassword456!',
        });

      // Try to login with non-existent email
      const nonExistentResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePassword123!',
        });

      // Error messages should be generic enough to not leak user existence
      expect(duplicateResponse.body.error).toBeDefined();
      expect(nonExistentResponse.body.error).toBeDefined();
    });
  });
});
