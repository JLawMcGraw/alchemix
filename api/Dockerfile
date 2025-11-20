# Multi-stage Dockerfile for AlcheMix API
# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]

# Stage 3: Test stage
FROM node:20-alpine AS test

WORKDIR /app

# Install dependencies for testing
COPY package*.json ./
RUN npm ci

# Copy all source code and test files
COPY . .

# Run tests
CMD ["npm", "test"]
