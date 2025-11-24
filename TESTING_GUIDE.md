# MemMachine v1 Migration - Testing Guide

**Version:** v1.18.0
**Date:** November 23, 2025

---

## 🚀 Quick Start Testing (5 Minutes)

### Step 1: Start Both Services

```bash
# Terminal 1: Navigate to project root
cd "C:\Users\Admin\OneDrive\Desktop\DEV Work\alchemix"

# Start both frontend and backend
npm run dev:all
```

**Expected Output:**
```
🔧 MemMachine Service initialized (v1 API) with URL: http://localhost:8080
[Backend] Server listening on port 3000
[Frontend] Ready on http://localhost:3001
```

**✅ Success Indicator:** No errors, both servers running

---

### Step 2: Verify MemMachine Connection

In the backend terminal logs, you should see:
```
🔧 MemMachine Service initialized (v1 API) with URL: http://localhost:8080
```

**Quick Health Check:**
```bash
# Terminal 2: Test MemMachine is responding
curl http://localhost:8080/health
```

**Expected Response:**
```json
{"status":"healthy","service":"memmachine","version":"1.0.0","memory_managers":{"profile_memory":true,"episodic_memory":true}}
```

**✅ Success Indicator:** MemMachine returns healthy status

---

### Step 3: Test Semantic Search Directly

```bash
# Search for rum cocktails with lime (should return Zombies)
curl -X POST http://localhost:8080/v1/memories/search \
  -H "Content-Type: application/json" \
  -H "user-id: user_1" \
  -H "session-id: recipes" \
  -H "group-id: alchemix" \
  -H "agent-id: alchemix-bartender" \
  -d "{\"query\":\"rum cocktails with lime\",\"limit\":3}"
```

**Expected Response:** JSON with 3 recipe results (Zombie variations)

**✅ Success Indicator:** Response contains recipes with "rum" and "lime" in ingredients

---

### Step 4: Test AI Bartender (The Big Test!)

1. **Open Browser:** Navigate to http://localhost:3001
2. **Login:** Use `test@example.com` (the user with 241 recipes)
3. **Go to AI Bartender:** Click "AI Bartender" in navigation
4. **Ask a Question:** Type: *"I want rum cocktails with lime"*

**What to Watch For:**

**In Backend Terminal Logs:**
```
🧠 MemMachine: Querying enhanced context for user 1 with query: "I want rum cocktails with lime"
🔍 MemMachine: Found 10 episodic + 0 profile results for user 1
📝 MemMachine: Added 15 lines of context to prompt
```

**In AI Response:**
- Should suggest Zombie variations or other rum+lime cocktails
- Should reference specific recipes from your collection
- Should NOT suggest drinks without lime (e.g., Mai Tai, Daiquiri with just lime would be ok but not pure rum drinks)

**✅ Success Indicator:**
- MemMachine logs show "Found X episodic results"
- AI recommends recipes that actually have rum AND lime
- AI says things like "from your collection" or "you have"

---

## 🔬 Detailed Testing Scenarios

### Test 1: Semantic Search Accuracy

**Goal:** Verify MemMachine returns relevant recipes

**Test Cases:**

| Query | Expected Results | What to Check |
|-------|------------------|---------------|
| "rum cocktails with lime" | Zombies, Daiquiris | All have rum + lime |
| "tiki drinks with pineapple" | Piña Colada, Mai Tai variants | All have pineapple |
| "whiskey sour drinks" | Bourbon-based sours | No rum drinks returned |
| "coconut cream drinks" | Piña Colada, Chi Chi | All have coconut cream |

**How to Test:**
```bash
# Template
curl -X POST http://localhost:8080/v1/memories/search \
  -H "Content-Type: application/json" \
  -H "user-id: user_1" \
  -H "session-id: recipes" \
  -H "group-id: alchemix" \
  -H "agent-id: alchemix-bartender" \
  -d "{\"query\":\"YOUR_QUERY_HERE\",\"limit\":5}"
```

**✅ Success:** All returned recipes match the query semantically

---

### Test 2: User Isolation

**Goal:** Verify user_1 cannot see user_2's data

**Setup:**
```bash
# Search user_1's recipes
curl -X POST http://localhost:8080/v1/memories/search \
  -H "user-id: user_1" \
  -H "session-id: recipes" \
  -H "group-id: alchemix" \
  -H "agent-id: alchemix-bartender" \
  -d "{\"query\":\"rum\",\"limit\":5}"

# Search user_2's recipes (should have 0)
curl -X POST http://localhost:8080/v1/memories/search \
  -H "user-id: user_2" \
  -H "session-id: recipes" \
  -H "group-id: alchemix" \
  -H "agent-id: alchemix-bartender" \
  -d "{\"query\":\"rum\",\"limit\":5}"
```

**Expected:**
- user_1: Returns 5 recipes
- user_2: Returns 0 results (empty episodic_memory array)

**✅ Success:** user_2 sees no recipes from user_1

---

### Test 3: Conversation Memory Persistence

**Goal:** Verify AI remembers conversation across messages

**Steps:**

1. **Open AI Bartender** (http://localhost:3001/ai)
2. **Message 1:** "I love tiki drinks with rum"
   - **Expected:** AI acknowledges preference
   - **Check Logs:** Should see "💬 MemMachine: Stored conversation turn for user 1 in session chat-2025-11-23"

3. **Message 2:** "What should I make tonight?"
   - **Expected:** AI references your tiki preference from Message 1
   - **Check Logs:** Should see MemMachine search for context

4. **Logout and Login Again**
5. **Message 3:** "Got any suggestions?"
   - **Expected:** AI might reference previous tiki conversation (if still in same day)

**✅ Success:** AI references earlier conversation context

---

### Test 4: Cost Reduction Verification

**Goal:** Verify prompt caching is working

**Steps:**

1. **Send First AI Message:** "Tell me about Mai Tais"

   **Watch Backend Logs For:**
   ```
   ✍️  Cache write: 12000 tokens ($0.0036)
   📝 Regular input: 67 tokens ($0.000008)
   💰 Total cost: $0.003608
   ```

2. **Send Second AI Message:** "What else uses rum?"

   **Watch Backend Logs For:**
   ```
   ✅ Cache read: 12000 tokens ($0.00036) - 90% discount!
   📝 Regular input: 45 tokens ($0.000005)
   💰 Total cost: $0.000365
   🎉 Savings: 89.9% vs no cache ($0.003245 saved)
   ```

**✅ Success:**
- First message: Cache write
- Second message: Cache read (90% discount)
- Savings ~90% on cached portion

---

### Test 5: Recipe Addition Workflow

**Goal:** Verify new recipes get stored in MemMachine

**Steps:**

1. **Go to Recipes Page** (http://localhost:3001/recipes)
2. **Add a New Recipe:**
   - Name: "Test Margarita"
   - Category: "Cocktail"
   - Ingredients: "2 oz tequila, 1 oz lime juice, 1 oz triple sec"
   - Glass: "Margarita glass"

3. **Check Backend Logs:**
   ```
   ✅ MemMachine: Stored recipe "Test Margarita" for user 1
   ```

4. **Wait 5 Seconds** (for embedding to process)

5. **Test Search:**
   ```bash
   curl -X POST http://localhost:8080/v1/memories/search \
     -H "user-id: user_1" \
     -H "session-id: recipes" \
     -H "group-id: alchemix" \
     -H "agent-id: alchemix-bartender" \
     -d "{\"query\":\"tequila lime drinks\",\"limit\":5}"
   ```

6. **Expected:** "Test Margarita" appears in results

**✅ Success:** New recipe immediately searchable via MemMachine

---

### Test 6: Error Handling (MemMachine Down)

**Goal:** Verify graceful degradation if MemMachine unavailable

**Steps:**

1. **Stop MemMachine:**
   ```bash
   # Stop Docker container
   docker stop <memmachine-container-id>
   ```

2. **Try AI Bartender:** Ask any question

3. **Check Backend Logs:**
   ```
   ❌ MemMachine unavailable, continuing without memory enhancement: Error: ...
   ```

4. **Expected Behavior:**
   - AI still responds (uses full recipe list from database)
   - No app crash
   - User sees no errors
   - Response might be slower (larger prompt, no semantic search)

5. **Restart MemMachine:**
   ```bash
   docker start <memmachine-container-id>
   ```

**✅ Success:** App continues working without MemMachine

---

## 🐛 Common Issues & Solutions

### Issue 1: "MemMachine unavailable" errors

**Symptoms:**
```
❌ MemMachine: User profile query failed for user 1: Request failed with status code 404
```

**Solution:**
```bash
# Check MemMachine is running
curl http://localhost:8080/health

# If not running, start Docker Desktop and launch container
docker ps
docker start <container-id>
```

---

### Issue 2: "No episodic results found"

**Symptoms:**
```
🔍 MemMachine: Found 0 episodic + 0 profile results for user 1
```

**Possible Causes:**
1. Seed script not run
2. Wrong user ID
3. Wrong session ID

**Solution:**
```bash
# Re-run seed script
cd api
npx tsx src/scripts/seed-memmachine.ts

# Verify recipes were stored
curl -X POST http://localhost:8080/v1/memories/search \
  -H "user-id: user_1" \
  -H "session-id: recipes" \
  -H "group-id: alchemix" \
  -H "agent-id: alchemix-bartender" \
  -d "{\"query\":\"rum\",\"limit\":1}"
```

---

### Issue 3: AI not using semantic search

**Symptoms:**
- No MemMachine logs appear
- AI suggests recipes not in your collection

**Check:**
1. **Backend logs** - Should show "🧠 MemMachine: Querying enhanced context"
2. **User message** - Must not be empty
3. **MemMachine health** - Must be running

**Solution:**
```bash
# Check MemMachine URL in environment
cd api
cat .env | grep MEMMACHINE

# Should show: MEMMACHINE_API_URL=http://localhost:8080

# Test connection
curl http://localhost:8080/health
```

---

### Issue 4: TypeScript errors on startup

**Symptoms:**
```
Error: Cannot find module './types/memmachine'
```

**Solution:**
```bash
# Rebuild TypeScript
cd api
npm run type-check

# If errors, check file exists
ls src/types/memmachine.ts

# Restart dev server
cd ..
npm run dev:all
```

---

## 📊 Success Metrics

After testing, you should see:

### ✅ Semantic Search Metrics
- **Query Relevance:** >90% of results match query intent
- **Response Time:** <1 second for searches
- **User Isolation:** 100% (no cross-user data)

### ✅ Cost Metrics
- **First Message:** Cache write (~$0.0036)
- **Subsequent Messages:** Cache read (~$0.00036)
- **Savings:** ~90% on cached portions

### ✅ AI Quality Metrics
- **Recipe Suggestions:** From user's collection
- **Ingredient Accuracy:** Matches query exactly
- **Conversation Memory:** References past messages

---

## 🎯 Quick Validation Checklist

Use this checklist to verify migration success:

- [ ] Both servers start without errors
- [ ] MemMachine health check returns `{"status":"healthy"}`
- [ ] Seed script shows "✅ Successfully stored 241 recipes"
- [ ] Semantic search returns relevant results
- [ ] AI Bartender logs show "🔍 MemMachine: Found X episodic results"
- [ ] AI suggests recipes with correct ingredients
- [ ] Cache read shows 90% discount on second message
- [ ] New recipe additions appear in search within 5 seconds
- [ ] User isolation verified (user_2 sees no user_1 recipes)
- [ ] App works even when MemMachine stopped (graceful degradation)

**If all boxes checked:** ✅ **Migration successful!**

---

## 🎬 Recommended Testing Order

**5-Minute Quick Test:**
1. Start services
2. Verify MemMachine health
3. Ask AI one question
4. Check logs for MemMachine usage

**15-Minute Full Test:**
1. Run Quick Test
2. Test semantic search directly (curl)
3. Test 2-3 different queries in AI Bartender
4. Add a new recipe and verify it's searchable

**30-Minute Comprehensive Test:**
1. Run Full Test
2. Test user isolation
3. Test conversation memory
4. Test cost reduction (cache metrics)
5. Test error handling (MemMachine down)

---

## 📝 What to Look For (TL;DR)

**Good Signs:**
- ✅ Logs show "🔍 MemMachine: Found 10 episodic results"
- ✅ AI suggests recipes from your collection
- ✅ Cache reads show 90% discount
- ✅ Semantic search returns relevant results

**Bad Signs:**
- ❌ "MemMachine unavailable" errors (MemMachine not running)
- ❌ "Found 0 episodic results" (seed script not run)
- ❌ AI suggests random recipes not in collection (not using MemMachine)
- ❌ No cache savings (prompt caching broken)

---

## 🚀 Start Here!

**The Easiest Test (1 Minute):**

```bash
# 1. Start servers
cd "C:\Users\Admin\OneDrive\Desktop\DEV Work\alchemix"
npm run dev:all

# 2. Wait for both servers to start (watch for "Ready on http://localhost:3001")

# 3. Open browser: http://localhost:3001/ai

# 4. Login as test@example.com

# 5. Ask: "I want rum cocktails with lime"

# 6. Watch backend terminal for:
#    "🔍 MemMachine: Found 10 episodic + 0 profile results"
```

**If you see that log message, the migration is working!** 🎉

---

**Ready to test? Start with the 1-minute quick test above!**
