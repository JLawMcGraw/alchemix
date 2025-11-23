# Fix OneDrive EINVAL Error - Next.js Build Folder Conflict

## The Problem

OneDrive's file-on-demand feature doesn't work well with Next.js's `.next` build folder, which contains symlinks. This causes the error:

```
[Error: EINVAL: invalid argument, readlink 'C:\...\alchemix\.next\static\media\...woff2']
```

---

## Solution 1: Exclude .next from OneDrive (RECOMMENDED)

### Option A: Using File Explorer (Easiest)

1. **Stop the dev servers** (Ctrl+C in both terminals)

2. **Delete the .next folder**:
   ```bash
   rm -rf .next
   ```

3. **Open File Explorer** and navigate to:
   ```
   C:\Users\Admin\OneDrive\Desktop\DEV Work\alchemix
   ```

4. **Create the .next folder** (if it doesn't exist):
   - Right-click → New → Folder
   - Name it `.next`

5. **Exclude from OneDrive**:
   - Right-click the `.next` folder
   - Select "Always keep on this device" (if available)
   - OR: Properties → Advanced → Check "File is ready for archiving" → OK

6. **Set folder attribute** (prevents OneDrive sync):
   - Open PowerShell in the project folder
   - Run:
     ```powershell
     attrib +U .next /S /D
     ```

7. **Restart dev servers**:
   ```bash
   npm run dev:all
   ```

### Option B: Using PowerShell Script (Automated)

1. **Open PowerShell as Administrator**
   - Press Win+X, select "Windows PowerShell (Admin)"

2. **Navigate to project**:
   ```powershell
   cd "C:\Users\Admin\OneDrive\Desktop\DEV Work\alchemix"
   ```

3. **Run the fix script**:
   ```powershell
   .\fix-onedrive-sync.ps1
   ```

4. **Restart dev servers**:
   ```bash
   npm run dev:all
   ```

---

## Solution 2: Move Project Outside OneDrive (PERMANENT FIX)

This is the **best long-term solution** for development projects:

### Steps:

1. **Stop the dev servers** (Ctrl+C)

2. **Move the entire project** outside OneDrive:
   ```bash
   # From current location
   cd C:\Users\Admin\OneDrive\Desktop\DEV Work

   # Move to local directory (not synced)
   Move-Item alchemix C:\Dev\alchemix
   ```

3. **Navigate to new location**:
   ```bash
   cd C:\Dev\alchemix
   ```

4. **Start servers** (should work without errors):
   ```bash
   npm run dev:all
   ```

### Why This Works Better:

✅ **No sync conflicts** - Development files don't need cloud sync
✅ **Faster builds** - No OneDrive overhead
✅ **No symlink issues** - Windows handles symlinks normally outside OneDrive
✅ **Better performance** - No background sync during development

### Recommended Project Locations:

- `C:\Dev\alchemix` (short path, no sync)
- `C:\Projects\alchemix` (organized, no sync)
- `D:\Dev\alchemix` (separate drive, no sync)

**Avoid these locations:**
- ❌ `C:\Users\Admin\OneDrive\...` (causes this error)
- ❌ `C:\Users\Admin\Desktop\...` (might be synced)
- ❌ `C:\Users\Admin\Documents\...` (often synced)

---

## Solution 3: Quick Fix (Temporary)

If you need to keep working right now:

1. **Delete the .next folder**:
   ```bash
   rm -rf .next
   ```

2. **Disable OneDrive temporarily**:
   - Right-click OneDrive icon in taskbar
   - Click Settings
   - Uncheck "Start OneDrive automatically when I sign in to Windows"
   - Click "Pause syncing" → Pause for 2 hours

3. **Restart dev servers**:
   ```bash
   npm run dev:all
   ```

4. **Re-enable OneDrive after development session**

---

## Solution 4: Disable OneDrive for This Folder Only

1. **Open OneDrive Settings**:
   - Right-click OneDrive icon → Settings
   - Go to "Account" tab
   - Click "Choose folders"

2. **Uncheck the DEV Work folder**:
   - Uncheck: `Desktop\DEV Work`
   - Click OK

3. **Wait for OneDrive to stop syncing**

4. **Restart dev servers**:
   ```bash
   npm run dev:all
   ```

**Warning:** This will stop syncing ALL projects in DEV Work, not just AlcheMix.

---

## Verification

After applying any solution, verify it works:

1. **Start servers**:
   ```bash
   npm run dev:all
   ```

2. **Check for errors**:
   - You should NOT see the EINVAL readlink error
   - Both frontend and backend should start successfully

3. **Expected output**:
   ```
   [WEB] ✓ Ready in 2.5s
   [API] 🚀 Server running on http://localhost:3000
   ```

4. **Test the app**:
   - Navigate to http://localhost:3001
   - Verify pages load correctly

---

## Recommended Solution for You

Since you're actively developing AlcheMix, I recommend **Solution 2** (Move project outside OneDrive):

```bash
# Stop servers
Ctrl+C (both terminals)

# Move project
cd C:\Users\Admin\OneDrive\Desktop\DEV Work
Move-Item alchemix C:\Dev\alchemix

# Navigate to new location
cd C:\Dev\alchemix

# Start servers
npm run dev:all
```

This will:
- ✅ Fix the error permanently
- ✅ Improve build performance
- ✅ Eliminate OneDrive sync overhead
- ✅ Make development smoother

You can still use Git for version control and push to GitHub for backup!

---

## Alternative: Configure Next.js to Handle OneDrive

If you must keep the project in OneDrive, add this to `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config

  // Disable symlinks (fixes OneDrive issues)
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },
};

module.exports = nextConfig;
```

Then rebuild:
```bash
rm -rf .next
npm run dev
```

---

## Summary

**Best Solution:** Move project to `C:\Dev\alchemix` (outside OneDrive)

**Quick Fix:** `rm -rf .next && attrib +U .next /S /D`

**Prevention:** Don't develop in OneDrive-synced folders

Let me know which solution you'd like to use, and I can help you implement it!
