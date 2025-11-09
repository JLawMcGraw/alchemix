import { CorsOptions } from 'cors';

const allowedOrigins = [
  'http://localhost:3001',  // Local Next.js dev
  'http://localhost:3000',  // Alternative local port
  process.env.FRONTEND_URL,  // Production frontend URL
].filter(Boolean) as string[];

export const corsOptions: CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postmark)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
