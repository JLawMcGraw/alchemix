# Testing Prompt Caching - Quick Guide

This guide will help you verify that the AI cost optimization with prompt caching is working correctly.

## Prerequisites

1. **Valid Anthropic API Key** in `api/.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...your-actual-key...
   ```

2. **Backend Running**:
   ```bash
   cd api
   npm run dev
   ```

3. **Frontend Running** (separate terminal):
   ```bash
   npm run dev
   ```

---

## Test 1: AI Bartender Chat (Cache Verification)

### Steps:

1. Navigate to http://localhost:3001
2. Login to your account
3. Go to **AI Bartender** page
4. Send your **first message**: "What cocktails can I make with bourbon?"

### Expected Backend Console Output (First Message):

```
💰 AI Cost Metrics [User X]:
   📝 Regular Input: 120 tokens
   ✍️  Cache Write: 38,450 tokens (full cost)
   ✅ Cache Read: 0 tokens
   📤 Output: 485 tokens
   🆕 Cache Created - Next request will be 90% cheaper!
```

**What This Means:**
- ✅ Your inventory/recipes were written to cache (38,450 tokens)
- ✅ This is a one-time "cache write" cost
- ✅ Next message within 5 minutes will use cache

---

5. **Wait 2-3 seconds**, then send a **second message**: "What about rum drinks?"

### Expected Backend Console Output (Second Message):

```
💰 AI Cost Metrics [User X]:
   📝 Regular Input: 95 tokens
   ✍️  Cache Write: 0 tokens
   ✅ Cache Read: 38,450 tokens (90% discount!)
   📤 Output: 512 tokens
   🎉 Cache Hit! Saved ~99.8% of input costs
```

**What This Means:**
- ✅ Cache HIT! Your inventory/recipes were read from cache (90% discount)
- ✅ Only dynamic content (95 tokens) was processed at full cost
- ✅ You saved ~99.8% on input token costs!

---

## Test 2: Dashboard Insights (Cache Verification)

### Steps:

1. Navigate to **Dashboard** page
2. Refresh the page (F5)

### Expected Backend Console Output:

```
💰 Dashboard Insight Cost [User X]:
   📝 Regular: 35 | ✍️  Write: 42,120 | ✅ Read: 0
```

**First Load:** Cache write for dashboard context

3. **Wait 2-3 seconds**, refresh again (F5)

```
💰 Dashboard Insight Cost [User X]:
   📝 Regular: 35 | ✍️  Write: 0 | ✅ Read: 42,120
   🎉 Cache Hit! Dashboard load is 90% cheaper
```

**Second Load:** Cache hit! 90% discount applied

---

## Test 3: Cache Expiry (5-Minute TTL)

### Steps:

1. Send a message to AI Bartender
2. **Wait 6 minutes** (cache expires after 5 minutes of inactivity)
3. Send another message

### Expected Behavior:

**First message after expiry:**
```
💰 AI Cost Metrics [User X]:
   ✍️  Cache Write: 38,450 tokens (full cost)
   🆕 Cache Created - Next request will be 90% cheaper!
```

Cache expired, so it's written again. This is expected and still 10x cheaper than old Sonnet!

---

## Cost Comparison Examples

### Example Session (5 messages, 50k token context):

**Old Sonnet (No Cache):**
```
Turn 1: $0.15
Turn 2: $0.15
Turn 3: $0.15
Turn 4: $0.15
Turn 5: $0.15
Total: $0.75
```

**New Haiku + Cache:**
```
Turn 1 (Cache Write): $0.015
Turn 2 (Cache Read):  $0.0015
Turn 3 (Cache Read):  $0.0015
Turn 4 (Cache Read):  $0.0015
Turn 5 (Cache Read):  $0.0015
Total: $0.021
```

**Savings: 97.2%** 🎉

---

## Troubleshooting

### Issue: No cache logs appearing

**Check:**
1. Backend console is running (`cd api && npm run dev`)
2. You're logged in and have inventory/recipes
3. ANTHROPIC_API_KEY is valid in `api/.env`

### Issue: Always seeing cache writes, never reads

**Possible Causes:**
1. You're waiting >5 minutes between messages (cache expired)
2. You added/removed bottles between messages (cache invalidated)
3. Different users (each user has separate cache)

### Issue: API errors

**Check:**
1. Anthropic API key is valid (not placeholder "your-api-key-here")
2. API key has sufficient credits
3. Network connection is stable

---

## Success Criteria

✅ **First message shows cache write** (✍️  Cache Write: XXXXX tokens)
✅ **Second message shows cache read** (✅ Cache Read: XXXXX tokens)
✅ **Savings percentage displayed** (🎉 Cache Hit! Saved ~XX.X%)
✅ **AI responses are high quality** (specific, accurate recommendations)
✅ **Response time is fast** (<3 seconds per message)

---

## Monitoring in Production

After deploying to production, monitor:

1. **Anthropic Dashboard** (https://console.anthropic.com)
   - Check daily spend
   - Compare to previous week
   - Should see ~97% reduction

2. **Backend Logs** (production server)
   - Cache hit rate should be >80%
   - Average savings per session ~97%

3. **User Feedback**
   - AI quality should be identical
   - No complaints about response quality
   - Faster response times (Haiku is quicker)

---

## Quick Validation Script

You can also test the API directly with curl:

```bash
# Get your JWT token from browser localStorage (key: alchemix-storage)
TOKEN="your-jwt-token-here"

# Send test message
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"What bourbon cocktails can I make?"}'

# Check backend console for cost logs
```

---

## Next Steps After Testing

Once you've confirmed caching works:

1. ✅ Verify savings in Anthropic dashboard after 24 hours
2. ✅ Monitor cache hit rate (target: >80%)
3. ✅ Deploy to production with confidence
4. ✅ Celebrate 97% cost reduction! 🎉

---

**Questions or Issues?**

Check the implementation details in:
- `AI_COST_OPTIMIZATION_IMPLEMENTATION.md`
- `AI_COST_OPTIMIZATION.md` (original plan)
- `api/src/routes/messages.ts` (implementation code)
