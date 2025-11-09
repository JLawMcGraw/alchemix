import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/db';
import { corsOptions } from './utils/corsConfig';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import inventoryRoutes from './routes/inventory';
import recipesRoutes from './routes/recipes';
import favoritesRoutes from './routes/favorites';
import messagesRoutes from './routes/messages';

// Load environment variables
dotenv.config({ path: '.env' });

// Initialize Express app
const app: Express = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Rate limiting (100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});

app.use('/api/', limiter);

// CORS
app.use(cors(corsOptions));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/messages', messagesRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Initialize database
try {
  initializeDatabase();
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// Start server
app.listen(PORT, () => {
  console.log('┌─────────────────────────────────────────┐');
  console.log('│   🧪 AlcheMix API Server Running 🧪    │');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│   Port:     ${PORT}                        │`);
  console.log(`│   Env:      ${process.env.NODE_ENV || 'development'}              │`);
  console.log(`│   Time:     ${new Date().toLocaleTimeString()}                │`);
  console.log('└─────────────────────────────────────────┘');
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  POST /auth/signup');
  console.log('  POST /auth/login');
  console.log('  GET  /auth/me');
  console.log('  POST /auth/logout');
  console.log('  GET  /api/inventory');
  console.log('  POST /api/inventory');
  console.log('  PUT  /api/inventory/:id');
  console.log('  DELETE /api/inventory/:id');
  console.log('  GET  /api/recipes');
  console.log('  POST /api/recipes');
  console.log('  GET  /api/favorites');
  console.log('  POST /api/favorites');
  console.log('  DELETE /api/favorites/:id');
  console.log('  POST /api/messages');
  console.log('');
});

export default app;
