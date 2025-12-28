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
import { queryAll, execute, transaction } from '../src/database/db';

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
    const users = await queryAll<User>('SELECT id, email FROM users');
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
      // Step 1a: Clear MemMachine recipes project
      console.log(`  🗑️  Clearing MemMachine recipes project...`);
      const cleared = await memoryService.deleteAllRecipeMemories(userId);

      if (!cleared) {
        console.error(`  ❌ Failed to clear MemMachine for user ${userId}`);
        failCount++;
        continue;
      }
      console.log(`  ✅ Cleared MemMachine recipes project`);

      // Step 1b: Clear MemMachine chat history project
      console.log(`  🗑️  Clearing MemMachine chat history...`);
      try {
        const chatResponse = await fetch('http://localhost:8080/api/v2/projects/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: 'alchemix', project_id: `user_${userId}_chat` })
        });
        if (chatResponse.ok || chatResponse.status === 204 || chatResponse.status === 404 || chatResponse.status === 500) {
          console.log(`  ✅ Cleared chat history`);
        } else {
          console.log(`  ⚠️  Chat history clear returned ${chatResponse.status}`);
        }
      } catch (e) {
        console.log(`  ⚠️  Chat history project may not exist (this is OK)`);
      }

      // Step 2: Clear UIDs in database
      console.log(`  🔄 Clearing memmachine_uid in database...`);
      await execute('UPDATE recipes SET memmachine_uid = NULL WHERE user_id = $1', [userId]);
      console.log(`  ✅ Cleared UIDs in database`);

      if (resyncFlag) {
        // Step 3: Re-upload all recipes
        const recipes = await queryAll<Recipe>(`
          SELECT id, name, ingredients, instructions, glass, category
          FROM recipes WHERE user_id = $1 ORDER BY created_at DESC
        `, [userId]);

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

          // Step 4: Store UIDs in database (using index-based matching)
          const updates: Array<{ id: number; uid: string }> = [];
          for (let i = 0; i < uploadResult.uidResults.length && i < recipes.length; i++) {
            const uid = uploadResult.uidResults[i].uid;
            if (uid) {
              updates.push({ id: recipes[i].id, uid });
            }
          }

          if (updates.length > 0) {
            console.log(`  💾 Storing ${updates.length} UIDs in database...`);

            await transaction(async (client) => {
              for (const { id, uid } of updates) {
                await client.query('UPDATE recipes SET memmachine_uid = $1 WHERE id = $2', [uid, id]);
              }
            });

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

function safeParseJSON(str: string): string[] | string {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// Run the script
clearAndResyncMemMachine();
