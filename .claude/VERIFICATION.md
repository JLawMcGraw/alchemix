# Claude Verification System

This system allows Claude to verify its own work by seeing the actual output of changes.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `/verify` | Invoke verification skill |
| `node .claude/scripts/screenshot.js <url>` | Take screenshot |
| `node .claude/scripts/screenshot.js <url> --auth` | Screenshot with login |
| `curl http://localhost:3000/api/...` | API verification |

## Setup

1. **Install Playwright** (one-time):
   ```bash
   npm install -D playwright
   npx playwright install chromium
   ```

2. **Create test account** (one-time):
   - Register at http://localhost:3001 with:
     - Email: `verify-test@alchemix.local`
     - Password: `VerifyTest123!`

3. **Add credentials to .env.local**:
   ```
   VERIFY_EMAIL=verify-test@alchemix.local
   VERIFY_PASSWORD=VerifyTest123!
   ```

## How It Works

1. Claude makes a code change
2. Claude (or user) invokes `/verify`
3. Claude takes screenshot or hits API
4. Claude analyzes the result
5. Claude reports findings with evidence

## Screenshot Script Options

```
--auth          Login first (uses VERIFY_EMAIL/VERIFY_PASSWORD)
--output, -o    Custom output path
--wait <ms>     Extra wait after page load (default: 1000ms)
--full          Full page screenshot (not just viewport)
```

## Auto-Verification

Claude should automatically verify after:
- Fixing bugs in React components
- Changing CSS/styling
- Modifying API endpoint responses
- Any change the user asks to "check" or "verify"

## Troubleshooting

**"VERIFY_EMAIL and VERIFY_PASSWORD must be set"**
-> Create `.env.local` with the credentials

**Screenshot shows login page when using --auth**
-> Check credentials are correct, account exists

**"net::ERR_CONNECTION_REFUSED"**
-> Servers aren't running. Run `npm run dev:all`

**Screenshot is blank or loading**
-> Increase --wait time: `--wait 3000`
