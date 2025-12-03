/**
 * Clear and Re-sync MemMachine Recipe Memories Script (v2 API)
 *
 * Utility script to clear all recipe memories from MemMachine and optionally
 * re-sync with the AlcheMix database. Use this for clean slate migration to v2 API.
 *
 * Usage:
 *   npm run clear-memmachine -- --userId=1              # Clear only
 *   npm run clear-memmachine -- --userId=1 --resync     # Clear and re-upload all recipes
 *   npm run clear-memmachine -- --all --resync          # Clear and re-sync ALL users
 */

import { memoryService } from '../src/services/MemoryService';
import { db } from '../src/database/db';

interface User {
  id: number;
  email: string;
}

interface Recipe {
  id: number;
  name: string;
  ingredients: string;
  instructions: string | null;
  glass: string | null;
  category: string | null;
}

async function clearAndResyncMemMachine() {
  const args = process.argv.slice(2);
  const userIdArg = args.find(arg => arg.startsWith('--userId='));
  const allUsersFlag = args.includes('--all');
  const resyncFlag = args.includes('--resync');

  if (!userIdArg && !allUsersFlag) {
    console.error('❌ Error: Please provide --userId=<id> or --all flag');
    console.log('Usage:');
    console.log('  npm run clear-memmachine -- --userId=1              # Clear one user');
    console.log('  npm run clear-memmachine -- --userId=1 --resync     # Clear and re-upload');
    console.log('  npm run clear-memmachine -- --all --resync          # All users');
    process.exit(1);
  }

  let userIds: number[] = [];

  if (allUsersFlag) {
    // Get all user IDs
    const users = db.prepare('SELECT id, email FROM users').all() as User[];
    userIds = users.map(u => u.id);
    console.log(`📋 Found ${userIds.length} users to process`);
  } else {
    const userId = parseInt(userIdArg!.split('=')[1], 10);
    if (isNaN(userId) || userId <= 0) {
      console.error('❌ Error: Invalid userId. Must be a positive integer.');
      process.exit(1);
    }
    userIds = [userId];
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('🧹 MemMachine Clean Slate Migration (v2 API)');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Mode: ${resyncFlag ? 'Clear + Re-sync' : 'Clear only'}`);
  console.log(`Users: ${userIds.length}`);
  console.log('');
  console.log('⚠️  WARNING: This will delete ALL recipe memories from MemMachine');
  console.log('             (AlcheMix database recipes are NOT affected)');
  console.log('');

  let successCount = 0;
  let failCount = 0;

  for (const userId of userIds) {
    console.log(`\n--- Processing user ${userId} ---`);

    try {
      // Step 1: Clear MemMachine project
      console.log(`  🗑️  Clearing MemMachine project...`);
      const cleared = await memoryService.deleteAllRecipeMemories(userId);

      if (!cleared) {
        console.error(`  ❌ Failed to clear MemMachine for user ${userId}`);
        failCount++;
        continue;
      }
      console.log(`  ✅ Cleared MemMachine project`);

      // Step 2: Clear UIDs in database
      console.log(`  🔄 Clearing memmachine_uid in database...`);
      db.prepare('UPDATE recipes SET memmachine_uid = NULL WHERE user_id = ?').run(userId);
      console.log(`  ✅ Cleared UIDs in database`);

      if (resyncFlag) {
        // Step 3: Re-upload all recipes
        const recipes = db.prepare(`
          SELECT id, name, ingredients, instructions, glass, category
          FROM recipes WHERE user_id = ? ORDER BY created_at DESC
        `).all(userId) as Recipe[];

        console.log(`  📤 Re-uploading ${recipes.length} recipes to MemMachine...`);

        if (recipes.length > 0) {
          const recipesForUpload = recipes.map(recipe => ({
            name: recipe.name,
            ingredients: safeParseJSON(recipe.ingredients),
            instructions: recipe.instructions || undefined,
            glass: recipe.glass || undefined,
            category: recipe.category || undefined,
          }));

          const uploadResult = await memoryService.storeUserRecipesBatch(userId, recipesForUpload);

          console.log(`  ✅ Uploaded ${uploadResult.success} recipes (${uploadResult.failed} failed)`);

          // Step 4: Store UIDs in database
          if (uploadResult.uidMap.size > 0) {
            console.log(`  💾 Storing ${uploadResult.uidMap.size} UIDs in database...`);

            const updateStmt = db.prepare('UPDATE recipes SET memmachine_uid = ? WHERE user_id = ? AND name = ?');
            const updateMany = db.transaction((entries: Array<[string, string]>) => {
              for (const [recipeName, uid] of entries) {
                updateStmt.run(uid, userId, recipeName);
              }
            });

            updateMany(Array.from(uploadResult.uidMap.entries()));
            console.log(`  ✅ Stored all UIDs in database`);
          }
        } else {
          console.log(`  ℹ️  No recipes to upload for user ${userId}`);
        }
      }

      successCount++;
      console.log(`  ✅ User ${userId} complete!`);

    } catch (error) {
      console.error(`  ❌ Error processing user ${userId}:`, error);
      failCount++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log('');

  if (failCount === 0) {
    console.log('🎉 All migrations completed successfully!');
    console.log('');
    if (resyncFlag) {
      console.log('Your recipes have been re-synced with the v2 API.');
      console.log('All UIDs are now stored in the database for deletion tracking.');
    } else {
      console.log('Next steps:');
      console.log('1. Re-import your recipes via CSV or use --resync flag');
      console.log('2. UIDs will be captured automatically');
      console.log('3. Future deletions will work properly');
    }
    process.exit(0);
  } else {
    console.error('⚠️  Some migrations failed. Check the logs above.');
    process.exit(1);
  }
}

function safeParseJSON(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// Run the script
clearAndResyncMemMachine();
