import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../database/db';
import { generateToken, authMiddleware } from '../middleware/auth';
import { User } from '../types';

const router = Router();

// POST /auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const result = db.prepare(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)'
    ).run(email, password_hash);

    const userId = result.lastInsertRowid as number;

    // Get created user
    const user = db.prepare(
      'SELECT id, email, created_at FROM users WHERE id = ?'
    ).get(userId) as User;

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account'
    });
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = db.prepare(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = ?'
    ).get(email) as User | undefined;

    if (!user || !user.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email
    });

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        token,
        user: userWithoutPassword
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login'
    });
  }
});

// GET /auth/me (protected)
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Get user
    const user = db.prepare(
      'SELECT id, email, created_at FROM users WHERE id = ?'
    ).get(userId) as User | undefined;

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user'
    });
  }
});

// POST /auth/logout
router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  // With JWT, logout is handled client-side by removing the token
  // This endpoint exists for consistency with the API contract
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
