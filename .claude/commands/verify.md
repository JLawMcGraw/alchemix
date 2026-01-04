---
description: Verify Claude's work by taking screenshots and checking API responses
---

# Verification Skill

Use this skill to verify that changes work correctly in the running application.

## Prerequisites

- Servers must be running (`npm run dev:all`)
- For authenticated pages, `.env.local` must have VERIFY_EMAIL and VERIFY_PASSWORD set

## Instructions

### 1. Determine What to Verify

Ask the user what they want to verify, or infer from recent changes:
- **UI changes**: Take a screenshot of the affected page
- **API changes**: Hit the endpoint with curl
- **Both**: Do both

### 2. For UI Verification

Take a screenshot using the screenshot script:

```bash
# Public pages (login, landing)
node .claude/scripts/screenshot.js http://localhost:3001/<page>

# Authenticated pages (dashboard, bar, recipes, etc.)
node .claude/scripts/screenshot.js http://localhost:3001/<page> --auth

# Full page screenshot
node .claude/scripts/screenshot.js http://localhost:3001/<page> --auth --full
```

After taking the screenshot:
1. Read the screenshot file using the Read tool
2. Analyze the visual output
3. Report what you see and whether it matches expectations

### 3. For API Verification

Hit endpoints directly with curl:

```bash
# Get auth token first (if needed)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"'$VERIFY_EMAIL'","password":"'$VERIFY_PASSWORD'"}' | jq -r '.token')

# Then hit the endpoint
curl -s http://localhost:3000/api/<endpoint> \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 4. Report Findings

Always include:
- What you checked
- What you found (with evidence: screenshot path or API response)
- Whether it matches expectations
- Any issues discovered

## Common Verification Scenarios

| Change Type | Verification Method |
|-------------|---------------------|
| Button styling | Screenshot the page with the button |
| Form behavior | Screenshot before/after, or API test |
| API response | curl the endpoint |
| Modal/popup | Screenshot with modal open (may need interaction) |
| Layout/responsive | Screenshot at different viewports |

## Example Usage

User: "I fixed the button color on the bar page"

Claude:
1. Takes screenshot: `node .claude/scripts/screenshot.js http://localhost:3001/bar --auth`
2. Reads the screenshot
3. Reports: "I've verified the button is now teal (#0D9488). Screenshot saved to .claude/screenshots/verify-1704312345678.png"
