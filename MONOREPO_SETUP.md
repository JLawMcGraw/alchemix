# AlcheMix Monorepo - Quick Setup

This guide covers setting up and running the AlcheMix monorepo locally.

---

## 📁 Structure

```
alchemix-next/
├── src/              # Frontend (Next.js)
├── api/              # Backend (Express + SQLite)
├── package.json      # Frontend deps + monorepo scripts
└── api/package.json  # Backend deps
```

---

## 🚀 Quick Start

### 1. Install All Dependencies

```bash
npm run install:all
```

### 2. Set Up Backend Environment

```bash
# Copy example env file
cp api/.env.example api/.env

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add the generated secret to api/.env as JWT_SECRET
```

### 3. Run Both Services

```bash
npm run dev:all
```

- Frontend: http://localhost:3001
- Backend: http://localhost:3000

---

## 📜 Useful Scripts

```bash
npm run dev:all      # Run both frontend + backend
npm run dev          # Frontend only
npm run dev:api      # Backend only
npm run type-check   # Type check both
npm run build        # Build both for production
```

---

## 🗄️ Database

- Location: `api/data/alchemix.db`
- Auto-created on first run
- To reset: delete the file and restart API

---

## 🔧 Making Changes

**Frontend**: Edit `src/` → auto-reloads
**Backend**: Edit `api/src/` → auto-reloads

---

## 🐛 Common Issues

**Port 3000 in use?**
```bash
# Kill process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**CORS errors?**
- Check `api/.env` has `FRONTEND_URL=http://localhost:3001`
- Restart backend

**Dependencies missing?**
```bash
npm run install:all
```

---

See `README.md` for full project documentation.
